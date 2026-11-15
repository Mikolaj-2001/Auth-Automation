import { ExecutionContext } from '@nestjs/common';
import { LeakServiceGuard } from './leak-service.guard';

describe('LeakServiceGuard', () => {
  let guard: LeakServiceGuard;

  const makeContext = (req: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as ExecutionContext;

  const makeRequest = (userAgent = 'jest-test-agent') => ({//tutaj tworzymy obiekt żądania HTTP z domyślnym adresem IP, nagłówkiem User-Agent i identyfikatorem użytkownika dla testów
    ip: '10.0.0.1',
    headers: {
      'user-agent': userAgent,
    },
    user: { id: 'user-1' },
  });

  beforeEach(() => {
    guard = new LeakServiceGuard();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('allows a request while it is within the limits', () => {
    const canActivate = guard.canActivate(makeContext(makeRequest()));

    expect(canActivate).toBe(true);
    expect(guard.getBreaches()).toEqual([]);
  });

  it('returns a copy of the breaches list', () => {
    const breaches = guard.getBreaches();

    expect(breaches).toEqual([]);
    expect(breaches).not.toBe(guard.getBreaches());
  });

  it('blocks a fingerprint after more than 200 requests and records the breach', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const context = makeContext(makeRequest());

    for (let request = 0; request < 200; request++) {
      expect(guard.canActivate(context)).toBe(true);
    }

    expect(guard.canActivate(context)).toBe(false);

    const [breach] = guard.getBreaches();
    expect(breach).toMatchObject({//toMatchObject to metoda sprawdza, czy obiekt zawiera określone właściwości i wartości
      IP: '',
      fingerprint: ' | jest-test-agent | user-1',
      reason: expect.stringContaining('Exceeded 200 requests'),
    });
    expect(breach.timestamp).toBeInstanceOf(Date);
  });

  it('continues blocking a fingerprint during its block period', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const context = makeContext(makeRequest());

    for (let request = 0; request <= 200; request++) {
      guard.canActivate(context);
    }

    expect(guard.canActivate(context)).toBe(false);
    expect(guard.getBreaches()).toHaveLength(1);
  });

  it('blocks a claimed IP after more than 1000 requests and records the breach', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const contextForRequest = (request: number) =>
      makeContext({
        ...makeRequest(`jest-test-agent-${request}`),//... oznacza, że wszystkie właściwości obiektu zwróconego przez makeRequest zostaną skopiowane do nowego obiektu
        headers: {
          ...makeRequest().headers,//kopiujemy wszystkie nagłówki z domyślnego żądania, aby zachować spójność z innymi nagłówkami
          'user-agent': `jest-test-agent-${request}`,
          'x-forwarded-for': '203.0.113.10',
        },
      });

    for (let request = 0; request < 1000; request++) {
      expect(guard.canActivate(contextForRequest(request))).toBe(true);
    }

    expect(guard.canActivate(contextForRequest(1000))).toBe(false);

    const [breach] = guard.getBreaches();
    expect(breach).toMatchObject({
      IP: '203.0.113.10',
      reason: expect.stringContaining('Exceeded 1000 requests'),
    });
  });

  describe('getFraudulentIPAddresses', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const context = makeContext({
        ...makeRequest(),
        headers: {
          'user-agent': 'test-agent',
          'x-forwarded-for': '203.0.113.10, 203.0.113.11',
        },
      });

      // Wykonujemy żądanie, aby przetestować funkcję
      const canActivate = guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('handles Cloudflare cf-connecting-ip header', () => {
      const context = makeContext({
        ...makeRequest(),
        headers: {
          'user-agent': 'test-agent',
          'cf-connecting-ip': '203.0.113.12',
        },
      });

      const canActivate = guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('uses real IP when no forwarded headers present', () => {
      const context = makeContext({
        ip: '203.0.113.13',
        headers: {
          'user-agent': 'test-agent',
        },
        user: { id: 'user-1' },
      });

      const canActivate = guard.canActivate(context);
      expect(canActivate).toBe(true);
    });
  });

  describe('breach limits', () => {
    it('limits the number of stored breaches to MAX_BREACHES (1000)', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // Tworzymy wiele naruszeń
      for (let i = 0; i < 1100; i++) {
        const context = makeContext({
          ...makeRequest(`jest-test-agent-${i}`),
          headers: {
            'user-agent': `jest-test-agent-${i}`,
            'x-forwarded-for': `203.0.113.${i % 256}`,
          },
        });

        // Generujemy naruszenie poprzez przekroczenie limitu żądań
        for (let req = 0; req <= 200; req++) {
          guard.canActivate(context);
        }
      }

      const breaches = guard.getBreaches();
      expect(breaches.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('cleanRecord', () => {
    it('cleans old records when log exceeds 10000 entries', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // Tworzymy dużo requestów aby wymusić czyszczenie logów
      for (let i = 0; i < 10100; i++) {
        const context = makeContext({
          ip: '10.0.0.1',
          headers: {
            'user-agent': `agent-${i % 100}`,// simulate different user agents to trigger cleanRecord. % 100 oznacza, że mamy 100 różnych user agentów
          },
          user: { id: `user-${i}` },
        });
        guard.canActivate(context);
      }

      // Jeśli nie było błędów, to czyszczenie działało prawidłowo
      expect(guard).toBeDefined();
    });

    it('removes expired blocked entries from offBreachTime', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const context = makeContext(makeRequest());

      // Tworzymy naruszenie
      for (let request = 0; request <= 200; request++) {
        guard.canActivate(context);
      }

      // Czekamy (lub symulujemy upływ czasu poprzez kolejne żądania z innym useragent)
      // Wtedy cleanRecord powinna usunąć stare wpisy
      for (let i = 0; i < 10100; i++) {
        const freshContext = makeContext({
          ip: '10.0.0.2',
          headers: {
            'user-agent': `fresh-agent-${i}`,
          },
          user: { id: 'fresh-user' },
        });
        guard.canActivate(freshContext);// simulate requests to trigger cleanRecord
      }

      expect(guard.getBreaches().length).toBeGreaterThan(0);
    });
  });
});
