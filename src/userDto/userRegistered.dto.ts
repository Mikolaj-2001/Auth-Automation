import { SchemaFactory } from '@nestjs/mongoose';
import {
  IsString,
  IsEmail,
  IsStrongPassword,
  IsNotEmpty,
  IsNumber,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'MatchPassword', async: false })
class MatchPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    return value === (args.object as { password?: unknown }).password;
  }//tutaj odbywa się walidacja, czy confirmPassword zgadza się z password,które użytkownik wprowadził
}//ValidatorConstraint służy do sprawdzania, czy confirmPassword zgadza się z password, które użytkownik wprowadził

export class UserNewLoginDTO {
  @IsNotEmpty()
  @IsString()
  userName!: string;

  @IsNotEmpty()
  @IsString()
  Surname!: string;

  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsNumber()
  PersonalID!: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(17)
  @IsStrongPassword({
    minLength: 8,
    minSymbols: 2,
    minLowercase: 2,
    minUppercase: 1,
    minNumbers: 1,
  })
  password!: string;

  @IsNotEmpty()
  @IsString()
  @Validate(MatchPasswordConstraint)
  confirmPassword!: string;
}

const UserNewLoginDto = SchemaFactory.createForClass(UserNewLoginDTO);
const userPersonalID: string[] = [];

UserNewLoginDto.pre('save', function () {
  try {
    if (this.isDirectModified('PersonalID')) {
      const convertedID = (this.PersonalID = Number(this.PersonalID));
      const newIdForm = convertedID.toString();
      const jsonStringID = JSON.stringify(newIdForm);
      userPersonalID.push(jsonStringID);
    }
  } catch (error) {
    console.error('Error processing PersonalID:', error);
  }
});

@Injectable()
export class PersonalIDService {
  getUserPersonalID() {
    return userPersonalID;
  }

  // Zapisuje ID w tym samym formacie co hook pre('save'), aby odczytał je UserServiceService.personalIDInfo
  registerPersonalID(personalID: number) {
    userPersonalID.push(JSON.stringify(String(personalID)));
  }
}
