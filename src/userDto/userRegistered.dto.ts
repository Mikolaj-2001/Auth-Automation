import { SchemaFactory } from '@nestjs/mongoose';
import {
  IsString,
  IsEmail,
  IsStrongPassword,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { Injectable } from '@nestjs/common';

export class UserNewLogin {
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
  @IsStrongPassword({
    minLength: 8,
    minSymbols: 2,
    minLowercase: 2,
    minUppercase: 1,
  })
  password!: string;
}

const UserNewLoginDto = SchemaFactory.createForClass(UserNewLogin);
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
