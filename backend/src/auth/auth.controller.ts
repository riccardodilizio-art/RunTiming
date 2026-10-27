import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
    register(@Body() dto: RegisterDto) {
        return this.auth.register(dto.email, dto.password, dto.displayName, dto.role ?? Role.ATHLETE);
    }

    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto.email, dto.password);
    }

    @Get('me')
    @UseGuards(AuthGuard)
    me(@CurrentUser() user: AuthUser) {
        return this.auth.me(user.sub);
    }

    @Post('password')
    @UseGuards(AuthGuard)
    changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
        return this.auth.changePassword(user.sub, dto.current, dto.next);
    }
}
