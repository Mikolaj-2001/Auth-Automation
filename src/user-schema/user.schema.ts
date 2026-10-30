import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
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
    const encryptedPassword = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(randomEncryptingKey, 'utf8'),
      Buffer.alloc(16, 0),
    ).update(this.password, 'utf8', 'hex');

    const encryptedEmail = crypto.createHmac(
      'sha256',
      randomEncryptingKey,
    ).update(this.email).digest('hex');

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
  return crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(this.encryptionKey, 'utf8'),
    Buffer.alloc(16, 0),
  ).update(this.email, 'hex', 'utf8');
};

UserSchema.methods.getDecryptedPassword = function () {
  return bcrypt.compareSync(this.password, this.encryptionKey);
};
