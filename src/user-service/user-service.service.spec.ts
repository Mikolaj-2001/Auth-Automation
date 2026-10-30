import { Test, TestingModule } from '@nestjs/testing';
import { UserServiceService, } from './user-service.service';
import { jest } from '@jest/globals';
import { DataAuth } from '../authData-schema/dataAuth.schema';
import { User } from '../user-schema/user.schema';
import { UnauthorizedException } from '@nestjs/common';
import { PersonalIDService } from '../userDto/userRegistered.dto';

const VALID_ID = '62595659554595569fdsd';

const makeUser = (email: string, password: string, extra: Record<string, unknown> = {}) => ({
  _id: VALID_ID,
  userName: 'Test',
  Surname: 'User',
  userRefID: `${VALID_ID}@1`,
  getDecryptedEmail: jest.fn(() => email),
  getDecryptedPassword: jest.fn(() => password),
  ...extra,//extra to inaczej dodatkowe właściwości, które mogą być przekazane do obiektu użytkownika
});

describe('UserServiceService', async () => {
  let service: UserServiceService;
  let saveUser: jest.Mock;
  let saveAuth: jest.Mock;
  let personalIDService: jest.Mocked<PersonalIDService> = {
    getUserPersonalID: jest.fn<() => string[]>(),
    registerPersonalID: jest.fn<(personalId: number) => void>(),
  } as jest.Mocked<PersonalIDService>;

  let userModel: jest.Mock & {
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    deleteOne: jest.Mock;
    findAllUsers: jest.Mock;
    findUserById: jest.Mock;
    findUserByAuthID: jest.Mock;
  }
  let authModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    saveUser = jest.fn();
    saveAuth = jest.fn();
    userModel = Object.assign(jest.fn(), {
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      deleteOne: jest.fn(),
      findAllUsers: jest.fn(),
      findUserById: jest.fn(),
      findUserByAuthID: jest.fn(),
    });
    authModel = {
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserServiceService,
        { provide: 'UserModel', useValue: userModel },
        { provide: 'AuthModel', useValue: authModel },
        { provide: PersonalIDService, useValue: personalIDService = Object.assign(jest.fn<() => string[]>(), { getUserPersonalID: jest.fn<() => string[]>(), registerPersonalID: jest.fn<(personalId: number) => void>() }) },
      ],
    }).compile();

    service = module.get<UserServiceService>(UserServiceService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have personalIDService defined', () => {
    expect(personalIDService).toBeDefined();
  });

  it('Should have getUserPersonalID defined in form of a number array', () => {
    expect(personalIDService.getUserPersonalID).toBeDefined();
    const result = personalIDService.getUserPersonalID();
    expect(Array.isArray(result)).toBe(true);
    expect(result.every(item => typeof item === 'number')).toBe(true);
  });
  it('Should have registerPersonalID defined', () => {
    expect(personalIDService.registerPersonalID).toBeDefined();
  });

  it('Should have registerPersonalID working correctly', () => {
    const personalId = 12345;
    personalIDService.registerPersonalID(personalId);
    expect(personalIDService.registerPersonalID).toHaveBeenCalledWith(personalId);
  });

  it('It should generate userAuthID afterwards', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.12345);

    authModel.exists = jest.fn().mockReturnValue(true);

    const result = await service.generateUserAuthID();
    expect(result).toBeDefined();
    expect(authModel.exists).toHaveBeenCalled();
  });

  describe('createUser with authStructure', () => {
    const userDTO = {
      userName: 'testUser',
      Surname: 'testSurname',
      email: 'test@example.com',
      password: 'testPassword',
    };
    const authDTO = {
      userAuthID: 1684559786245578,
      Name: 'testName',
      email: 'test@example.com',
      userRefID: 'testUserRefID'
    };
    const personalID = 12345

    it('should create user with authStructure', async () => {
      const result = await service.createUser(userDTO, authDTO, personalID);
      expect(result).toBeDefined();
    });
  });

  describe('updateUser', () => {
    it('should update user correctly', async () => {
      const newUserDTO = {
        userName: 'updatedUserName',
        surname: 'updatedSurname',
        email: 'updated@example.com',
        password: 'updatedPassword',
        userRefID: 'updatedUserRefID'
      };
      const result = await userModel.findByIdAndUpdate(
        { userRefID: 'updatedUserRefID' },
        newUserDTO
      );
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        { userRefID: 'updatedUserRefID' },
        newUserDTO
      );
      expect(result).toBeDefined();
    });
  });

  it('should delete user correctly', async () => {
    const userRefID = 'updatedUserRefID';
    const result = await userModel.findByIdAndDelete({ userRefID });
    expect(userModel.findByIdAndDelete).toHaveBeenCalledWith({ userRefID });
    expect(result).toBeDefined();
  });

  it('it should find user by userRefID', async () => {
    const userRefID = 'updatedUserRefID';
    const result = await userModel.findOne({ userRefID });
    expect(userModel.findOne).toHaveBeenCalledWith({ userRefID });
    expect(result).toBeDefined();
  });

  it('it should find all users', async () => {
    const userRefID = 'updatedUserRefID';
    const email = 'updated@example.com';
    const result = await userModel.findAllUsers({userRefID,email});
    expect(userModel.findAllUsers).toHaveBeenCalledWith({userRefID,email});
    expect(result).toBeDefined();
  });

  it('it should find user by id', async () => {
    const id = 'someUserId';
    const result = await userModel.findUserById(id);
    expect(userModel.findUserById).toHaveBeenCalledWith(id);
    expect(result).toBeDefined();
  });

  it('it should find user by authID', async () => {
    const userAuthID = 'someUserAuthID';
    const result = await userModel.findUserByAuthID(userAuthID);
    expect(userModel.findUserByAuthID).toHaveBeenCalledWith(userAuthID);
    expect(result).toBeDefined();
  });
});

