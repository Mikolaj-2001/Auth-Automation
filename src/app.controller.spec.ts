import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('getAppInfo should return app metadata', () => {
      const result = appService.getAppInfo();
      expect(result).toMatchObject({
        name: 'Auth Automation',
        version: expect.any(String),
        description: expect.any(String),
      });
      expect(result.name).toBe('Auth Automation');
    });

    it('getWelcomeMessage should return a greeting string', () => {
      const result = appService.getWelcomeMessage();
      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
      expect(result).toContain('uwierzytelniania');
    });

    it('AppService methods should return strings', () => {
      const info = appService.getAppInfo();
      const message = appService.getWelcomeMessage();
      expect(typeof info.description).toBe('string');
      expect(typeof message).toBe('string');
    });
  });
});
