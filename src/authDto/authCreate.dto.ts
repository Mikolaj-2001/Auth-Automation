import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsMongoId,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class AuthCreateDto {
  @IsMongoId()
  readonly userID!: string;

  @IsInt()
  @Min(1_000_000_000_000_000, {
    message: 'userAuthID must be at least 16 digits',
  })
  @Max(9_007_199_254_740_991, {
    message: 'userAuthID must be at most 16 digits',
  })
  @IsNotEmpty()
  readonly userAuthID!: number;

  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @IsString()
  @IsNotEmpty()
  readonly surname!: string;

  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @IsString()
  @IsNotEmpty()
  readonly userRefID!: string;
}
