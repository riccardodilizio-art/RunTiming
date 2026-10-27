import { ForbiddenException, Global, Injectable, Module } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth';

/** Chi può gestire un evento: admin sempre, organizzatore se assegnato o creatore. */
@Injectable()
export class EventAccess {
    constructor(private readonly prisma: PrismaService) {}

    async canManage(user: AuthUser, eventId: string, createdById?: string | null): Promise<boolean> {
        if (user.role === Role.ADMIN) return true;
        if (user.role !== Role.ORGANIZER) return false;
        if (createdById && createdById === user.sub) return true;
        const acc = await this.prisma.account.findUnique({
            where: { id: user.sub },
            select: { assignedEventIds: true },
        });
        return !!acc?.assignedEventIds.includes(eventId);
    }

    async assert(user: AuthUser, eventId: string, createdById?: string | null): Promise<void> {
        if (!(await this.canManage(user, eventId, createdById))) {
            throw new ForbiddenException('Non puoi gestire questo evento');
        }
    }
}

@Global()
@Module({ providers: [EventAccess], exports: [EventAccess] })
export class AccessModule {}
