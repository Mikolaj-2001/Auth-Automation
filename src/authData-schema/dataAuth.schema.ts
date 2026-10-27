import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as CryptoJS from 'crypto-js';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsMongoId,
  IsInt,
  Min,
  Max,
} from 'class-validator';

@Schema({ timestamps: true })
export class DataAuth extends Document {
  @Prop({ required: true, type: Types.ObjectId, unique: true })
  @IsNotEmpty()
  @IsMongoId()
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    min: 1_000_000_000_000_000,
    max: 9_007_199_254_740_991,//max length is 16 digits
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1_000_000_000_000_000, {
    message: 'userAuthID does not comply with the required length',
  })
  @Max(9_007_199_254_740_991, {
    message: 'userAuthID does not comply with the required length',
  })
  userAuthID!: number;

  @Prop({ required: true })
  @IsNotEmpty()
  @IsString()
  Name!: string;

  @Prop({ required: true, unique: true })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email!: string;

  @Prop({ required: true,unique: true, ref: 'User' })
  @IsNotEmpty()
  @IsString()
  userRefID!: string;

  @Prop({ required: true })
  encryptionKey!: string;
}

export const DataAuthSchema = SchemaFactory.createForClass(DataAuth);

DataAuthSchema.pre('save', function () {
  try {
    if (
      this.isModified('userAuthID') &&
      this.isModified('Name') &&
      this.isModified('email')
    ) {
      this.userAuthID = Number(this.userAuthID); // Convert userAuthID to a number before saving
      this.Name = this.Name.toUpperCase(); // Convert Name to uppercase before saving
      this.email = this.email.toLowerCase(); // Convert email to lowercase before saving
    }
  } catch (error) {
    console.error('Error in pre-save hook:', error);
  }

  function randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomSequenceOfSymbols(length: any): any {
    const sequence =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn$%##uvwxyz012345678552@!#$9';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += sequence.charAt(Math.floor(Math.random() * sequence.length));
    }
    return result;
  }

  try {
    const randomEncryptingKey = randomSequenceOfSymbols(randomNumber(10, 12));

    // Szyfruj prawdziwe dane użytkownika z losowym kluczem
    const encryptedName = CryptoJS.AES.encrypt(
      this.Name,
      randomEncryptingKey,
    ).toString();
    const encryptedEmail = CryptoJS.AES.encrypt(
      this.email,
      randomEncryptingKey,
    ).toString();

    this.Name = encryptedName;
    this.email = encryptedEmail;
    this.encryptionKey = randomEncryptingKey;

    if (
      typeof encryptedName === 'string' &&
      encryptedName.length > 0 &&
      typeof encryptedEmail === 'string' &&
      encryptedEmail.length > 0 &&
      typeof randomEncryptingKey === 'string' &&
      randomEncryptingKey.length > 0 &&
      /* Sprawdzanie czy dane zaszyfrowane spełniają wymogi */
      /[a-zA-Z]/.test(encryptedName) &&
      /[0-9]/.test(encryptedName) &&
      /[a-zA-Z]/.test(encryptedEmail) &&
      /[0-9]/.test(encryptedEmail)
    ) {
      return;
    } else {
      throw new Error('Error during encryption');
    }
  } catch (error) {
    throw new Error('Error during encryption');
  }
});

DataAuthSchema.methods.getDecryptedName = function () {
  return CryptoJS.AES.decrypt(this.Name, this.encryptionKey).toString(
    CryptoJS.enc.Utf8,
  );
};

DataAuthSchema.methods.getDecryptedSurname = function () {
  return CryptoJS.AES.decrypt(this.Surname, this.encryptionKey).toString(
    CryptoJS.enc.Utf8,
  );
};
