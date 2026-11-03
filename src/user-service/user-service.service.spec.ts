import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { UserServiceService } from './user-service.service';
import { User } from '../user-schema/user.schema';
import { DataAuth } from '../authData-schema/dataAuth.schema';
import { PersonalIDService } from '../userDto/userRegistered.dto';

const execResolving = (value: unknown) => ({ exec: jest.fn().mockResolvedValue(value) });
const leanExecResolving = (value: unknown) => ({
  lean: jest.fn().mockReturnValue(execResolving(value)),
});

// Mirrors the value produced by PersonalIDService.registerPersonalID (JSON.stringify of a string)
const storedPersonalID = (id: number) => JSON.stringify(String(id));
const expectedAuthID = (random: number) =>
  Math.floor(random * 8_000_000_000_000_000) + 1_000_000_000_000_000;

describe('UserServiceService', () => {
  let service: UserServiceService;
  let saveUser: jest.Mock;
  let saveAuth: jest.Mock;
  let userModel: jest.Mock & {
    createIndexes: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };
  let authModel: jest.Mock & { exists: jest.Mock; findByIdAndDelete: jest.Mock };//exists checks if a userAuthID already exists in the database
  let personalIDService: { getUserPersonalID: jest.Mock; registerPersonalID: jest.Mock };

  beforeEach(async () => {
    saveUser = jest.fn();
    saveAuth = jest.fn();
    userModel = Object.assign(
      jest.fn((data: unknown) => ({ data, save: saveUser })),
      {
        createIndexes: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findByIdAndDelete: jest.fn(),
      },
    );
    authModel = Object.assign(
      jest.fn((data: unknown) => ({ data, save: saveAuth })),
      { exists: jest.fn(), findByIdAndDelete: jest.fn() },
    );
    personalIDService = {
      getUserPersonalID: jest.fn().mockReturnValue([]),
      registerPersonalID: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserServiceService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(DataAuth.name), useValue: authModel },
        { provide: PersonalIDService, useValue: personalIDService },
      ],
    }).compile();

    service = module.get<UserServiceService>(UserServiceService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('personalIDInfo', () => {
    it('returns null when no personal ID was registered', () => {
      personalIDService.getUserPersonalID.mockReturnValue([]);
      expect(service.personalIDInfo()).toBeNull();
    });

    it('returns the last registered personal ID as a number', () => {
      personalIDService.getUserPersonalID.mockReturnValue([
        storedPersonalID(111),
        storedPersonalID(12345),
      ]);
      expect(service.personalIDInfo()).toBe(12345);
    });
  });

  describe('generateUserAuthID', () => {
    it('returns a 16-digit ID when it is not taken', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);//0.5 to wartość używana do wygenerowania userAuthID
      authModel.exists.mockResolvedValue(null);

      const result = await service.generateUserAuthID();

      expect(result).toBe(expectedAuthID(0.5));
      expect(String(result)).toHaveLength(16);
      expect(authModel.exists).toHaveBeenCalledWith({ userAuthID: result });
    });

    it('draws again when the ID is already taken', async () => {
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.2);
      authModel.exists.mockResolvedValueOnce({ _id: 'taken' }).mockResolvedValueOnce(null);//pierwsze wywołanie zwraca zajęty ID, drugie zwraca null, co wymusza ponowne losowanie ID

      const result = await service.generateUserAuthID();

      expect(authModel.exists).toHaveBeenCalledTimes(2);
      expect(result).toBe(expectedAuthID(0.2));//sprawdzamy, czy wynik jest zgodny z oczekiwanym ID wygenerowanym na podstawie Math.random() = 0.2.
      //0.2 oznacza 
    });
  });

  describe('createUser', () => {
    const personalID = 12345;
    const userDTO = {
      userName: 'testUser',
      Surname: 'testSurname',
      email: 'test@example.com',
      password: 'testPassword',
    };
    const makeAuthDTO = () => ({
      userAuthID: 0,
      Name: 'testName',
      email: 'test@example.com',
      userRefID: 'testUserRefID',
    });

    it('creates the auth record and the user when the personal ID matches', async () => {
      personalIDService.getUserPersonalID.mockReturnValue([storedPersonalID(personalID)]);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      authModel.exists.mockResolvedValue(null);
      userModel.createIndexes.mockResolvedValue(3);
      saveAuth.mockResolvedValue({ _id: 'auth1' });
      saveUser.mockResolvedValue({ userRefID: 'auth1@3' });
      const authDTO = makeAuthDTO();

      const result = await service.createUser(userDTO, authDTO, personalID);

      expect(authDTO.userAuthID).toBe(expectedAuthID(0.5));
      expect(authModel).toHaveBeenCalledWith(authDTO);
      expect(userModel).toHaveBeenCalledWith({
        ...userDTO,
        personalID,
        userRefID: 'auth1@3',
      });
      expect(saveUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ userRefID: 'auth1@3' });
    });

    it('rejects when no personal ID was registered', async () => {
      personalIDService.getUserPersonalID.mockReturnValue([]);

      await expect(service.createUser(userDTO, makeAuthDTO(), personalID)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authModel).not.toHaveBeenCalled();
      expect(userModel).not.toHaveBeenCalled();
    });

    it('rejects when the personal ID does not match the registered one', async () => {
      personalIDService.getUserPersonalID.mockReturnValue([storedPersonalID(999)]);

      await expect(service.createUser(userDTO, makeAuthDTO(), personalID)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(saveAuth).not.toHaveBeenCalled();
      expect(saveUser).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('throws when the user does not exist', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.updateUser('missing', { userName: 'x' })).rejects.toThrow(//sprawdzamy, czy metoda rzuca UnauthorizedException, gdy użytkownik nie istnieje,missing oznacza brakującego użytkownika w bazie danych,a x to nowa nazwa użytkownika, którą próbujemy ustawić
        UnauthorizedException,
      );
    });

    it('applies the DTO and saves the user', async () => {
      const save = jest.fn().mockResolvedValue('saved');
      const user = { _id: 'u1', userName: 'old', save };//old oznacza poprzednią nazwę użytkownika przed aktualizacją
      userModel.findOne.mockResolvedValue(user);

      const result = await service.updateUser('ref1', { userName: 'updatedUserName' });

      expect(userModel.findOne).toHaveBeenCalledWith({ userRefID: 'ref1' });
      expect(user.userName).toBe('updatedUserName');
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledTimes(1);
      expect(result).toBe('saved');
    });

    it('updates userRefID through findByIdAndUpdate when it is provided', async () => {
      const save = jest.fn().mockResolvedValue('saved');
      const user = { _id: 'u1', userRefID: 'ref1', save };
      userModel.findOne.mockResolvedValue(user);
      userModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userRefID: 'ref2' }),
      });

      await service.updateUser('ref1', { userRefID: 'ref2' });

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'u1',
        { userRefID: 'ref2' },
        { new: true },
      );
      expect(user.userRefID).toBe('ref2');
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeUser', () => {
    it('throws when the user does not exist and deletes nothing', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.removeUser('missing')).rejects.toThrow(UnauthorizedException);
      expect(userModel.findByIdAndDelete).not.toHaveBeenCalled();
      expect(authModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('deletes the user and the related auth record', async () => {
      userModel.findOne.mockResolvedValue({ _id: 'u1', userRefID: 'auth1@3' });

      await service.removeUser('auth1@3');

      expect(userModel.findOne).toHaveBeenCalledWith({ userRefID: 'auth1@3' });
      expect(userModel.findByIdAndDelete).toHaveBeenCalledWith('u1');
      expect(authModel.findByIdAndDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('finders', () => {
    it('findUserByRefId queries by userRefID', async () => {
      const user = { userRefID: 'ref1' };
      userModel.findOne.mockReturnValue(execResolving(user));

      await expect(service.findUserByRefId('ref1')).resolves.toBe(user);
      expect(userModel.findOne).toHaveBeenCalledWith({ userRefID: 'ref1' });
    });

    it('findUserById queries by id', async () => {
      const user = { _id: 'someUserId' };
      userModel.findById.mockReturnValue(leanExecResolving(user));

      await expect(service.findUserById('someUserId')).resolves.toBe(user);
      expect(userModel.findById).toHaveBeenCalledWith('someUserId');
    });

    it('findUserByAuthID queries by userAuthID', async () => {
      const user = { userAuthID: 1684559786245578 };
      userModel.findOne.mockReturnValue(leanExecResolving(user));//leanExecResolving zwraca obiekt z metodą exec, który rozwiązuje się do podanego użytkownika, co symuluje zachowanie Mongoose w testach

      await expect(service.findUserByAuthID(1684559786245578)).resolves.toBe(user);
      expect(userModel.findOne).toHaveBeenCalledWith({ userAuthID: 1684559786245578 });
    });
  });

  describe('findAllUsers', () => {
    const makeDbUser = (userRefID: string, email: string) => ({
      userRefID,
      getDecryptedEmail: jest.fn(() => email),
    });

    it('returns every user when userRefID is not provided', async () => {
      const users = [makeDbUser('r1', 'a@b.com'), makeDbUser('r2', 'c@d.com')];
      userModel.find.mockReturnValue(execResolving(users));

      await expect(service.findAllUsers()).resolves.toEqual(users);
      expect(userModel.find).toHaveBeenLastCalledWith({});
    });

    it('narrows the result to the user matching both userRefID and decrypted email', async () => {
      const wanted = makeDbUser('r1', 'a@b.com');
      userModel.find.mockReturnValue(
        execResolving([makeDbUser('r2', 'c@d.com'), wanted]),
      );

      await expect(service.findAllUsers('r1', 'a@b.com')).resolves.toEqual([wanted]);
    });

    it('skips users whose email cannot be decrypted', async () => {
      const broken = {
        userRefID: 'r1',
        getDecryptedEmail: jest.fn(() => {
          throw new Error('bad key');
        }),
      };
      const wanted = makeDbUser('r1', 'a@b.com');
      userModel.find.mockReturnValue(execResolving([broken, wanted]));

      await expect(service.findAllUsers('r1', 'a@b.com')).resolves.toEqual([wanted]);
    });
  });
});
