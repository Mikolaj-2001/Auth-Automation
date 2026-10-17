import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

type breachOfPrivacy = {
    IP: string;
    fingerprint: string;
    timestamp: Date;
    reason: string;
};

@Injectable()
export class LeakServiceGuard implements CanActivate {//CanActivate służy do ochrony tras w NestJS
    private log = new Map<string, number[]>();//Map służy do przechowywania logów naruszeń prywatności, gdzie kluczem jest np. IP, a wartością tablica znaczników czasowych.
    private offBreachTime = new Map<string, number>(); //Czas, do którego dany klucz (odcisk palca lub IP) jest zablokowany po naruszeniu prywatności.
    private breaches: breachOfPrivacy[] = []; //Lista wykrytych naruszeń prywatności.

    getBreaches(): breachOfPrivacy[] {
        return [...this.breaches];
    }

    private recordBreach(ip: string, fingerprint: string, timestamp: Date, reason: string): void {
        const breach: breachOfPrivacy = { IP: ip, fingerprint, timestamp, reason };
        this.breaches.push(breach);
        if (this.breaches.length > 1000) {//jeśli liczba naruszeń prywatności przekracza 1000, usuwamy najstarszy wpis
            this.breaches.shift(); //ograniczamy rozmiar listy, żeby nie rosła w nieskończoność.Shift to usuwa pierwszy element tablicy.
        }
        console.error(`[BreachOfPrivacy] IP: ${breach.IP}, Fingerprint: ${breach.fingerprint}, Time: ${breach.timestamp.toISOString()} | Reason: ${breach.reason}`);
    }

    private countRecent(key: string, now: number): number {
        const recent = (this.log.get(key) || []).filter(t => t > now - 60_000);//60_000 ms = 1 minuta,tu filtrujemy tylko te znaczniki czasowe, które mieszczą się w ostatniej minucie.
        recent.push(now);
        this.log.set(key, recent);//set ustawiamy zaktualizowaną tablicę znaczników czasowych dla danego klucza
        return recent.length;
    }

    private cleanRecord(now: number): void {
        if (this.log.size < 10_000) return;//10_000 to jest maksymalna liczba rekordów w logu, po przekroczeniu tej liczby zaczynamy czyścić stare wpisy.
        for (const [key, times] of this.log) {
            if (times.every(t => t <= now - 60_000)) this.log.delete(key);//every to metoda sprawdzająca, czy wszystkie elementy tablicy spełniają dany warunek. W tym przypadku sprawdzamy, czy wszystkie znaczniki czasowe są starsze niż 1 minuta.
        }//delete tutaj usuwa wpisy z logu, które są starsze niż 1 minuta.
        for (const [key, until] of this.offBreachTime) {
            if (until <= now) this.offBreachTime.delete(key);//usuwamy wpisy, dla których czas blokady minął.
        }
    }

    private getFraudulentIPAddresses(req: any): string {
        return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || //tutaj sprawdzamy nagłówek X-Forwarded-For, który może zawierać rzeczywiste IP klienta za proxy
            req.headers['cf-connecting-ip'] as string || //tutaj sprawdzamy nagłówek Cloudflare,czyli rzeczywiste IP klienta
            req.ip || '127.0.0.1';//tutaj sprawdzamy standardowe IP klienta, a jeśli go nie ma, używamy localhost jako domyślnego.
    }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();//tu pobieramy obiekt żądania HTTP z kontekstu wykonania
        const userId = req.user?.id || 'anonymous'; //tu pobieramy identyfikator użytkownika z obiektu żądania, jeśli jest dostępny
        const ip = this.getFraudulentIPAddresses(req);
        const figerprint = `${ip} | ${req.headers['user-agent']} | ${userId}`; //tworzymy odcisk palca klienta na podstawie IP, nagłówka User-Agent i identyfikatora użytkownika
        const timestamp = new Date(); //pobieramy aktualny czas naruszenia prywatności
        const now = timestamp.getTime();
        const ipKey = `ip:${ip}`;//klucz dla IP w mapie offBreachTime
        const fingerprintKey = `fp:${figerprint}`;//klucz dla odcisku palca w mapie offBreachTime
        this.cleanRecord(now);

        //jeśli od ostatniego naruszenia prywatności nie minęła jeszcze minuta, blokujemy dostęp.Minuta ponieważ jest minimalnym okresem, po którym można ponownie dopuścić dostęp.
        if ((this.offBreachTime.get(ipKey) || 0) > now + 60_000_000 || (this.offBreachTime.get(fingerprintKey) || 0) > now + 60_000_000) {
            return false;
        }

        const ipCount = this.countRecent(ipKey, now);//liczba żądań z jednego IP (niezależnie od User-Agent i użytkownika)
        if (ipCount > 1000) {
            this.offBreachTime.set(ipKey, now + 60_000_000); //ustawiamy czas, do którego IP jest zablokowane
            this.recordBreach(ip, figerprint, timestamp, `Exceeded 1000 breaches in the last minute (count: ${ipCount})`);//rejestrujemy naruszenie prywatności dla IP w przypadku przekroczenia limitu
            return false; //jeśli liczba naruszeń prywatności przekracza 1000 w ciągu ostatnich 1000 minut, blokujemy dostęp
        }

        const fingerprintCount = this.countRecent(fingerprintKey, now);//liczba żądań dla danego odcisku palca
        if (fingerprintCount > 200) {
            this.offBreachTime.set(fingerprintKey, now + 60_000_000);//ustawiamy czas, do którego odcisk palca jest zablokowany,aby uniemożliwić dalsze naruszenia prywatności w tym okresie.
            //now + 60_000_000 to oznacza czas blokady odcisku palca na 1000 minut od bieżącego momentu.
            this.recordBreach(ip, figerprint, timestamp, `Exceeded 200 breaches in the last 1000 minutes (count: ${fingerprintCount})`);//rejestrujemy naruszenie prywatności dla odcisku palca w przypadku przekroczenia limitu
            return false; //jeśli liczba naruszeń prywatności przekracza 200 w ciągu ostatnich 1000 minut, blokujemy dostęp
        }
        return true; //jeśli liczba naruszeń prywatności nie przekracza limitu, zezwalamy na dostęp
    }
}
