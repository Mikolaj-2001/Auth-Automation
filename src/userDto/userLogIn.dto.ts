import { IsNotEmpty, IsNumber } from 'class-validator';

export class UserLoggingIn {
  @IsNotEmpty()
  userName: string = '';
  @IsNotEmpty()
  @IsNumber()
  readonly userAuthID: number = 0;
  @IsNotEmpty()
  email: string = '';
  @IsNotEmpty()
  password: string = '';
}
