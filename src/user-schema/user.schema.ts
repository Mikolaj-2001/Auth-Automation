import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as CryptoJS from 'crypto-js';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  @IsNotEmpty()
  @IsString()
  userName!: string;

  @Prop({ required: true, ref: 'DataAuth' })
  @IsNotEmpty()
  @IsString()
  Surname!: string;

  @Prop({ required: true, unique: true })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email!: string;

  @Prop({ required: true, unique: true })
  @IsNotEmpty()
  @IsString()
  password!: string;

  @Prop({ required: true, unique: true })
  @IsNotEmpty()
  @IsString()
  userRefID!: string;

  @Prop({ required: true })
  encryptionKey?: string; /* Klucz szyfrujący dane wprowadzane przez użytkownika */
}

export const UserSchema = SchemaFactory.createForClass(User);//tutaj tworzymy schemat Mongoose dla klasy User, który będzie używany do interakcji z bazą danych.

UserSchema.pre('save', async function () {
  if (!this.isModified('password') && !this.isModified('email')) {
    return;
  }
  try {
  } catch {
    throw new Error('Błąd podczas szyfrowania danych');
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
    const randomEncryptingKey = randomSequenceOfSymbols(randomNumber(12, 14));

    // Szyfruj prawdziwe dane użytkownika z losowym kluczem
    const encryptedPassword = CryptoJS.AES.encrypt(
      this.password,
      randomEncryptingKey,
    ).toString();
    const encryptedEmail = CryptoJS.AES.encrypt(
      this.email,
      randomEncryptingKey,
    ).toString();

    this.password = encryptedPassword;
    this.email = encryptedEmail;
    this.encryptionKey = randomEncryptingKey;

    if (
      typeof encryptedEmail === 'string' &&
      encryptedEmail.length > 0 &&
      typeof encryptedPassword === 'string' &&
      encryptedPassword.length > 0 &&
      typeof randomEncryptingKey === 'string' &&
      randomEncryptingKey.length > 0 &&
      /* Sprawdzanie czy dane zaszyfrowane spełniają wymogi */
      /[a-zA-Z]/.test(encryptedPassword) &&
      /[0-9]/.test(encryptedPassword)
    ) {
      return;
    } else {
      throw new Error('Błąd podczas szyfrowania danych');
    }
  } catch (error) {
    throw new Error('Błąd podczas szyfrowania danych');
  }
});

UserSchema.methods.getDecryptedEmail = function () {
  return CryptoJS.AES.decrypt(this.email, this.encryptionKey).toString(
    CryptoJS.enc.Utf8,
  );
};

UserSchema.methods.getDecryptedPassword = function () {
  return CryptoJS.AES.decrypt(this.password, this.encryptionKey).toString(
    CryptoJS.enc.Utf8,
  );
};
