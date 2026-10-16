import { CanActivate, ExecutionContext, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthGuard } from '../authentication/auth-guard/auth-guard';
import { AuthServiceService } from '../authentication/auth-service/auth-service.service';

@Injectable()
export class AuthConfigMiddleware implements NestMiddleware, CanActivate {
    constructor(
        private readonly authGuard: AuthGuard,
        private readonly authService: AuthServiceService
    ) { }
    // Pozwala używać tej klasy w @UseGuards: wpuszcza tylko żądania, którym middleware przypisało req.user
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            throw new UnauthorizedException('Authentication required');
        }
        return true;
    }
    use(req: any, res: any, next: (error?: any) => void) {
        this.determineTokenRequest(req, res, next).catch(next);
    }//tutaj używamy metody use,aby przechwycić żądania i sprawdzić obecność tokena przed dalszym przetwarzaniem

    async determineTokenRequest(req: Request, res: Response, next: NextFunction) {
        const tokendetection = req.cookies?.jwt;

        if (tokendetection) {
            try {
                console.log('Token detected on the route ' + req.originalUrl)//originalUrl to właściwa ścieżka żądania,gdzie wykryto token
                const verifiedToken = await this.authService.verifyToken(tokendetection);
                await this.authGuard.validateUserThroughToken(tokendetection, verifiedToken.id);
                Object.assign(req, { user: verifiedToken });//tutaj przypisujemy zweryfikowany token do obiektu żądania jako właściwość 'user'
                console.log('Verified token assigned to request object.Access granted.');
                next();
            }
            catch (error) {
                console.error('Error during token validation:' + req.originalUrl, { error });
                throw new UnauthorizedException('Invalid token');
            }

        }
        else {
            console.log('No token detected on the route ' + req.originalUrl);
            next();
        }
    }
}
