import { Controller, Post, Body, Param, Get, Render, Query, UseGuards, Req, Delete } from '@nestjs/common';
import { AuthServiceService } from '../auth-service/auth-service.service';
import { AuthCreateDto } from '../../authDto/authCreate.dto';
import { AuthUpdateDto } from '../../authDto/authUpdate.dto';
import { AuthConfigMiddleware } from '../../auth-config-middelware/auth-config';
import { UserServiceService } from '../../user-service/user-service.service';
import { Types } from 'mongoose';
import { IsMongoId, IsNumber } from 'class-validator';
import { PickType } from '@nestjs/mapped-types';
import { DataAuth } from '../../authData-schema/dataAuth.schema';
import { LeakServiceGuard } from '../../authLeakDetection/leak-service.guard';
import { UnauthorizedException } from '@nestjs/common';

@Controller('auth-controller')
export class AuthControllerController { }

export class deleteSelectionDTO extends PickType(DataAuth, ['userAuthID', 'userId'] as const) {//tutaj definiujemy DTO do usuwania selekcji na podstawie userAuthID i userId jako kluczowych identyfikatorów
    @IsMongoId({ message: 'Invalid Mongo ID' })
    readonly userId!: Types.ObjectId;// The ID of the document to be deleted
    @IsNumber({}, { message: 'Invalid userAuthID' })
    readonly userAuthID!: number;// The ID of the user associated with the auth document
}

@Controller('auth/user')
@UseGuards(AuthConfigMiddleware, LeakServiceGuard)
export class AuthController {
    constructor(private readonly authService: AuthServiceService,
        private readonly userService: UserServiceService,
    ) { }

    @Get('user')
    @Render('user')
    async getUser(@Query('userRefID') userRefID?: string, @Query('email') email?: string) {
        const users = await this.userService.findAllUsers(userRefID, email);
        const user = userRefID ? await this.userService.findUserByRefId(userRefID) : null;

        const createAuthModel: AuthCreateDto = {
            userID: new Types.ObjectId().toString(),
            userAuthID: await this.userService.generateUserAuthID(),
            name: user?.userName ?? '',
            surname: user?.Surname ?? '',
            email: email ?? '',
            userRefID: userRefID ?? '',
        };
        const authorisation = user && email
            ? await this.authService.createAuth(createAuthModel)
            : null;
        return {
            users,
            user,
            createAuthModel,
            authorisation,
        };
    }

    @Get('AuthTemplateCongregate/:id')
    @UseGuards(AuthConfigMiddleware)
    @Render('PageView/AuthTemplateCongregate')
    async getAuthTemplateCongregate(
        @Param('id') userRefID: string,
        @Req() req: any,
    ) {
        if (req.user?.userRefID !== userRefID) {
            throw new UnauthorizedException('You are not authorized to view this auth template.');
        }
        const auth = await this.authService.findAuthByUserRefID(userRefID);
        return {
            auth,
            user: req.user,
        };
    }

    @Post('update/:id')
    @UseGuards(AuthConfigMiddleware)
    @Render('PageView/AuthTemplateCongregate')
    async updateAuth(
        @Param('id') id: string,
        @Body() updateDto: AuthUpdateDto,
        @Req() req: any,
    ) {
        // Rekord DataAuth zalogowanego użytkownika; id z adresu musi być jego _id
        const ownAuth = await this.authService.findAuthByUserRefID(req.user.userRefID);

        if (!ownAuth || String(ownAuth._id) !== id) {
            throw new UnauthorizedException('You are not authorized to update this auth.');
        }

        if (updateDto.userRefID !== undefined && String(updateDto.userRefID) !== ownAuth.userRefID) {
            throw new UnauthorizedException('Invalid userRefID.');
        }

        const updatedAuth = await this.authService.updateAuth(id, updateDto);
        if (!updatedAuth) {
            return { message: 'Update failed.' };
        }

        return {
            message: 'Update successful.',
            updatedAuth,
            user: req.user,
        };
    }

    @Post('delete/:id')
    @UseGuards(AuthConfigMiddleware)
    @Render('PageView/AuthTemplateCongregate')
    async deleteAuth(
        @Param('id') id: string,
        @Body() deleteSelectionDTO: deleteSelectionDTO,
        @Req() req: any,
    ) {
        // Rekord DataAuth zalogowanego użytkownika, z którym porównujemy dane z body
        const ownAuth = await this.authService.findAuthByUserRefID(req.user.userRefID);

        if (!ownAuth || String(ownAuth._id) !== id) {
            throw new UnauthorizedException('You are not authorized to delete this auth.');
        }

        // Dane z deleteSelectionDTO muszą wskazywać dokładnie na rekord tego użytkownika
        if (
            Number(deleteSelectionDTO.userAuthID) !== ownAuth.userAuthID ||
            String(deleteSelectionDTO.userId) !== String(ownAuth.userId)
        ) {
            throw new UnauthorizedException('The selection does not match your auth data.');
        }

        const authToDelete = await this.authService.deleteSelection({
            userAuthID: ownAuth.userAuthID,
            userId: ownAuth.userId,
        });

        return {
            message: 'Deletion successful.',
            authToDelete,
            user: req.user,
        };
    }

    @Post('create')
    async createAuth(
        @Body() createDto: AuthCreateDto,
        @Req() req: any,
    ): Promise<any> {
        const createdAuth = req.user && await this.authService.createAuth(createDto);
        return {
            message: 'Creation successful.',
            createdAuth,
        };
    }

}