import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from '../../src/user-schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { DataAuth } from '../../src/authData-schema/dataAuth.schema';
import { PersonalIDService } from '../../src/userDto/userRegistered.dto';

@Injectable()
export class UserServiceService {
    constructor(
        @InjectModel(User.name) private readonly userSchema: Model<User>,
        @InjectModel(DataAuth.name) private readonly authSchema: Model<DataAuth>,
        private readonly personalIDService: PersonalIDService,
    ) { }

    private newUser: any[] = [];

    personalIDInfo(): number | null {
        const providedID = this.personalIDService.getUserPersonalID().at(-1);//at oznacza pobranie ostatniego elementu z tablicy użytkownika,czyli ostatniego zapisanego ID
        // PersonalIDService zapisuje ID jako JSON.stringify(...), więc trzeba je sparsować
        return providedID ? Number(JSON.parse(providedID)) : null;// Zwraca ostatni zapisany numer personal ID użytkownika lub null, jeśli nie istnieje
    }

    async generateUserAuthID(): Promise<number> {
        let newAuthID: number;
        do {
            newAuthID = Math.floor(Math.random() * 8_000_000_000_000_000) + 1_000_000_000_000_000;// Losowy 16-cyfrowy identyfikator uwierzytelniania użytkownika
        } while (await this.authSchema.exists({ userAuthID: newAuthID }));

        return newAuthID;
    }

    async createUser(userDTO: { userName: string, Surname: string, email: string, password: string },
        authDTO: { userAuthID: number, Name: string, email: string, userRefID: string },
        personalID: number,
    ) {
        const personalIDInference = this.personalIDInfo();
        if (!personalIDInference || personalIDInference !== personalID) {
            throw new UnauthorizedException('Personal ID was not provided or does not match !');
        }
        const userNumber = await this.userSchema.createIndexes();
        const userAuthID = await this.generateUserAuthID();
        authDTO.userAuthID = userAuthID;
        const createAuthModel = new this.authSchema(authDTO);
        const savedAuthModel = await createAuthModel.save();
        const createUserModel = { ...userDTO, personalID, userRefID: `${savedAuthModel._id}@${userNumber}` };
        const createUserModelInstance = new this.userSchema(createUserModel);
        this.newUser.push(createUserModelInstance);
        return await createUserModelInstance.save();
    }

    async updateUser(userRefID: string, updateDTO: { userName?: string, Surname?: string, email?: string, password?: string; userRefID?: string }) {
        const updatedUser = await this.userSchema.findOne({ userRefID });
        if (!updatedUser) {
            throw new UnauthorizedException('User not found');
        }
        if (updateDTO.userRefID) {
            const updatedRefDoc = await this.userSchema
                .findByIdAndUpdate(updatedUser._id, { userRefID: updateDTO.userRefID }, { new: true })
                .lean();

            if (updatedRefDoc) {
                Object.assign(updatedUser, updatedRefDoc);
            }
        }
        Object.assign(updatedUser, updateDTO);
        return await updatedUser.save();
    }

    async removeUser(userRefID: string) {
        const userToRemove = await this.userSchema.findOne({ userRefID });
        if (!userToRemove) {
            throw new UnauthorizedException('User not found');
        }

        await this.userSchema.findByIdAndDelete(userToRemove._id);
        await this.authSchema.findByIdAndDelete(userToRemove.userRefID);

        this.newUser = this.newUser.filter(user => user._id.toString() !== userToRemove._id.toString());
    }

    async findUserByRefId(userRefID: string): Promise<User | null> {
        return this.userSchema.findOne({ userRefID }).lean().exec();
    }

    async findAllUsers(userRefID?: string, email?: string): Promise<User[]> {
        let allUsers = await this.userSchema.find({ userRefID, email }).exec();
        if (!userRefID) {
            allUsers = await this.userSchema.find({}).exec();
        }
        for (const dbUser of allUsers) {
            try {
                const decryptedEmail = (dbUser as any).getDecryptedEmail();
                if (decryptedEmail === email && dbUser.userRefID === userRefID) {
                    allUsers = [dbUser];
                    break;
                }
            } catch (error) {
                continue;
            }
        }
        return allUsers;
    }

    async findUserById(id: string): Promise<User | null> {
        return this.userSchema.findById(id).lean().exec();
    }

    async findUserByAuthID(userAuthID: number): Promise<User | null> {
        return this.userSchema.findOne({ userAuthID }).lean().exec();
    }
}


