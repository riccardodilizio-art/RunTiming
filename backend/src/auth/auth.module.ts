import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard, OptionalAuthGuard, TokenVerifier, jwtSecret } from '../common/auth';

// Globale: JwtService e AuthGuard sono usati dai controller di tutti i moduli.
@Global()
@Module({
    imports: [
        JwtModule.registerAsync({
            // Valutato all'avvio: senza JWT_SECRET forte il server non parte
            useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: '3d' } }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, TokenVerifier, AuthGuard, OptionalAuthGuard],
    exports: [JwtModule, TokenVerifier, AuthGuard, OptionalAuthGuard, AuthService],
})
export class AuthModule {}
