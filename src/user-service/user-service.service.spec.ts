import { Test, TestingModule } from '@nestjs/testing';
import { UserServiceService, } from './user-service.service';
import { jest } from '@jest/globals';

describe('UserServiceService', () => {
  let service: UserServiceService;
  let userModel: any;
  let authModel: any;

  beforeEach(() => {
    userModel = jest.fn();
    authModel = jest.fn();
    service = new UserServiceService(userModel, authModel, jest.fn() as any);
  });

  it('creates an user successfully', async () => {
    const userData = {
      userName: 'John',
      Surname: 'Doe',
      email: 'john.doe@example.com',
      password: 'password',
      userRefID: 'user-ref-id',
      encryptionKey: 'encryption-key',
      authId: 'auth-id',
    };
    const saveUser = jest.fn(() => Promise.resolve({
      toJSON: () => ({ ...userData })
    }));

    const saveAuth = jest.fn(() => Promise.resolve({ authId: 'auth-id' }));

    userModel.mockImplementation((data: unknown) => ({ data, save: saveUser }));
    authModel.mockImplementation((data: unknown) => ({ data, save: saveAuth }));

    const result = await service.createUser(userData, userData.userRefID as any, userData.encryptionKey as any);
    expect(result).toEqual({ ...userData });

    expect(userModel).toHaveBeenCalledWith(expect.objectContaining(userData));
    expect(authModel).toHaveBeenCalledWith(expect.objectContaining({ authId: 'auth-id', userRefID: userData.userRefID, encryptionKey: userData.encryptionKey }));

    expect(result).toHaveProperty(userData.userRefID, 'user-ref-id');
    expect(result).toHaveProperty('userName', userData.userName ?? 'John');
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserServiceService],
    }).compile();

    service = module.get<UserServiceService>(UserServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
