# Metoda i jej unit test — linia pod linią

Każdy fragment kodu aplikacji jest od razu zestawiony z odpowiadającym mu fragmentem testu. Czytaj od góry: **linia metody → kod testu dla tej linii → następna linia metody → jej test**.

## Najważniejsze: mockowanie a wywołanie

- **Mock** (`jest.fn()`) zastępuje zależność metody, której nie chcesz uruchamiać naprawdę — np. serwis albo model bazy danych.
- **Konfiguracja mocka** (`mockResolvedValue(...)`) mówi, co ta zależność ma zwrócić, kiedy testowana metoda ją wywoła.
- **Wywołanie testowanej metody** (`controller.getUser(...)` albo `service.createAuth(...)`) uruchamia prawdziwy kod, którego zachowanie sprawdzasz.
- **Asercje** (`expect(...)`) sprawdzają, jaki wynik powstał i jak testowana metoda użyła mockowanych zależności.

Schemat testu kontrolera:

```ts
// 1. Mockujemy UserService; jego prawdziwy kod nie uruchomi się w tym teście.
userService.findAllUsers = jest.fn();

// 2. Ustawiamy odpowiedź, którą ma otrzymać kontroler od udawanego serwisu.
userService.findAllUsers.mockResolvedValue([{ userName: 'Jan' }]);

// 3. Uruchamiamy prawdziwą metodę kontrolera.
const result = await controller.getUser();

// 4. Sprawdzamy, czy kontroler wywołał mock z właściwymi argumentami.
expect(userService.findAllUsers).toHaveBeenCalledWith(undefined, undefined);
```

W skrócie: **mock to podstawiona zależność; wywołanie to uruchomienie prawdziwej metody, którą testujesz.** Nie wywołuj mocka zamiast metody kontrolera/serwisu — metoda testowana ma sama skorzystać z mocka.

## 1. Kontroler: `AuthController.getUser`

### Przygotowanie testu

Test wywołuje prawdziwy kontroler, ale jego zależności (`UserServiceService`, `AuthServiceService`) zastępuje mockami.

```ts
const authService = { createAuth: jest.fn() };
const userService = {
  findAllUsers: jest.fn().mockResolvedValue([]),
  findUserByRefId: jest.fn().mockResolvedValue(null),
  generateUserAuthID: jest.fn().mockResolvedValue(42),
};

const module = await Test.createTestingModule({
  controllers: [AuthController],
  providers: [
    { provide: AuthServiceService, useValue: authService },
    { provide: UserServiceService, useValue: userService },
  ],
}).compile();

const controller = module.get<AuthController>(AuthController);
```

### 1. Pobranie listy

**Linia w metodzie kontrolera:**

```ts
const users = await this.userService.findAllUsers(userRefID, email);
```

**Test dla tej linii: mockujemy wynik, wywołujemy metodę i sprawdzamy argumenty oraz wynik:**

```ts
const usersMock = [{ userName: 'Jan' }];
userService.findAllUsers.mockResolvedValue(usersMock);

const result = await controller.getUser('ref@1', 'jan@example.com');

expect(userService.findAllUsers).toHaveBeenCalledWith(
  'ref@1',
  'jan@example.com',
);
expect(result.users).toBe(usersMock);
```

### 2. Warunkowe wyszukanie użytkownika

**Linia w metodzie kontrolera:**

```ts
const user = userRefID
  ? await this.userService.findUserByRefId(userRefID)
  : null;
```

**Test dla gałęzi z `userRefID`: mockujemy użytkownika i sprawdzamy wywołanie serwisu:**

```ts
const userMock = { userName: 'Jan', Surname: 'Kowalski' };
userService.findUserByRefId.mockResolvedValue(userMock);

const result = await controller.getUser('ref@1');

expect(userService.findUserByRefId).toHaveBeenCalledWith('ref@1');
expect(result.user).toBe(userMock);
```

**Test dla gałęzi bez `userRefID`: sprawdzamy, że wyszukiwanie się nie odbyło:**

```ts
const result = await controller.getUser(undefined, 'jan@example.com');

expect(userService.findUserByRefId).not.toHaveBeenCalled();
expect(result.user).toBeNull();
```

### 3. Zbudowanie modelu formularza

**Linia w metodzie kontrolera:**

```ts
userID: new Types.ObjectId().toString(),
```

**Test dla tej linii: sprawdzamy, że wygenerowana wartość jest poprawnym Mongo ID:**

```ts
expect(Types.ObjectId.isValid(result.createAuthModel.userID)).toBe(true);
```

**Linia w metodzie kontrolera:**

```ts
userAuthID: await this.userService.generateUserAuthID(),
```

**Test dla tej linii: mockujemy wartość zwracaną przez zależność i sprawdzamy wynik:**

```ts
userService.generateUserAuthID.mockResolvedValue(42);

const result = await controller.getUser();

expect(userService.generateUserAuthID).toHaveBeenCalledTimes(1);
expect(result.createAuthModel.userAuthID).toBe(42);
```

**Linie w metodzie kontrolera:**

```ts
name: user?.userName ?? '',
surname: user?.Surname ?? '',
email: email ?? '',
userRefID: userRefID ?? '',
```

**Test dla tych linii: podajemy użytkownika i argumenty, a potem sprawdzamy mapowanie:**

