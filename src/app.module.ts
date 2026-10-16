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

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    UserModule,
    AuthModule,
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/auth-automation'),
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController, UserControllerController],
  providers: [AppService, UserServiceService],
})
export class AppModule { }
