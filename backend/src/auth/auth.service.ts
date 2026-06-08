import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
    ) {}

    async register(email: string, password: string, displayName?: string, role: Role = Role.ATHLETE) {
        const existing = await this.prisma.account.findUnique({ where: { email } });
        if (existing) throw new ConflictException('Email già registrata');
        const passwordHash = await argon2.hash(password);
        const account = await this.prisma.account.create({
            data: { email, passwordHash, role, displayName },
        });
        return this.sign(account.id, account.email, account.role);
    }

    async login(email: string, password: string) {
        const account = await this.prisma.account.findUnique({ where: { email } });
        if (!account || !(await argon2.verify(account.passwordHash, password))) {
            throw new UnauthorizedException('Credenziali non valide');
        }
        return this.sign(account.id, account.email, account.role);
    }

    private sign(sub: string, email: string, role: Role) {
        return { accessToken: this.jwt.sign({ sub, email, role }), role };
    }
}
