import { forwardRef, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthControllerController, AuthController } from '../authentication/auth-controller/auth-controller.controller';
import { User, UserSchema } from '../user-schema/user.schema';
import { DataAuth, DataAuthSchema } from '../authData-schema/dataAuth.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user-module/userModule.module';
import { AuthServiceService } from '../authentication/auth-service/auth-service.service';
import { AuthGuard } from '../authentication/auth-guard/auth-guard';
import { LeakServiceGuard } from '../authLeakDetection/leak-service.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DataAuth.name, schema: DataAuthSchema },
    ]),
    forwardRef(() => UserModule),
  ],
  controllers: [AuthControllerController, AuthController],
  providers: [AuthServiceService, AuthGuard, LeakServiceGuard],
  exports: [AuthServiceService, AuthGuard, LeakServiceGuard, MongooseModule]
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply().forRoutes(
      { path: 'auth/*path', method: RequestMethod.ALL }
    );
  }
}
