import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { assertHuman } from '../common/captcha';
import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard, AuthUser, CurrentUser } from '../common/auth';

class RegisterDto {
    @IsEmail() email!: string;
    @IsString() @MinLength(8) @MaxLength(128) password!: string;
    @IsOptional() @IsString() @MaxLength(120) displayName?: string;
    /** Solo ATHLETE o SOCIETY: admin e organizzatori li crea l'admin. */
    @IsOptional() @IsIn([Role.ATHLETE, Role.SOCIETY]) role?: Role;
    /** Token anti-robot (Turnstile), richiesto se configurato. */
    @IsOptional() @IsString() @MaxLength(4096) captchaToken?: string;
}

class LoginDto {
    @IsEmail() email!: string;
    @IsString() password!: string;
}

class ChangePasswordDto {
    @IsString() current!: string;
    @IsString() @MinLength(8) @MaxLength(128) next!: string;
}

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Post('register')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async register(@Body() dto: RegisterDto, @Ip() ip: string) {
        await assertHuman(dto.captchaToken, ip);
        return this.auth.register(dto.email, dto.password, dto.displayName, dto.role ?? Role.ATHLETE);
    }

    @Post('login')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto.email, dto.password);
    }

    @Get('me')
    @UseGuards(AuthGuard)
    me(@CurrentUser() user: AuthUser) {
        return this.auth.me(user.sub);
    }

    @Post('password')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @UseGuards(AuthGuard)
    changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
        return this.auth.changePassword(user.sub, dto.current, dto.next);
    }
}
