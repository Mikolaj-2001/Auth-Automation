import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AuthController } from './auth-controller.controller';
import { AuthServiceService } from '../auth-service/auth-service.service';
import { UserServiceService } from '../../user-service/user-service.service';
import { AuthConfigMiddleware } from '../../auth-config-middelware/auth-config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    createAuth: jest.Mock;
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
      updateAuth: jest.fn(),
      deleteSelection: jest.fn(),
    };
    userService = {
      findAllUsers: jest.fn().mockResolvedValue([]),
      findUserByRefId: jest.fn(),
      generateUserAuthID: jest.fn().mockResolvedValue(42),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthServiceService, useValue: authService },
        //  { provide: AuthService, useValue: authService },
        { provide: UserServiceService, useValue: userService },
      ],
    })
      .overrideGuard(AuthConfigMiddleware)
      .useValue({ canActivate: () => true })
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
      expect(authService.createAuth).not.toHaveBeenCalled();
      expect(result.users).toBe(users);
      expect(result.user).toBeNull();
      expect(result.authorisation).toBeNull();
      expect(result.createAuthModel).toEqual({
        userID: expect.any(String),
        userAuthID: 42,
        name: '',
        surname: '',
        email: '',
        userRefID: '',
      });
      expect(Types.ObjectId.isValid(result.createAuthModel.userID)).toBe(true);
    });

    it('returns the user but does not create an auth when email is missing', async () => {
      const user = { userName: 'Jan', Surname: 'Kowalski' };
      userService.findUserByRefId.mockResolvedValue(user);

      const result = await controller.getUser('ref@1');

      expect(userService.findUserByRefId).toHaveBeenCalledWith('ref@1');
      expect(authService.createAuth).not.toHaveBeenCalled();
      expect(result.user).toBe(user);
      expect(result.authorisation).toBeNull();
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
      expect(result.authorisation).toBeNull();
    });

    it('propagates service errors', async () => {
      userService.findAllUsers.mockRejectedValue(new Error('db down'));
      await expect(controller.getUser()).rejects.toThrow('db down');
    });
  });

  describe('updateAuth', () => {
    const dto = { name: 'New' } as any;

    it('returns a message when the id is missing', async () => {
      await expect(controller.updateAuth('', dto, {})).resolves.toEqual({
        message: 'Lack of required ID.',
      });
      expect(authService.updateAuth).not.toHaveBeenCalled();
    });

    it('returns a failure message when nothing was updated', async () => {
      authService.updateAuth.mockResolvedValue(null);

      await expect(controller.updateAuth('1', dto, { user: {} })).resolves.toEqual({
        message: 'Update failed.',
      });
      expect(authService.updateAuth).toHaveBeenCalledWith('1', dto);
    });

    it('returns the updated auth together with its user', async () => {
      const updated = { userID: 'ref@1' };
      const user = { userName: 'Jan' };
      authService.updateAuth.mockResolvedValue(updated);
      userService.findUserByRefId.mockResolvedValue(user);

      await expect(controller.updateAuth('1', dto, { user: { id: 1 } })).resolves.toEqual({
        message: 'Update successful.',
        updatedAuth: updated,
        user,
      });
      expect(userService.findUserByRefId).toHaveBeenCalledWith('ref@1');
    });

    it('skips the user lookup when the request is not authenticated', async () => {
      authService.updateAuth.mockResolvedValue({ userID: 'ref@1' });

      const result: any = await controller.updateAuth('1', dto, {});

      expect(userService.findUserByRefId).not.toHaveBeenCalled();
      expect(result.user).toBeUndefined();
    });

    it('returns a null user when the updated auth has no userID', async () => {
      authService.updateAuth.mockResolvedValue({});

      const result: any = await controller.updateAuth('1', dto, { user: {} });

      expect(userService.findUserByRefId).not.toHaveBeenCalled();
      expect(result.user).toBeNull();
    });

    it('propagates service errors', async () => {
      authService.updateAuth.mockRejectedValue(new Error('boom'));
      await expect(controller.updateAuth('1', dto, { user: {} })).rejects.toThrow('boom');
    });
  });

  describe('deleteAuth', () => {
    const userId = new Types.ObjectId();
    const dto = { userAuthID: 7, userId } as any;

    it('returns a message when neither id nor selection is given', async () => {
      await expect(
        controller.deleteAuth('', {} as any, { user: {} }),
      ).resolves.toEqual({ message: 'Lack of required ID or selection to delete the user.' });
      expect(authService.deleteSelection).not.toHaveBeenCalled();
    });

    it('deletes the selection and returns the user', async () => {
      const user = { userName: 'Jan' };
      authService.deleteSelection.mockResolvedValue({ deletionResult: true });
      userService.findUserByRefId.mockResolvedValue(user);

      await expect(controller.deleteAuth('1', dto, { user: {} })).resolves.toEqual({
        message: 'Deletion successful.',
        authToDelete: { deletionResult: true },
        user,
      });
      expect(authService.deleteSelection).toHaveBeenCalledWith({
        userAuthID: 7,
        userId,
      });
      expect(userService.findUserByRefId).toHaveBeenCalledWith(userId.toString());
    });

    it('works with only a selection and no id', async () => {
      authService.deleteSelection.mockResolvedValue({ deletionResult: true });

      const result: any = await controller.deleteAuth('', dto, { user: {} });

      expect(authService.deleteSelection).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Deletion successful.');
    });

    it('skips the user lookup when the request is not authenticated', async () => {
      authService.deleteSelection.mockResolvedValue({ deletionResult: true });

      const result: any = await controller.deleteAuth('1', dto, {});

      expect(userService.findUserByRefId).not.toHaveBeenCalled();
      expect(result.user).toBeUndefined();
    });

    it('returns a null user when the selection has no userId', async () => {
      authService.deleteSelection.mockResolvedValue({ deletionResult: true });

      const result: any = await controller.deleteAuth('1', { userAuthID: 7 } as any, {
        user: {},
      });

      expect(userService.findUserByRefId).not.toHaveBeenCalled();
      expect(result.user).toBeNull();
    });

    it('propagates the failure when the deletion fails', async () => {
      authService.deleteSelection.mockRejectedValue(new Error('Selection deletion failed'));

      await expect(controller.deleteAuth('1', dto, { user: {} })).rejects.toThrow(
        'Selection deletion failed',
      );
    });
  });

  describe('createAuth', () => {
    const dto = {
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
