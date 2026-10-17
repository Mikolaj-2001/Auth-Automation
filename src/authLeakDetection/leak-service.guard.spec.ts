import { Test, TestingModule } from '@nestjs/testing';
import { LeakServiceGuard } from './leak-service.guard';

describe('LeakServiceGuard', () => {
  let service: LeakServiceGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeakServiceGuard],
    }).compile();

    service = module.get<LeakServiceGuard>(LeakServiceGuard);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
