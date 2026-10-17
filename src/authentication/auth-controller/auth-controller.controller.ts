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

    @Post('update/:id')
    @UseGuards(AuthConfigMiddleware)
    @Render('PageView/AuthTemplateCongregate')
    async updateAuth(
        @Param('id') id: string,
        @Body() updateDto: AuthUpdateDto,
        @Req() req: any,
    ) {
        if (!id) {
            return { message: 'Lack of required ID.' };
        }
        const updatedAuth = await this.authService.updateAuth(id, updateDto);
        if (!updatedAuth) {
            return { message: 'Update failed.' };
        }

        const user = req.user && (updatedAuth.userID ? await this.userService.findUserByRefId(updatedAuth.userID) : null);
        return {
            message: 'Update successful.',
            updatedAuth,
            user,
        };
    }

    @Delete('delete/:id')
    @UseGuards(AuthConfigMiddleware)
    @Render('PageView/AuthTemplateCongregate')
    async deleteAuth(
        @Param('id') id: string,
        @Body() deleteSelectionDTO: deleteSelectionDTO,
        @Req() req: any,
    ) {
        if (!id && !deleteSelectionDTO.userAuthID && !deleteSelectionDTO.userId) {
            return { message: 'Lack of required ID or selection to delete the user.' };
        }
        const authToDelete = await this.authService.deleteSelection({
            userAuthID: deleteSelectionDTO.userAuthID,
            userId: deleteSelectionDTO.userId,
        });

        const user = req.user && (deleteSelectionDTO.userId ? await this.userService.findUserByRefId(deleteSelectionDTO.userId.toString()) : null);
        return {
            message: 'Deletion successful.',
            authToDelete,
            user,
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