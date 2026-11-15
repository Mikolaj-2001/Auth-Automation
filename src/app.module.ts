import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserServiceService } from './user-service/user-service.service';
import { UserModule } from './user-module/userModule.module';
import { AuthModule } from './auth-module/auth-module.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UserControllerController } from './user-controller/user-controller.controller';
import { LeakServiceGuard } from './authLeakDetection/leak-service.guard';

const { ObserveModule, ObserveInstrument } = createObserveModule();
export { ObserveModule, ObserveInstrument };// eksportuje moduł obserwacji i instrumentacji aby można go było używać w innych częściach aplikacji NestJS

@Module({
  imports: [
    UserModule,
    AuthModule,
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/auth-automation'),
    ConfigModule.forRoot({ isGlobal: true }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY || '',// klucz aplikacji do modułu obserwacji,czyli identyfikator aplikacji w systemie obserwacji
      appSecret: process.env.OBSERVE_APP_SECRET || '',// sekret aplikacji do modułu obserwacji, używany do uwierzytelniania aplikacji w systemie obserwacji
      serviceId: process.env.OBSERVE_SERVICE_ID || '',// identyfikator usługi w systemie obserwacji, pozwala na śledzenie konkretnej usługi w aplikacji
    }),
  ],
  controllers: [AppController, UserControllerController],
  providers: [AppService, UserServiceService, LeakServiceGuard],
  exports: [LeakServiceGuard],
})
export class AppModule { }
