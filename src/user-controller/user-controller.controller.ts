import {
    Controller, Post,
    Body,
    UnauthorizedException,
    HttpException,
    Res,
    Get,
    Render,
    Req,
    UseGuards,
    Query,
    Param,
    Delete,
} from '@nestjs/common';
import { UserServiceService } from '../user-service/user-service.service';
import { UserLoggingIn } from '../userDto/userLogIn.dto';
import { UserNewLogin, PersonalIDService } from '../userDto/userRegistered.dto';
import { AuthGuard } from '../authentication/auth-guard/auth-guard';
import { AuthServiceService } from '../authentication/auth-service/auth-service.service';
import { AuthConfigMiddleware } from '../auth-config-middelware/auth-config';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';

interface AuthRequest extends Request {
    user?: any;
}

type RegistrationBody = UserNewLogin & { confirmPassword?: string };

@Controller('user')
export class UserControllerController {
    constructor(
        private readonly userService: UserServiceService,
        private readonly authService: AuthServiceService,
        private readonly personalIDService: PersonalIDService,
    ) { }

    private errorStatus(error: unknown): number {
        return error instanceof HttpException ? error.getStatus() : 500;
    }

    private errorMessage(error: unknown, fallback: string): string {
        return error instanceof Error && error.message ? error.message : fallback;
    }

    @Post('register')
    async newRegistering(@Body() body: RegistrationBody, @Res() res: Response) {
        const { confirmPassword, password, userName, Surname, email, PersonalID } = body;
        // The password is never sent back to the view
        const formUser = { userName, Surname, email, PersonalID };
        try {
            if (password !== confirmPassword) {
                return res.status(400).render('PageView/userRegisteringForm', {
                    user: formUser,
                    error: 'Passwords do not match.',
                });
            }
            const personalID = Number(PersonalID);
            if (!Number.isInteger(personalID)) {
                return res.status(400).render('PageView/userRegisteringForm', {
                    user: formUser,
                    error: 'Personal ID must be a number.',
                });
            }

            this.personalIDService.registerPersonalID(personalID);
            const authDTO = {
                userAuthID: 0,
                Name: userName,
                email,
                userRefID: new Types.ObjectId().toString(),
                userId: new Types.ObjectId(),
            };
            const newUser = await this.userService.createUser(
                { userName, Surname, email, password },
                authDTO,
                personalID,
            );
            if (!newUser) {
                throw new UnauthorizedException('Registration failed');
            }
            return res.redirect(303, '/user/login');
        }
        catch (error) {
            return res.status(this.errorStatus(error)).render('PageView/userRegisteringForm', {
                user: formUser,
                error: this.errorMessage(error, 'Registration failed.'),
            });
        }
    }

    @Get('register')
    @Render('PageView/userRegisteringForm')
    async showRegistrationForm() {
        return {
            user: {
                userName: '',
                    Surname: '',
                    email: '',
                    PersonalID: ''
                }
        };
    }

    @Get('login')
    @Render('PageView/userLogIn')
    async showLoginForm() {
        return {
            user: {
                email: ''
            }
        };
    }

    @Post('login')
    async loginUser(
        @Body() userLoggingIn: UserLoggingIn,
        @Res() res: Response,
    ) {
        const formUser = { email: userLoggingIn.email, userAuthID: userLoggingIn.userAuthID };
        try {
            console.log('Attempting to log in user:', userLoggingIn.email);
            const user = await this.authService.validateCredentials(
                userLoggingIn.email,
                userLoggingIn.password,
            );
            const authData = await this.authService.findUserByAuthIDAndEmail(
                Number(userLoggingIn.userAuthID), userLoggingIn.email);
            const belongsToUser = authData
                && user.userRefID.split('@')[0] === String(authData._id);
            if (!authData || !belongsToUser) {
                return res.status(401).render('PageView/userLogIn', {
                    user: formUser,
                    error: 'Invalid email, auth ID or password.',
                });
            }
            await this.authService.generateJwtToken(userLoggingIn.email, res);
            return res.render('PageView/userAuthTemplate', {
                user: authData.toObject(),
                email: userLoggingIn.email,
                _id: user._id,
            });
        }
        catch (error) {
            return res.status(this.errorStatus(error)).render('PageView/userLogIn', {
                user: formUser,
                error: this.errorMessage(error, 'Login failed.'),
            });
        }
    }

    @Post('logout')
    async logout(@Res() res: Response) {
        try {
            res.clearCookie('jwt', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Ustawienie przesyłania tylko przez żądanie HTTPS i ustawienie, aby działa w trybie produkcyjnym na serwerze HTTPS
                sameSite: 'strict',
            });
            return res.redirect(303, '/user/login');
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.log('❌ Błąd podczas wylogowania:', errorMessage);
            throw error;
        }
    }

    @Delete(':id')
    @UseGuards(AuthConfigMiddleware)
    async deleteUser(
        @Param('id')
        id: string,
        @Res() res: Response,
        @Req() req: AuthRequest,
    ) {
        const authenticatedUser = req.user;
        // The token payload contains the user's database id (see AuthServiceService.generateJwtToken)
        if (!authenticatedUser?.id || authenticatedUser.id.toString() !== id) {
            throw new UnauthorizedException('You are not authorized to delete this user.');
        }
        const authData = await this.authService.findAuthByUserRefID(authenticatedUser.userRefID);
        if (!authData) {
            throw new UnauthorizedException('Auth data of this user was not found.');
        }

        await this.authService.deleteUser(
            authData.email,
            authData.userAuthID,
            { userAuthID: authData.userAuthID, userId: authData.userId },
        );
        return res.redirect(303, '/user/register');
    }
}
