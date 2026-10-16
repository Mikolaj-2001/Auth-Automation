import { Injectable } from '@nestjs/common';
import { AuthServiceService } from '../auth-service/auth-service.service';
import { UserServiceService } from '../../../src/user-service/user-service.service';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../../user-schema/user.schema';

@Injectable()
export class AuthGuard {/* Implementacja strażnika autoryzacji */
    constructor(private readonly authService: AuthServiceService,
        private readonly userService: UserServiceService
    ) { }

    async validateUserThroughToken(token: string, AuthID: any): Promise<User> {
        let attempts: number = 0;
        let user: User | null = null;

        do {
            try {
                let fullyVerified: any = null;
                fullyVerified = await this.userService.findUserById(AuthID);

                if (fullyVerified) {
                    try {
                        await this.authService.verifyToken(token);
                        user = fullyVerified;
                    } catch (error) {
                        throw new UnauthorizedException('Invalid token.Validation failed !');
                    }
                }
            }
            catch (error) {
                throw new UnauthorizedException('Invalid token.Validation failed !');
            }
            attempts++;
        }
        while (attempts < 4 && !user);

        if (!user) {
            throw new UnauthorizedException('User not found after multiple attempts.');
        }
        return user;
    }
}