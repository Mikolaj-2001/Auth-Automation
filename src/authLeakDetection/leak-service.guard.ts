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

    private readonly MAX_BREACHES = 1000;
    private readonly OFF_BREACH_DURATION = 15 * 60_000; //czas blokady po naruszeniu prywatności w ms (15 minut)

    getBreaches(): breachOfPrivacy[] {
        return [...this.breaches];//tutaj zwracamy kopię listy naruszeń prywatności, aby nie można było jej modyfikować z zewnątrz.
    }

    private recordBreach(ip: string, fingerprint: string, timestamp: Date, reason: string): void {
        const breach: breachOfPrivacy = { IP: ip, fingerprint, timestamp, reason };
        this.breaches.push(breach);
        if (this.breaches.length > this.MAX_BREACHES) {//jeśli liczba naruszeń prywatności przekracza 1000, usuwamy najstarszy wpis
            this.breaches.shift(); //ograniczamy rozmiar listy, żeby nie rosła w nieskończoność.Shift to usuwa pierwszy element tablicy.
        }
        console.error(`[BreachOfPrivacy] IP: ${breach.IP}, Fingerprint: ${breach.fingerprint}, Time: ${breach.timestamp.toISOString()} | Reason: ${breach.reason}`);
    }

    private countRecent(key: string, now: number): number {
        const recent = (this.log.get(key) || []).filter(t => t > now - this.OFF_BREACH_DURATION);//60_000 ms = 1 minuta,tu filtrujemy tylko te znaczniki czasowe, które mieszczą się w ostatniej minucie.
        recent.push(now);
        this.log.set(key, recent);//set ustawiamy zaktualizowaną tablicę znaczników czasowych dla danego klucza
        return recent.length;
    }

    private cleanRecord(now: number): void {
        if (this.log.size < 10_000) return;//10_000 to jest maksymalna liczba rekordów w logu, po przekroczeniu tej liczby zaczynamy czyścić stare wpisy.
        for (const [key, times] of this.log) {
            if (times.every(t => t <= now - this.OFF_BREACH_DURATION)) this.log.delete(key);//every to metoda sprawdzająca, czy wszystkie elementy tablicy spełniają dany warunek. W tym przypadku sprawdzamy, czy wszystkie znaczniki czasowe są starsze niż 1 minuta.
        }//delete tutaj usuwa wpisy z logu, które są starsze niż 1 minuta.
        for (const [key, until] of this.offBreachTime) {
            if (until <= now) this.offBreachTime.delete(key);//usuwamy wpisy, dla których czas blokady minął.
        }
    }

    private getFraudulentIPAddresses(req: any): string[] {
        const realIp = req.ip || '127.0.0.1';//tutaj sprawdzamy standardowe IP klienta, a jeśli go nie ma, używamy localhost jako domyślnego.
        const claimedIp = [
            ...String(req.headers['x-forwarded-for'] ?? '').split(','),//... oznacza rozpakowanie tablicy na pojedyncze elementy w nowej tablicy
            String(req.headers['cf-connecting-ip'] ?? ''),
        ];
        return claimedIp
            .map(ip => ip.trim().slice(0, 45)) //usuwamy ewentualne spacje z adresów IP
            .filter(ip => ip && ip !== realIp); //usuwamy puste adresy IP oraz adres IP klienta, aby uniknąć fałszywych zgłoszeń
    }

    canActivate(context: ExecutionContext): boolean {//canActivate sprawdza, czy żądanie może zostać obsłużone na podstawie naruszeń prywatności i limitów żądań.
        const req = context.switchToHttp().getRequest();//tu pobieramy obiekt żądania HTTP z kontekstu wykonania
        const userId = req.user?.id || 'anonymous'; //tu pobieramy identyfikator użytkownika z obiektu żądania, jeśli jest dostępny
        const fraudulentIp = this.getFraudulentIPAddresses(req);
        const figerprint = `${fraudulentIp.join(',')} | ${req.headers['user-agent']} | ${userId}`; //tworzymy odcisk palca klienta na podstawie IP, nagłówka User-Agent i identyfikatora użytkownika.Nagłówek User-Agent pozwala zidentyfikować przeglądarkę lub klienta HTTP.
        const timestamp = new Date(); //pobieramy aktualny czas naruszenia prywatności
        const now = timestamp.getTime();
        const ipKey = `ip:${fraudulentIp.join(',')}`;//klucz dla IP w mapie offBreachTime
        const fingerprintKey = `fp:${figerprint}`;//klucz dla odcisku palca w mapie offBreachTime
        this.cleanRecord(now);

        //jeśli od ostatniego naruszenia prywatności nie minęła jeszcze minuta, blokujemy dostęp.Minuta ponieważ jest minimalnym okresem, po którym można ponownie dopuścić dostęp.
        if ((this.offBreachTime.get(ipKey) ?? 0) > now || (this.offBreachTime.get(fingerprintKey) ?? 0) > now) {
            return false;
        }

        const ipCount = this.countRecent(ipKey, now);//liczba żądań z jednego IP (niezależnie od User-Agent i użytkownika)
        if (ipCount > 1000) {
            this.offBreachTime.set(ipKey, now + this.OFF_BREACH_DURATION); //ustawiamy czas, do którego IP jest zablokowane
            this.recordBreach(fraudulentIp.join(','), figerprint, timestamp, `Exceeded 1000 requests in the last minute (count: ${ipCount})`);//rejestrujemy naruszenie prywatności dla IP w przypadku przekroczenia limitu
            return false; //jeśli liczba naruszeń prywatności przekracza 1000 w ciągu ostatnich 1000 minut, blokujemy dostęp
        }

        const fingerprintCount = this.countRecent(fingerprintKey, now);//liczba żądań dla danego odcisku palca
        if (fingerprintCount > 200) {
            this.offBreachTime.set(fingerprintKey, now + this.OFF_BREACH_DURATION);//ustawiamy czas, do którego odcisk palca jest zablokowany,aby uniemożliwić dalsze naruszenia prywatności w tym okresie.
            //now + this.OFF_BREACH_DURATION to oznacza czas blokady odcisku palca na 1 minutę od bieżącego momentu.
            this.recordBreach(fraudulentIp.join(','), figerprint, timestamp, `Exceeded 200 requests in the last 1000 minutes (count: ${fingerprintCount})`);//rejestrujemy naruszenie prywatności dla odcisku palca w przypadku przekroczenia limitu
            return false; //jeśli liczba naruszeń prywatności przekracza 200 w ciągu ostatnich 1000 minut, blokujemy dostęp
        }
        return true; //jeśli liczba naruszeń prywatności nie przekracza limitu, zezwalamy na dostęp
    }
}
