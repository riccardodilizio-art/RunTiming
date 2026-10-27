import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from '../common/auth';

// Globale: JwtService e AuthGuard sono usati dai controller di tutti i moduli.
@Global()
@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET ?? 'dev-secret',
            signOptions: { expiresIn: '7d' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthGuard],
    exports: [JwtModule, AuthGuard],
})
export class AuthModule {}
