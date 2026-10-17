import {
  Module,
  MiddlewareConsumer,
  NestModule,
  forwardRef,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserServiceService } from '../user-service/user-service.service';
import { User, UserSchema } from '../user-schema/user.schema';
import { DataAuth, DataAuthSchema } from '../authData-schema/dataAuth.schema';
import { PersonalIDService } from '../userDto/userRegistered.dto';
import { JwtModule } from '@nestjs/jwt';
import { AuthConfigMiddleware } from '../auth-config-middelware/auth-config';
import { AuthModule } from '../auth-module/auth-module.module';
import { LeakServiceGuard } from '../authLeakDetection/leak-service.guard';


@Module({
  imports: [
    // Modele wymagane przez UserServiceService
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DataAuth.name, schema: DataAuthSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: /* Wstrzykuje zależność */(cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_AUTH_TOKEN'),
        signOptions: { expiresIn: (cfg.get<string>('JWT_AUTH_TOKEN_EXPIRES_IN') || '1h') as any },
      }),
      inject: [ConfigService],/* Wstrzykiwanie listy zależności jako argument danej funkcji */
    }),
    // AuthConfigMiddleware potrzebuje AuthServiceService i AuthGuard z AuthModule (zależność cykliczna)
    forwardRef(() => AuthModule),
  ],
  // ConfigService pochodzi z globalnego ConfigModule, a User jest schematem, a nie providerem
  providers: [UserServiceService, PersonalIDService, LeakServiceGuard],
  exports: [UserServiceService, PersonalIDService, JwtModule, LeakServiceGuard],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthConfigMiddleware).exclude(
      'user/register',
      'user/login'
    ).forRoutes(
      { path: 'user/*path', method: RequestMethod.ALL }
    );
  }
}
