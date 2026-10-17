import { Test, TestingModule } from '@nestjs/testing';
import { LeakControllerController } from './leak-controller.controller';

describe('LeakControllerController', () => {
  let controller: LeakControllerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeakControllerController],
    }).compile();

    controller = module.get<LeakControllerController>(LeakControllerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
