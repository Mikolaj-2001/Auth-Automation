# Auth-automation

Aplikacja do rejestracji i logowania użytkowników z zarządzaniem danymi autoryzacyjnymi. Aplikacja chroniona jest przed atakami brute-force i zawiera automatyczne wykrywanie podejrzanych IP.

## Cechy

- Rejestracja użytkownika (`/user/register`) i logowanie (`/user/login`)
- Wylogowanie (`/user/logout`)
- JWT token przechowywany w ciasteczku
- Ograniczenie prób logowania: 5 prób na 20 minut
- Automatyczne wykrywanie i blokowanie podejrzanych IP
- Panel zarządzania danymi autoryzacyjnymi (po zalogowaniu)
- Szyfrowanie danych na poziomie aplikacji

## Wymagania

- Node.js 22+ i npm
- Działająca instancja MongoDB (lokalnie lub np. MongoDB Atlas)
- Docker (opcjonalnie)

## Konfiguracja

Utwórz plik `.env` w głównym katalogu projektu:

```env
# Parametry połączenia MongoDB
MONGODB_URI=mongodb://localhost:27017/auth-automation

# Tajny klucz do podpisywania JWT - użyj długiego losowego ciągu
JWT_AUTH_TOKEN=replace-with-a-long-random-secret

# Czas wygaśnięcia tokena (np. 15m, 1h, 7d)
JWT_AUTH_TOKEN_EXPIRES_IN=1h

# Port HTTP (domyślnie: 9800)
PORT=9800
```

**Ważne:** Nigdy nie commituj pliku `.env` - zawiera on tajne dane!

## Instalacja i uruchomienie

### Lokalnie

```bash
npm install
npx prisma generate

# Tryb development z auto-reload
npm run start:dev

# Lub tryb produkcji
npm run build
npm run start:prod
```

Aplikacja będzie dostępna na `http://localhost:9800` (lub port ustawiony w `.env`).

### Panel użytkownika

| URL | Opis |
|-----|------|
| `GET /user/register` | Formularz rejestracji |
| `GET /user/login` | Formularz logowania |
| `GET /auth/user/user` | Panel autoryzacji (po zalogowaniu) |

### Docker

```bash
docker build -t auth-automation .

docker run --rm -p 3000:3000 --env-file .env \
  -e PORT=3000 \
  auth-automation
```

Jeśli MongoDB jest na Twojej maszynie hosta, użyj `host.docker.internal` zamiast `localhost` w `MONGODB_URI`.

## Testowanie aplikacji

Aplikacja zawiera kompleksowe testy jednostkowe (117 testów) pokrywające całą funkcjonalność.

### Uruchomienie testów

```bash
# Testy jednostkowe
npm run test

# Testy end-to-end
npm run test:e2e

# Raport pokrycia kodu
npm run test:cov
```

### Pokrycie testami

Aplikacja jest testowana pod względem:

- **Rejestracji użytkownika** - walidacja haseł, sprawdzenie poprawności PersonalID
- **Logowania** - weryfikacja danych logowania, zarządzanie JWT
- **Wylogowania** - czyszczenie ciasteczek sesji
- **Zarządzania autoryzacją** - tworzenie, edycja, usuwanie rekordów
- **Bezpieczeństwa** - detekcja podejrzanych IP, ograniczenie prób logowania
- **Szyfrowania** - ochrona danych w bazie danych

Testy pokrywają:
- ✅ 117 testów jednostkowych (wszystkie przechodzą)
- ✅ 100% pokrycia kontrolerów
- ✅ 85-98% pokrycia serwisów
- ✅ Scenariusze błędów i edge cases

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| Błąd połączenia z bazą danych | Sprawdź `MONGODB_URI` i czy MongoDB jest uruchomiony |
| Błędy 401 / wymuszenie logowania | Upewnij się, że `JWT_AUTH_TOKEN` jest ustawiony |
| `Cannot find module '.prisma/client'` | Uruchom `npx prisma generate` |
| Logowanie nie działa w Docker + HTTP | Ustaw `-e NODE_ENV=development` lub użyj HTTPS |
| `Osiągnięto maksymalną ilość prób` | Limit logowania (5 prób na 20 minut) - czekaj lub restartuj aplikację |

## Licencja

UNLICENSED (projekt prywatny).