```ts
userService.findUserByRefId.mockResolvedValue({
  userName: 'Jan',
  Surname: 'Kowalski',
});

const result = await controller.getUser('ref@1', 'jan@example.com');

expect(result.createAuthModel).toMatchObject({
  name: 'Jan',
  surname: 'Kowalski',
  email: 'jan@example.com',
  userRefID: 'ref@1',
});
```

### 4. Warunkowe utworzenie autoryzacji

**Linie w metodzie kontrolera:**

```ts
const authorisation = user && email
  ? await this.authService.createAuth(createAuthModel)
  : null;
```

**Test dla warunku prawdziwego: mockujemy wynik serwisu i sprawdzamy argument oraz rezultat:**

```ts
const authMock = { id: 'auth-1' };
userService.findUserByRefId.mockResolvedValue({
  userName: 'Jan',
  Surname: 'Kowalski',
});
authService.createAuth.mockResolvedValue(authMock);

const result = await controller.getUser('ref@1', 'jan@example.com');

expect(authService.createAuth).toHaveBeenCalledWith(result.createAuthModel);
expect(result.authorisation).toBe(authMock);
```

**Test dla warunku fałszywego: bez e-maila serwis tworzący autoryzację nie może być wywołany:**

```ts
userService.findUserByRefId.mockResolvedValue({ userName: 'Jan' });

const result = await controller.getUser('ref@1');

expect(authService.createAuth).not.toHaveBeenCalled();
expect(result.authorisation).toBeNull();
```

### 5. Zwrócenie wyniku

**Linie w metodzie kontrolera:**

```ts
return {
  users,
  user,
  createAuthModel,
  authorisation,
};
```

**Test dla tych linii: sprawdzamy wynik metody:**

```ts
const result = await controller.getUser();

expect(result).toEqual({
  users: [],
  user: null,
  createAuthModel: {
    userID: expect.any(String),
    userAuthID: 42,
    name: '',
    surname: '',
    email: '',
    userRefID: '',
  },
  authorisation: null,
});
```

## 2. Serwis: `AuthServiceService.createAuth`

### Przygotowanie testu

Mock modelu udaje konstruktor dokumentu Mongoose. Mock `saveAuth` udaje metodę `save()` tego dokumentu.

```ts
const saveAuth = jest.fn();
const dataAuthModel = jest.fn(() => ({ save: saveAuth }));

const module = await Test.createTestingModule({
  providers: [
    AuthServiceService,
    { provide: JwtService, useValue: {} },
    { provide: ConfigService, useValue: {} },
    { provide: UserServiceService, useValue: {} },
    { provide: getModelToken(User.name), useValue: {} },
    { provide: getModelToken(DataAuth.name), useValue: dataAuthModel },
  ],
}).compile();

const service = module.get<AuthServiceService>(AuthServiceService);
```

### 1. Utworzenie dokumentu i mapowanie DTO

**Linia w metodzie serwisu:**

```ts
const authDocument = new this.dataAuthModel({
```

**Test dla tej linii: podajemy DTO i później sprawdzimy, że model został utworzony:**

```ts
const dto = {
  userAuthID: 42,
  userID: '507f1f77bcf86cd799439011',
  name: 'Jan',
  surname: 'Kowalski',
  email: 'jan@example.com',
  userRefID: 'ref@1',
};
saveAuth.mockResolvedValue({ id: 'auth-1' });

await service.createAuth(dto);

expect(dataAuthModel).toHaveBeenCalled();
```

**Linia w metodzie serwisu:**

```ts
userId: new Types.ObjectId(dto.userID),
```

**Test dla tej linii: sprawdzamy, że tekstowe ID z DTO zamieniono na `ObjectId`:**

```ts
expect(dataAuthModel).toHaveBeenCalledWith(
  expect.objectContaining({
    userId: new Types.ObjectId(dto.userID),
  }),
);
```

**Linie w metodzie serwisu:**

```ts
userAuthID: dto.userAuthID,
name: dto.name,
email: dto.email,
userRefID: dto.userRefID,
```

**Test dla tych linii: sprawdzamy mapowanie pozostałych pól DTO:**

```ts
expect(dataAuthModel).toHaveBeenCalledWith(
  expect.objectContaining({
    userAuthID: 42,
    name: 'Jan',
    email: 'jan@example.com',
    userRefID: 'ref@1',
  }),
);
```

### 2. Zapis dokumentu i zwrócenie wyniku

**Linia w metodzie serwisu:**

```ts
return authDocument.save();
```

**Test dla tej linii: mockujemy wynik `save()`, wywołujemy serwis i sprawdzamy zapis oraz zwrócony wynik:**

```ts
const savedDocument = { id: 'auth-1' };
saveAuth.mockResolvedValue(savedDocument);

const result = await service.createAuth(dto);

expect(saveAuth).toHaveBeenCalledTimes(1);
expect(result).toBe(savedDocument);
```

### 3. Błąd zapisu

**Metoda nie przechwytuje błędu z `save()`, więc błąd ma zostać przekazany dalej.**

**Test odpowiadający temu zachowaniu:**

```ts
saveAuth.mockRejectedValue(new Error('db down'));

await expect(service.createAuth(dto)).rejects.toThrow('db down');
```

Przykłady pochodzą z [testu kontrolera autoryzacji](./src/authentication/auth-controller/auth-controller.controller.spec.ts) oraz [testu serwisu autoryzacji](./src/authentication/auth-service/auth-service.service.spec.ts).
