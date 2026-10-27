import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuthServiceService } from './auth-service.service';
import { UserServiceService } from '../../user-service/user-service.service';
import { User } from '../../user-schema/user.schema';
import { DataAuth } from '../../authData-schema/dataAuth.schema';

const VALID_ID = '507f1f77bcf86cd799439011';

const execResolving = (value: unknown) => ({ exec: jest.fn().mockResolvedValue(value) });// helper to mock Mongoose exec() calls

const makeUser = (email: string, password: string, extra: Record<string, unknown> = {}) => ({
  _id: VALID_ID,
  userName: 'Test',
  Surname: 'User',
  userRefID: `${VALID_ID}@1`,
  getDecryptedEmail: jest.fn(() => email),
  getDecryptedPassword: jest.fn(() => password),
  ...extra,
});

describe('AuthServiceService', () => {
  let service: AuthServiceService;
  let saveAuth: jest.Mock;
  let dataAuthModel: jest.Mock & {
    findById: jest.Mock;
    findOne: jest.Mock;
    deleteOne: jest.Mock;
  };
  let userModel: Record<string, jest.Mock>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    saveAuth = jest.fn();
    dataAuthModel = Object.assign(
      jest.fn((data: unknown) => ({ data, save: saveAuth })),
      { findById: jest.fn(), findOne: jest.fn(), deleteOne: jest.fn() },
    );
    userModel = { find: jest.fn(), findById: jest.fn(), findOne: jest.fn(), deleteOne: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() };
    configService = {
      get: jest.fn((key: string) => (key === 'JWT_AUTH_TOKEN' ? 'secret' : undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthServiceService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: UserServiceService, useValue: {} },
        { provide: getModelToken(User.name), useValue: userModel },//tutaj podajemy model użytkownika dla testów
        { provide: getModelToken(DataAuth.name), useValue: dataAuthModel },
      ],
    }).compile();

    service = module.get<AuthServiceService>(AuthServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAuth', () => {
    const dto = {
      userAuthID: 1,
      userID: VALID_ID,
      name: 'Test',
      surname: 'User',
      email: 'test@example.com',
      userRefID: `${VALID_ID}@1`,
    };

    it('maps the DTO to the DataAuth schema and saves it', async () => {
      saveAuth.mockResolvedValue({ id: 1, name: 'Test Auth' });

      await expect(service.createAuth(dto)).resolves.toEqual({ id: 1, name: 'Test Auth' });

      expect(dataAuthModel).toHaveBeenCalledWith({
        userId: new Types.ObjectId(VALID_ID),
        userAuthID: 1,
        name: 'Test',
        email: 'test@example.com',
        userRefID: `${VALID_ID}@1`,
      });
      expect(saveAuth).toHaveBeenCalledTimes(1);
    });

    it('propagates save errors', async () => {
      saveAuth.mockRejectedValue(new Error('db down'));
      await expect(service.createAuth(dto)).rejects.toThrow('db down');
    });

    it('rejects an invalid userID', async () => {
      await expect(service.createAuth({ ...dto, userID: 'not-an-id' })).rejects.toThrow();
      expect(saveAuth).not.toHaveBeenCalled();
    });
  });

  describe('findAuthByUserRefID', () => {
    it('looks the document up by the id before "@"', async () => {
      const doc = { id: 'doc' };
      dataAuthModel.findById.mockReturnValue(execResolving(doc));

      await expect(service.findAuthByUserRefID(`${VALID_ID}@5`)).resolves.toBe(doc);
      expect(dataAuthModel.findById).toHaveBeenCalledWith(VALID_ID);
    });

    it.each([[''], ['abc@1'], ['@1']])('returns null for %p', async (ref) => {//[''] oznacza pusty string
      await expect(service.findAuthByUserRefID(ref)).resolves.toBeNull();
      expect(dataAuthModel.findById).not.toHaveBeenCalled();
    });

    it('returns null for undefined input', async () => {
      await expect(service.findAuthByUserRefID(undefined as any)).resolves.toBeNull();
    });
  });

  describe('findUserByAuthIDAndEmail', () => {
    it('queries by userAuthID or email', async () => {
      const doc = { id: 'doc' };
      dataAuthModel.findOne.mockReturnValue(execResolving(doc));

      await expect(service.findUserByAuthIDAndEmail(7, 'a@b.com')).resolves.toBe(doc);
      expect(dataAuthModel.findOne).toHaveBeenCalledWith({
        $or: [{ userAuthID: 7 }, { email: 'a@b.com' }],
      });
    });

    it('returns null when nothing matches', async () => {
      dataAuthModel.findOne.mockReturnValue(execResolving(null));
      await expect(service.findUserByAuthIDAndEmail(1, 'x@y.com')).resolves.toBeNull();
    });
  });

  describe('validateCredentials', () => {
    it('returns the user when email and password match', async () => {
      const user = makeUser('a@b.com', 'secret123');
      userModel.find.mockResolvedValue([makeUser('other@b.com', 'x'), user]);

      await expect(service.validateCredentials('a@b.com', 'secret123')).resolves.toBe(user);
    });

    it('throws when the password is wrong', async () => {
      userModel.find.mockResolvedValue([makeUser('a@b.com', 'secret123')]);
      await expect(service.validateCredentials('a@b.com', 'secret124')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when the password length differs', async () => {
      userModel.find.mockResolvedValue([makeUser('a@b.com', 'secret123')]);
      await expect(service.validateCredentials('a@b.com', 'short')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when the user does not exist', async () => {
      userModel.find.mockResolvedValue([makeUser('other@b.com', 'x')]);
      await expect(service.validateCredentials('a@b.com', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when the stored password cannot be decrypted', async () => {
      const user = makeUser('a@b.com', '', {
        getDecryptedPassword: jest.fn(() => {
          throw new Error('bad key');
        }),
      });
      userModel.find.mockResolvedValue([user]);
      await expect(service.validateCredentials('a@b.com', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws for an undefined password even when the stored one is empty', async () => {
      userModel.find.mockResolvedValue([makeUser('a@b.com', '')]);
      await expect(service.validateCredentials('a@b.com', undefined as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('skips users whose email cannot be decrypted', async () => {
      const broken = makeUser('x', 'x', {
        getDecryptedEmail: jest.fn(() => {
          throw new Error('bad key');
        }),
      });
      const user = makeUser('a@b.com', 'pw');
      userModel.find.mockResolvedValue([broken, user]);

      await expect(service.validateCredentials('a@b.com', 'pw')).resolves.toBe(user);
    });
  });

  describe('generateJwtToken', () => {
    let res: { cookie: jest.Mock };

    beforeEach(() => {
      res = { cookie: jest.fn() };
    });

    it('signs a token and stores it in an httpOnly cookie', async () => {
      const user = makeUser('a@b.com', 'pw');
      userModel.find.mockResolvedValue([user]);

      await service.generateJwtToken('a@b.com', res as any);

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          id: user._id,
          userName: user.userName,
          surname: user.Surname,
          userRefID: user.userRefID,
        },
        expect.objectContaining({
          secret: 'secret',
          algorithm: 'HS256',
          issuer: 'auth-automation',
          audience: 'auth-automation-client',
          expiresIn: '1h',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'jwt',
        'signed-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict', maxAge: 3600000 }),
      );
    });

    it('uses the configured expiration time', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'JWT_AUTH_TOKEN_EXPIRES_IN' ? '15m' : 'secret',
      );
      userModel.find.mockResolvedValue([makeUser('a@b.com', 'pw')]);//pw oznacza hasło użytkownika

      await service.generateJwtToken('a@b.com', res as any);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });

    it('throws and sets no cookie when the user does not exist', async () => {
      userModel.find.mockResolvedValue([]);

      await expect(service.generateJwtToken('nobody@b.com', res as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('returns the decoded payload for a valid token of an existing user', async () => {
      const decoded = { id: VALID_ID };
      jwtService.verify.mockReturnValue(decoded);
      userModel.findById.mockResolvedValue({ _id: VALID_ID });

      await expect(service.verifyToken('token')).resolves.toBe(decoded);
      expect(jwtService.verify).toHaveBeenCalledWith('token', {
        secret: 'secret',
        algorithms: ['HS256'],
        issuer: 'auth-automation',
        audience: 'auth-automation-client',
        clockTolerance: 8,
      });
      expect(userModel.findById).toHaveBeenCalledWith(VALID_ID);
    });

    it('throws a generic 401 when verification fails', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = service.verifyToken('token');
      await expect(result).rejects.toThrow(UnauthorizedException);
      await expect(result).rejects.toThrow('Invalid token');
    });

    it('throws a generic 401 when the user no longer exists', async () => {
      jwtService.verify.mockReturnValue({ id: VALID_ID });
      userModel.findById.mockResolvedValue(null);

      await expect(service.verifyToken('token')).rejects.toThrow('Invalid token');
    });
  });

  describe('deleteSelection', () => {
    const dto = { userAuthID: 1, userId: VALID_ID } as any;

    it('deletes by userAuthID and userId', async () => {
      dataAuthModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await expect(service.deleteSelection(dto)).resolves.toEqual({ deletionResult: true });
      expect(dataAuthModel.deleteOne).toHaveBeenCalledWith({
        userAuthID: 1,
        userId: VALID_ID,
      });
    });

    it('throws when nothing was deleted', async () => {
      dataAuthModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(service.deleteSelection(dto)).rejects.toThrow('Selection deletion failed');
    });
  });

  describe('deleteUser', () => {
    const dto = { userAuthID: 1, userId: VALID_ID } as any;

    it('returns early without touching users when the selection was deleted', async () => {
      dataAuthModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await expect(service.deleteUser('a@b.com', 1, dto)).resolves.toBeUndefined();
      expect(userModel.findOne).not.toHaveBeenCalled();
      expect(userModel.deleteOne).not.toHaveBeenCalled();
    });

    it('propagates the failure when the selection could not be deleted', async () => {
      dataAuthModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(service.deleteUser('a@b.com', 1, dto)).rejects.toThrow(
        'Selection deletion failed',
      );
    });
  });
});
