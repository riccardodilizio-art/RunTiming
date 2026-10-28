import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { assertHuman } from '../common/captcha';
import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard, AuthUser, CurrentUser, ThrottlePerIp } from '../common/auth';

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
    @IsString() @MaxLength(128) password!: string;
}

class ForgotPasswordDto {
    @IsEmail() email!: string;
    @IsOptional() @IsString() @MaxLength(2048) captchaToken?: string;
}

class ResetPasswordDto {
    @IsString() @MinLength(20) @MaxLength(200) token!: string;
    @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

class ChangePasswordDto {
    @IsString() @MaxLength(128) current!: string;
    @IsString() @MinLength(8) @MaxLength(128) next!: string;
}

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Post('register')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async register(@Body() dto: RegisterDto, @Ip() ip: string) {
        await assertHuman(dto.captchaToken, ip);
        return this.auth.register(dto.email, dto.password, dto.displayName, dto.role ?? Role.ATHLETE);
    }

    @Post('login')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    login(@Body() dto: LoginDto, @Ip() ip: string) {
        return this.auth.login(dto.email, dto.password, ip);
    }

    /** "Password dimenticata": risponde sempre ok (non rivela se l'email esiste). */
    @Post('password/forgot')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async forgot(@Body() dto: ForgotPasswordDto, @Ip() ip: string) {
        await assertHuman(dto.captchaToken, ip);
        return this.auth.forgotPassword(dto.email);
    }

    @Post('password/reset')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    reset(@Body() dto: ResetPasswordDto) {
        return this.auth.resetPassword(dto.token, dto.password);
    }

    @Get('me')
    @UseGuards(AuthGuard)
    me(@CurrentUser() user: AuthUser) {
        return this.auth.me(user.sub);
    }

    @Post('password')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @UseGuards(AuthGuard)
    changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
        return this.auth.changePassword(user.sub, dto.current, dto.next);
    }
}
