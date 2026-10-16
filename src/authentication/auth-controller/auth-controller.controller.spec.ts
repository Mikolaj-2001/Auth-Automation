import { Test, TestingModule } from '@nestjs/testing';
import { AuthControllerController } from './auth-controller.controller';

describe('AuthControllerController', () => {
  let controller: AuthControllerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthControllerController],
    }).compile();

    controller = module.get<AuthControllerController>(AuthControllerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
