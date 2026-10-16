import { IsNotEmpty, IsNumber } from 'class-validator';

export class UserLoggingIn {
  userName: string = '';
  @IsNotEmpty()
  @IsNumber()
  readonly userAuthID: number = 0;
  email: string = '';
  password: string = '';
}
