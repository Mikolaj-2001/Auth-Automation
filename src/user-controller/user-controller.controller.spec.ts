import { Test, TestingModule } from '@nestjs/testing';
import { UserControllerController } from './user-controller.controller';
import { UserServiceService } from '../user-service/user-service.service';
import { AuthServiceService } from '../authentication/auth-service/auth-service.service';
import { PersonalIDService } from '../userDto/userRegistered.dto';
import { Response, Request } from 'express';
import { Types } from 'mongoose';
import { LeakServiceGuard } from '../authLeakDetection/leak-service.guard';
import { AuthConfigMiddleware } from '../auth-config-middelware/auth-config';
import { AuthGuard } from '../authentication/auth-guard/auth-guard';

describe('UserControllerController', () => {
  let controller: UserControllerController;
  let userService: {
    createUser: jest.Mock;
    personalIDInfo: jest.Mock;
  };
  let authService: {
    validateCredentials: jest.Mock;
    findUserByAuthIDAndEmail: jest.Mock;
    registerNewIp: jest.Mock;
    generateJwtToken: jest.Mock;
    findAuthByUserRefID: jest.Mock;
    deleteUser: jest.Mock;
  };
  let personalIDService: {
    registerPersonalID: jest.Mock;
    getUserPersonalID: jest.Mock;
  };

  beforeEach(async () => {
    userService = {
      createUser: jest.fn(),
      personalIDInfo: jest.fn(),
    };
    authService = {
      validateCredentials: jest.fn(),
      findUserByAuthIDAndEmail: jest.fn(),
      registerNewIp: jest.fn(),
      generateJwtToken: jest.fn(),
      findAuthByUserRefID: jest.fn(),
      deleteUser: jest.fn(),
    };
    personalIDService = {
      registerPersonalID: jest.fn(),
      getUserPersonalID: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserControllerController],
      providers: [
        { provide: UserServiceService, useValue: userService },
        { provide: AuthServiceService, useValue: authService },
        { provide: PersonalIDService, useValue: personalIDService },
      ],
    })
      .overrideGuard(LeakServiceGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthConfigMiddleware)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard)//override AuthGuard to always allow access
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserControllerController>(UserControllerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('newRegistering', () => {
    let res: any;
    let req: any;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        render: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
      };
      req = {
        ip: '127.0.0.1',
      };
    });

    it('should reject when passwords do not match', async () => {
      const body = {
        userName: 'test',
        Surname: 'user',
        email: 'test@example.com',
        password: 'pass123',
        confirmPassword: 'pass124',
        PersonalID: 12345,
      };

      await controller.newRegistering(body, req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith(
        'PageView/userRegisteringForm',
        expect.objectContaining({
          error: 'Passwords do not match.',
        }),
      );
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    it('should reject when PersonalID is not a number', async () => {
      const body = {
        userName: 'test',
        Surname: 'user',
        email: 'test@example.com',
        password: 'pass123',
        confirmPassword: 'pass123',
        PersonalID: 'not-a-number' as unknown as number,
      };

      await controller.newRegistering(body, req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith(
        'PageView/userRegisteringForm',
        expect.objectContaining({
          error: 'Personal ID must be a number.',
        }),
      );
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    it('should successfully register a user', async () => {
      const body = {
        userName: 'testUser',
        Surname: 'testSurname',
        email: 'test@example.com',
        password: 'pass123',
        confirmPassword: 'pass123',
        PersonalID: 12345,
      };

      userService.createUser.mockResolvedValue({ _id: 'user1' });

      await controller.newRegistering(body, req, res);

      expect(personalIDService.registerPersonalID).toHaveBeenCalledWith(12345);
      expect(userService.createUser).toHaveBeenCalledWith(
        {
          userName: 'testUser',
          Surname: 'testSurname',
          email: 'test@example.com',
          password: 'pass123',
        },
        expect.objectContaining({
          Name: 'testUser',
          email: 'test@example.com',
        }),
        12345,
      );
      expect(res.redirect).toHaveBeenCalledWith(303, '/user/login');
    });

    it('should handle registration errors', async () => {
      const body = {
        userName: 'testUser',
        Surname: 'testSurname',
        email: 'test@example.com',
        password: 'pass123',
        confirmPassword: 'pass123',
        PersonalID: 12345,
      };

      userService.createUser.mockRejectedValue(new Error('DB error'));

      await controller.newRegistering(body, req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith(
        'PageView/userRegisteringForm',
        expect.objectContaining({
          error: 'DB error',
        }),
      );
    });
  });

  describe('getLastPersonalID', () => {
    it('returns success with lastPersonalID', async () => {
      userService.personalIDInfo.mockReturnValue(12345);

      const result = await controller.getLastPersonalID();

      expect(result).toEqual({
        success: true,
        lastPersonalID: 12345,
        message: 'Personal ID retrieved successfully',
      });
    });

    it('returns failure when no PersonalID found', async () => {
      userService.personalIDInfo.mockReturnValue(null);

      const result = await controller.getLastPersonalID();

      expect(result).toEqual({
        success: false,
        lastPersonalID: null,
        message: 'No Personal ID found',
      });
    });
  });

  describe('showRegistrationForm', () => {
    it('returns empty user form', async () => {
      const result = await controller.showRegistrationForm();

      expect(result).toEqual({
        user: {
          userName: '',
          Surname: '',
          email: '',
          PersonalID: '',
        },
      });
    });
  });

  describe('showLoginForm', () => {
    it('returns empty email form', async () => {
      const result = await controller.showLoginForm();

      expect(result).toEqual({
        user: {
          email: '',
        },
      });
    });
  });

  describe('loginUser', () => {
    let res: any;
    let req: any;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        render: jest.fn().mockReturnThis(),
      };
      req = {
        ip: '127.0.0.1',
        socket: {
          remoteAddress: '127.0.0.1',
        },
      };
    });

    it('should successfully log in a user', async () => {
      const loginData = {
        userName: 'testUser',
        email: 'test@example.com',
        password: 'pass123',
        userAuthID: 123,
      };

      const user = {
        userRefID: 'auth1@1',
        toObject: jest.fn().mockReturnValue({ userName: 'testUser' }),
      };
      const authData = {
        _id: 'auth1',
        userAuthID: 123,
        toObject: jest.fn().mockReturnValue({ userAuthID: 123 }),
      };

      authService.validateCredentials.mockResolvedValue(user);
      authService.findUserByAuthIDAndEmail.mockResolvedValue(authData);
      authService.registerNewIp.mockResolvedValue({ ipIdentifier: 'ip-hash' });

      await controller.loginUser(loginData, req as any, res);

      expect(authService.validateCredentials).toHaveBeenCalledWith('test@example.com', 'pass123');
      expect(authService.registerNewIp).toHaveBeenCalled();
      expect(authService.generateJwtToken).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith(
        'PageView/userAuthTemplate',
        expect.objectContaining({
          email: 'test@example.com',
        }),
      );
    });

    it('should reject when credentials are invalid', async () => {
      const loginData = {
        userName: 'testUser',
        email: 'test@example.com',
        password: 'wrongpass',
        userAuthID: 123,
      };

      authService.validateCredentials.mockRejectedValue(new Error('Invalid credentials'));

      await controller.loginUser(loginData, req as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith(
        'PageView/userLogIn',
        expect.objectContaining({
          error: 'Invalid credentials',
        }),
      );
    });

    it('should reject when auth data does not belong to user', async () => {
      const loginData = {
        userName: 'testUser',
        email: 'test@example.com',
        password: 'pass123',
        userAuthID: 123,
      };

      const user = {
        userRefID: 'different-auth@1',
      };
      const authData = {
        _id: 'auth1',
      };

      authService.validateCredentials.mockResolvedValue(user);
      authService.findUserByAuthIDAndEmail.mockResolvedValue(authData);

      await controller.loginUser(loginData, req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.render).toHaveBeenCalledWith(
        'PageView/userLogIn',
        expect.objectContaining({
          error: expect.stringContaining('Invalid email, auth ID or password'),
        }),
      );
    });
  });

  describe('logout', () => {
    it('should clear JWT cookie and redirect', async () => {
      const res = {
        clearCookie: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
      };

      await controller.logout(res as any);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'jwt',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(303, '/user/login');
    });

    it('should handle logout errors', async () => {
      const res = {
        clearCookie: jest.fn().mockImplementation(() => {
          throw new Error('Clear cookie failed');
        }),
      };

      await expect(controller.logout(res as any)).rejects.toThrow('Clear cookie failed');
    });
  });

  describe('deleteUser', () => {
    let res: any;
    let req: any;

    beforeEach(() => {
      res = {
        redirect: jest.fn().mockReturnThis(),
      };
      req = {
        user: {
          id: new Types.ObjectId().toString(),
          userRefID: 'ref@1',
        },
      };
    });

    it('should successfully delete a user', async () => {
      const authData = {
        email: 'test@example.com',
        userAuthID: 123,
        userId: new Types.ObjectId(),
      };

      authService.findAuthByUserRefID.mockResolvedValue(authData);

      await controller.deleteUser(req.user.id, res, req);

      expect(authService.findAuthByUserRefID).toHaveBeenCalledWith('ref@1');
      expect(authService.deleteUser).toHaveBeenCalledWith(
        'test@example.com',
        123,
        expect.objectContaining({
          userAuthID: 123,
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(303, '/user/register');
    });

    it('should reject when user ID does not match', async () => {
      req.user.id = new Types.ObjectId().toString();
      const differentId = new Types.ObjectId().toString();

      await expect(
        controller.deleteUser(differentId, res, req),
      ).rejects.toThrow('You are not authorized to delete this user.');
      expect(authService.deleteUser).not.toHaveBeenCalled();
    });

    it('should reject when auth data is not found', async () => {
      authService.findAuthByUserRefID.mockResolvedValue(null);

      await expect(
        controller.deleteUser(req.user.id, res, req),
      ).rejects.toThrow('Auth data of this user was not found.');
    });
  });
});
