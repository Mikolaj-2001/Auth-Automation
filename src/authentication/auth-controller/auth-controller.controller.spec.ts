import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth-controller.controller';
import { AuthServiceService } from '../auth-service/auth-service.service';
import { UserServiceService } from '../../user-service/user-service.service';
import { AuthConfigMiddleware } from '../../auth-config-middelware/auth-config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    createAuth: jest.Mock;
    findAuthByUserRefID: jest.Mock;
    updateAuth: jest.Mock;
    deleteSelection: jest.Mock;
  };
  let userService: {
    findAllUsers: jest.Mock;
    findUserByRefId: jest.Mock;
    generateUserAuthID: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      createAuth: jest.fn(),
      findAuthByUserRefID: jest.fn(),
      updateAuth: jest.fn(),
      deleteSelection: jest.fn(),
    };
    userService = {
      findAllUsers: jest.fn().mockResolvedValue([]),
      findUserByRefId: jest.fn(),
      generateUserAuthID: jest.fn().mockResolvedValue(42),//42 to przykładowy zwracany identyfikator autoryzacji użytkownika
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthServiceService, useValue: authService },
        { provide: UserServiceService, useValue: userService },
      ],
    })
      .overrideGuard(AuthConfigMiddleware)//override the guard to always allow access during testing
      .useValue({ canActivate: () => true })//always allow access during testing
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUser', () => {
    it('returns users and an empty form model without creating an auth', async () => {
      const users = [{ userName: 'A' }];
      userService.findAllUsers.mockResolvedValue(users);

      const result = await controller.getUser();

      expect(userService.findAllUsers).toHaveBeenCalledWith(undefined, undefined);
      expect(userService.findUserByRefId).not.toHaveBeenCalled();
      expect(authService.createAuth).not.toHaveBeenCalled();//not tutaj because no auth should be created when only users are fetched
      expect(result.users).toBe(users);
      expect(result.user).toBeNull();
      expect(result.authorisation).toBeNull();
      expect(result.createAuthModel).toEqual({
        knownIpHashes: [],
        lastLoginIp: '',
        lastLoginDate: '',
        userID: expect.any(String),
        userAuthID: 42,
        name: '',
        surname: '',
        email: '',
        userRefID: '',
      });
      expect(Types.ObjectId.isValid(result.createAuthModel.userID)).toBe(true);
    });

    it('returns ipInfo when no existing auth is found', async () => {
      userService.findAllUsers.mockResolvedValue([]);
      authService.findAuthByUserRefID.mockResolvedValue(null);

      const result = await controller.getUser();

      expect(result.ipInfo).toEqual({
        lastLoginIp: null,
        lastLoginDate: null,
        knownIpCount: 0,
        ipHistory: [],
      });
    });

    it('returns the user but does not create an auth when email is missing', async () => {
      const user = { userName: 'Jan', Surname: 'Kowalski' };
      userService.findUserByRefId.mockResolvedValue(user);

      const result = await controller.getUser('ref@1');

      expect(userService.findUserByRefId).toHaveBeenCalledWith('ref@1');
      expect(authService.createAuth).not.toHaveBeenCalled();
      expect(result.user).toBe(user);
      expect(result.authorisation).toBeUndefined();
      expect(result.createAuthModel).toMatchObject({
        name: 'Jan',
        surname: 'Kowalski',
        userRefID: 'ref@1',
        email: '',
      });
    });

    it('does not create an auth when only email is given (no user lookup)', async () => {
      const result = await controller.getUser(undefined, 'a@b.com');

      expect(userService.findUserByRefId).not.toHaveBeenCalled();
      expect(authService.createAuth).not.toHaveBeenCalled();
      expect(result.user).toBeNull();
      expect(result.authorisation).toBeNull();
      expect(result.createAuthModel.email).toBe('a@b.com');
    });

    it('creates an auth when both the user and email are present', async () => {
      const user = { userName: 'Jan', Surname: 'Kowalski' };
      const created = { id: 'auth-1' };
      userService.findUserByRefId.mockResolvedValue(user);
      authService.createAuth.mockResolvedValue(created);

      const result = await controller.getUser('ref@1', 'a@b.com');

      expect(userService.findAllUsers).toHaveBeenCalledWith('ref@1', 'a@b.com');
      expect(authService.createAuth).toHaveBeenCalledWith(result.createAuthModel);
      expect(result.createAuthModel).toMatchObject({
        userAuthID: 42,
        name: 'Jan',
        surname: 'Kowalski',
        email: 'a@b.com',
        userRefID: 'ref@1',
      });
      expect(result.authorisation).toBe(created);
    });

    it('does not create an auth when the user is not found', async () => {
      userService.findUserByRefId.mockResolvedValue(null);

      const result = await controller.getUser('ref@1', 'a@b.com');//ref@1 oznacza identyfikator użytkownika przed "@",czyli część przed znakiem "@".

      expect(authService.createAuth).not.toHaveBeenCalled();
      expect(result.authorisation).toBeUndefined();
    });

    it('includes existing auth data in createAuthModel when it exists', async () => {
      const existingAuth = {
        _id: 'auth1',
        userId: new Types.ObjectId(),
        knownIpHashes: ['hash1'],
        lastLoginIp: '203.0.113.10',
        lastLoginDate: new Date('2024-01-01'),
        userAuthID: 123,
      };
      authService.findAuthByUserRefID.mockResolvedValue(existingAuth);

      const result = await controller.getUser('ref@1');

      expect(result.createAuthModel.knownIpHashes).toEqual(['hash1']);
      expect(result.createAuthModel.lastLoginIp).toBe('203.0.113.10');
      expect(result.createAuthModel.lastLoginDate).toBe(existingAuth.lastLoginDate.toString());
      expect(result.createAuthModel.userAuthID).toBe(123);
    });

    it('propagates service errors', async () => {
      userService.findAllUsers.mockRejectedValue(new Error('db down'));
      await expect(controller.getUser()).rejects.toThrow('db down');
    });
  });

  describe('getAuthTemplateCongregate', () => {
    it('returns auth, user and users data for authorized request', async () => {
      const auth = { _id: 'auth1', knownIpHashes: [] };
      const users = [{ userName: 'A' }];//[{}] oznacza przykładową listę użytkowników
      authService.findAuthByUserRefID.mockResolvedValue(auth);
      userService.findAllUsers.mockResolvedValue(users);

      const result = await controller.getAuthTemplateCongregate('ref@1', {
        user: { userRefID: 'ref@1' },
      });

      expect(result.auth).toBe(auth);
      expect(result.users).toBe(users);
      expect(result.user).toEqual({ userRefID: 'ref@1' });
      expect(result.ipInfo).toMatchObject({
        lastLoginIp: null,
        lastLoginDate: null,
        knownIpCount: 0,
      });
    });

    it('throws when userRefID does not match', async () => {
      await expect(
        controller.getAuthTemplateCongregate('ref@1', { user: { userRefID: 'other@1' } }),
      ).rejects.toThrow('You are not authorized to view this auth template.');
    });

    it('returns ipInfo from auth when available', async () => {
      const auth = {
        _id: 'auth1',
        lastLoginIp: '203.0.113.10',
        lastLoginDate: new Date('2024-01-01'),
        knownIpHashes: ['hash1', 'hash2'],
      };
      authService.findAuthByUserRefID.mockResolvedValue(auth);
      userService.findAllUsers.mockResolvedValue([]);

      const result = await controller.getAuthTemplateCongregate('ref@1', {
        user: { userRefID: 'ref@1' },
      });

      expect(result.ipInfo).toMatchObject({
        lastLoginIp: '203.0.113.10',
        lastLoginDate: auth.lastLoginDate,
        knownIpCount: 2,
        ipHistory: ['hash1', 'hash2'],
      });
    });
  });

  describe('updateAuth', () => {
    const authId = new Types.ObjectId();
    const dto = { name: 'New' } as any;

    it('throws when the user is not authorized (userRefID mismatch)', async () => {
      authService.findAuthByUserRefID.mockResolvedValue(null);

      await expect(
        controller.updateAuth(authId.toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('You are not authorized to update this auth.');
    });

    it('throws when the ID does not match auth._id', async () => {
      const auth = { _id: new Types.ObjectId(), userRefID: 'ref@1' };
      authService.findAuthByUserRefID.mockResolvedValue(auth);

      await expect(
        controller.updateAuth(new Types.ObjectId().toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('You are not authorized to update this auth.');
    });

    it('throws when trying to change userRefID to a different value', async () => {
      const auth = { _id: authId, userRefID: 'ref@1' };
      authService.findAuthByUserRefID.mockResolvedValue(auth);

      await expect(
        controller.updateAuth(authId.toString(), { userRefID: 'other@1' }, {
          user: { userRefID: 'ref@1' },
        }),
      ).rejects.toThrow('Invalid userRefID.');
    });

    it('updates auth successfully and returns the updated auth', async () => {
      const auth = { _id: authId, userRefID: 'ref@1' };
      const updated = { ...auth, name: 'New' };
      authService.findAuthByUserRefID.mockResolvedValue(auth);
      authService.updateAuth.mockResolvedValue(updated);

      const result = await controller.updateAuth(authId.toString(), dto, {
        user: { userRefID: 'ref@1', id: 1 },
      });

      expect(result.message).toBe('Update successful.');
      expect(result.updatedAuth).toBe(updated);
      expect(result.user).toEqual({ userRefID: 'ref@1', id: 1 });
      expect(authService.updateAuth).toHaveBeenCalledWith(authId.toString(), dto);
    });

    it('returns failure message when update returns null', async () => {
      const auth = { _id: authId, userRefID: 'ref@1' };
      authService.findAuthByUserRefID.mockResolvedValue(auth);
      authService.updateAuth.mockResolvedValue(null);

      const result = await controller.updateAuth(authId.toString(), dto, {
        user: { userRefID: 'ref@1' },
      });

      expect(result.message).toBe('Update failed.');
    });

    it('propagates service errors after authorization check', async () => {
      const auth = { _id: authId, userRefID: 'ref@1' };
      authService.findAuthByUserRefID.mockResolvedValue(auth);
      authService.updateAuth.mockRejectedValue(new Error('db error'));

      await expect(
        controller.updateAuth(authId.toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('db error');
    });
  });

  describe('deleteAuth', () => {
    const authId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const dto = { userAuthID: 7, userId } as any;

    it('throws when the user is not authorized', async () => {
      authService.findAuthByUserRefID.mockResolvedValue(null);

      await expect(
        controller.deleteAuth(authId.toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('You are not authorized to delete this auth.');
    });

    it('throws when the ID does not match auth._id', async () => {
      const auth = { _id: new Types.ObjectId(), userRefID: 'ref@1', userAuthID: 7, userId };
      authService.findAuthByUserRefID.mockResolvedValue(auth);

      await expect(
        controller.deleteAuth(authId.toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('You are not authorized to delete this auth.');
    });

    it('throws when selection data (userAuthID) does not match', async () => {
      const auth = { _id: authId, userRefID: 'ref@1', userAuthID: 99, userId };
      authService.findAuthByUserRefID.mockResolvedValue(auth);

      await expect(
        controller.deleteAuth(authId.toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('The selection does not match your auth data.');
    });

    it('throws when selection data (userId) does not match', async () => {
      const auth = { _id: authId, userRefID: 'ref@1', userAuthID: 7, userId: new Types.ObjectId() };
      authService.findAuthByUserRefID.mockResolvedValue(auth);

      await expect(
        controller.deleteAuth(authId.toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('The selection does not match your auth data.');
    });

    it('deletes auth successfully', async () => {
      const auth = { _id: authId, userRefID: 'ref@1', userAuthID: 7, userId };
      const deleted = { deletionResult: true };
      authService.findAuthByUserRefID.mockResolvedValue(auth);
      authService.deleteSelection.mockResolvedValue(deleted);

      const result = await controller.deleteAuth(authId.toString(), dto, {
        user: { userRefID: 'ref@1' },
      });

      expect(result.message).toBe('Deletion successful.');
      expect(result.authToDelete).toBe(deleted);
      expect(authService.deleteSelection).toHaveBeenCalledWith({
        userAuthID: 7,
        userId,
      });
    });

    it('propagates service errors after authorization check', async () => {
      const auth = { _id: authId, userRefID: 'ref@1', userAuthID: 7, userId };
      authService.findAuthByUserRefID.mockResolvedValue(auth);
      authService.deleteSelection.mockRejectedValue(new Error('db error'));

      await expect(
        controller.deleteAuth(authId.toString(), dto, { user: { userRefID: 'ref@1' } }),
      ).rejects.toThrow('db error');
    });
  });

  describe('createAuth', () => {
    const dto = {
      knownIpHashes: [],
      lastLoginIp: '',
      lastLoginDate: '',
      userID: new Types.ObjectId().toString(),
      userAuthID: 1,
      name: 'Test',
      surname: 'User',
      email: 'test@example.com',
      userRefID: 'ref@1',
    };

    it('creates an auth for an authenticated request', async () => {
      const created = { id: 'auth-1' };
      authService.createAuth.mockResolvedValue(created);

      await expect(controller.createAuth(dto, { user: { id: 1 } })).resolves.toEqual({
        message: 'Creation successful.',
        createdAuth: created,
      });
      expect(authService.createAuth).toHaveBeenCalledWith(dto);
    });

    it('does not create an auth for an unauthenticated request', async () => {
      const result = await controller.createAuth(dto, {});

      expect(authService.createAuth).not.toHaveBeenCalled();
      expect(result.createdAuth).toBeUndefined();
    });

    it('propagates service errors', async () => {
      authService.createAuth.mockRejectedValue(new Error('db down'));
      await expect(controller.createAuth(dto, { user: {} })).rejects.toThrow('db down');
    });
  });
});
