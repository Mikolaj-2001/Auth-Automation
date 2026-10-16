import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { UserServiceService } from '../../../src/user-service/user-service.service';
import { User } from '../../../src/user-schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DataAuth } from '../../../src/authData-schema/dataAuth.schema';
import { deleteSelectionDTO } from '../../authentication/auth-controller/auth-controller.controller';
import { AuthCreateDto } from '../../authDto/authCreate.dto';

@Injectable()
export class AuthServiceService {
  [x: string]: any;
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(DataAuth.name) private readonly dataAuthModel: Model<DataAuth>,
    private configService: ConfigService,
    private readonly userService: UserServiceService,
  ) { }

  // Mapuje AuthCreateDto na pola schematu DataAuth (encryptionKey generuje hook pre-save)
  async createAuth(dto: AuthCreateDto): Promise<DataAuth> {
    const authDocument = new this.dataAuthModel({
      userId: new Types.ObjectId(dto.userID),
      userAuthID: dto.userAuthID,
      Name: dto.name,
      email: dto.email,
      userRefID: dto.userRefID,
    });
    return authDocument.save();
  }

  // userRefID użytkownika ma postać "<id dokumentu DataAuth>@<numer>"
  async findAuthByUserRefID(userRefID: string): Promise<DataAuth | null> {
    const authDocumentID = userRefID?.split('@')[0];//split to metoda dzieląca string na tablicę według znaku '@' i pobiera pierwszy element,aby uzyskać identyfikator dokumentu DataAuth
    if (!authDocumentID || !Types.ObjectId.isValid(authDocumentID)) {
      return null;
    }
    return this.dataAuthModel.findById(authDocumentID).exec();
  }

  async findUserByAuthIDAndEmail(
    userAuthID: number,
    email: string,
  ): Promise<DataAuth | User | null> {
    let user = await this.dataAuthModel
      .findOne({
        $or: [{ userAuthID }, { email }],
      })
      .exec();
    return user;
  }

  // E-mail i hasło są zapisane zaszyfrowane, więc użytkownika trzeba szukać po odszyfrowaniu
  private async findUserByDecryptedEmail(email: string): Promise<User | null> {
    const users = await this.userModel.find();
    for (const dbUser of users) {
      try {
        if ((dbUser as any).getDecryptedEmail() === email) {
          return dbUser;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  // Sprawdza e-mail i hasło przed wystawieniem tokenu przez generateJwtToken
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.findUserByDecryptedEmail(email);
    let storedPassword = '';
    try {
      storedPassword = user ? (user as any).getDecryptedPassword() : '';
    } catch (error) {
      storedPassword = '';
    }
    const provided = Buffer.from(String(password ?? ''));//Buffer.from służy do tworzenia bufora z podanego ciągu znaków, co jest potrzebne do bezpiecznego porównania hasła
    const stored = Buffer.from(storedPassword);
    const matches =
      stored.length > 0 &&
      provided.length === stored.length &&
      timingSafeEqual(provided, stored);//timingSafeEqual ensures that the comparison is done in constant time to prevent timing attacks
    if (!user || !matches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  //Modifikowanie struktury przyznawania tokenu JWT dla użytkownika
  async generateJwtToken(identifier: string, res: Response): Promise<void> {
    const user = await this.findUserByDecryptedEmail(identifier);
    if (!user) {
      throw new UnauthorizedException('The specified user does not exist');
    }
    const payload: Record<string, any> = {/* tutaj record służy do dynamicznego tworzenia obiektu z właściwościami */
      id: user._id,
      userName: user.userName,
      surname: user.Surname,
      userRefID: user.userRefID,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_AUTH_TOKEN'),
      algorithm: 'HS256', // Ten sam algorytm, który wymusza verifyToken
      issuer: 'auth-automation', // Wystawca tokenu, sprawdzany w verifyToken
      audience: 'auth-automation-client', // Odbiorca tokenu, sprawdzany w verifyToken
      expiresIn: (this.configService.get<string>('JWT_AUTH_TOKEN_EXPIRES_IN') ||
        '1h') as any,
    });

    res.cookie('jwt', token, {
      //jwt oznacza JSON Web Token,który jest standardem otwartym (RFC 7519) definiującym sposób bezpiecznego przekazywania informacji między stronami jako obiekt JSON. W tym przypadku jest używany do uwierzytelniania użytkownika po zalogowaniu.
      httpOnly: true /* Ustawianie cookies jako niedostępnych z poziomu JavaScript,czyli nie można ich odczytać ani zmodyfikować z poziomu klienta */,
      sameSite:
        'strict' /* Wysyłanie cookies z żądaniem do domen o tym samym adresie  */,
      secure:
        process.env.Node_ENV ===
        'production' /* ustawienie przesyłania tylko przez żądanie HTTPS i ustawienie,aby działa w trybie produkcyjnym na serwerze HTTPS */,
      maxAge: 3600000 /* Długość ważności cookies */,
    }); /* Token JWT został ustawiony w ciasteczku */
  }

  // Weryfikacja tokenu JWT z dodatkowymi zabezpieczeniami
  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = this.jwtService.verify(token, {
        // Sekret, którym token został podpisany
        secret: this.configService.get<string>('JWT_AUTH_TOKEN'),
        // Akceptujemy tylko HS256 (blokuje atak z algorytmem "none"),czyli algorytm symetryczny, który wymaga tego samego sekretu do podpisania i weryfikacji tokenu
        algorithms: ['HS256'],
        // Token musi pochodzić od naszej aplikacji
        issuer: 'auth-automation',
        // Token musi być przeznaczony dla naszego klienta
        audience: 'auth-automation-client',
        // Tolerancja różnicy zegarów w sekundach przy sprawdzaniu exp,czyli dopuszczalna różnica między czasem serwera a czasem zapisanym w tokenie
        clockTolerance: 8,
      });

      // Sprawdzamy, czy użytkownik z tokenu nadal istnieje w bazie
      const user = await this.userModel.findById(decoded.id);// tutaj sprawdzamy, czy użytkownik z tokenu nadal istnieje w bazie
      if (!user) {//decoded.id to identyfikor użytkownika w bazie danych
        throw new UnauthorizedException('User does not exist');
      }
      return decoded;
    } catch (error) {
      // Każdy błąd zamieniamy na ogólny 401, bez ujawniania szczegółów klientowi
      throw new UnauthorizedException('Invalid token');
    }
  }

  async deleteSelection(deleteDTO: deleteSelectionDTO): Promise<number | Types.ObjectId | undefined> {
    const deletionFilter = {
      userAuthID: deleteDTO.userAuthID,
      userId: deleteDTO.userId,
    };
    const deletionResult = await this.dataAuthModel.deleteOne(deletionFilter);
    if (deletionResult.deletedCount === 0) {
      throw new UnauthorizedException('Selection deletion failed');
    }
    return <any>({ deletionResult: true });
    //<any> oznacza rzutowanie na dowolny typ, co pozwala na obejście restrykcji typów TypeScript w tym miejscu
  }

  async deleteUser(email: string, AuthID: number, deleteDTO: deleteSelectionDTO): Promise<any> {
    const firstDeleteProcedure = await this.deleteSelection(deleteDTO);
    if (firstDeleteProcedure) { return; }
    try {
      const user = await this.userModel.findOne({ email, AuthID });
      if (!user) {
        throw new UnauthorizedException('User does not exist');
      }
      if (user) {
        prompt("You are about to delete the user!");
        if (!confirm("Are you sure you want to continue?")) {
          await fetch('auth/delete', {
            method: 'DELETE',
            body: JSON.stringify({ email, AuthID }),
            headers: {//to służy do ustawienia nagłówków żądania HTTP, aby serwer wiedział, jakiego typu dane otrzymuje
              'Content-Type': 'application/json',//tutaj ustawiamy nagłówek, aby serwer wiedział, że przesyłamy dane w formacie JSON
            },
          });
          return; // Exit the function if the user cancels
        }
        await this.userModel.deleteOne({ email, AuthID });
      }
    } catch (error) {
      throw new UnauthorizedException('Error occurred while deleting the user');
    }
  }
}

