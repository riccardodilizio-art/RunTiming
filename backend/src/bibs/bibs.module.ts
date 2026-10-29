import { BadRequestException, Body, ConflictException, Controller, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { IsIn, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import { EventAccess } from '../common/access';
import { assegnaPettorali } from './bib.rules';

class AssignDto {
    @IsOptional() @IsInt() @Min(1) @Max(999_999) da?: number;
    @IsIn(['tutti', 'nuovi']) modo!: 'tutti' | 'nuovi';
}

class BibDto {
    @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(999_999) pettorale!: number | null;
}

/** Pettorali: assegnazione automatica per gara (società, cognome, nome) e correzione a mano. */
@Injectable()
export class BibsService {
    constructor(private readonly prisma: PrismaService, private readonly access: EventAccess) {}

    async assign(user: AuthUser, raceId: string, dto: AssignDto) {
        const race = await this.prisma.race.findUnique({ where: { id: raceId }, include: { day: { include: { event: true } } } });
        if (!race) throw new NotFoundException('Gara non trovata');
        const ev = race.day.event;
        await this.access.assert(user, ev.id, ev.createdById);
        const da = dto.da ?? race.pettoraleDa ?? 1;

        return this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ev.id}))::text`;
            const regs = await tx.registration.findMany({
                where: { raceId, paymentStatus: { not: PaymentStatus.REJECTED } },
                select: { id: true, societa: true, cognome: true, nome: true, pettorale: true },
            });
            const altri = await tx.registration.findMany({
                where: { eventId: ev.id, raceId: { not: raceId }, pettorale: { not: null } },
                select: { pettorale: true },
            });
            // Annullate: il pettorale si libera
            await tx.registration.updateMany({ where: { raceId, paymentStatus: PaymentStatus.REJECTED, pettorale: { not: null } }, data: { pettorale: null } });
            const occupati = new Set(altri.map(a => a.pettorale as number));
            const m = assegnaPettorali(regs, { da, modo: dto.modo, occupati });
            if (dto.modo === 'tutti' && m.size) {
                // Prima si liberano, poi si assegnano (il pettorale è unico nell'evento)
                await tx.registration.updateMany({ where: { id: { in: [...m.keys()] } }, data: { pettorale: null } });
            }
            for (const [id, pettorale] of m) await tx.registration.update({ where: { id }, data: { pettorale } });
            await tx.race.update({ where: { id: raceId }, data: { pettoraleDa: da } });
            const all = regs.map(r => m.get(r.id) ?? r.pettorale).filter((x): x is number => x != null);
            return {
                assegnati: m.size,
                iscritti: regs.length,
                da: all.length ? Math.min(...all) : null,
                a: all.length ? Math.max(...all) : null,
            };
        });
    }

    async setOne(user: AuthUser, regId: string, pettorale: number | null) {
        const reg = await this.prisma.registration.findUnique({
            where: { id: regId }, include: { race: { include: { day: { include: { event: true } } } } },
        });
        if (!reg) throw new NotFoundException('Iscrizione non trovata');
        await this.access.assert(user, reg.eventId, reg.race.day.event.createdById);
        if (pettorale != null && reg.paymentStatus === PaymentStatus.REJECTED) throw new BadRequestException('Iscrizione annullata: niente pettorale');
        if (pettorale != null) {
            const other = await this.prisma.registration.findFirst({
                where: { eventId: reg.eventId, pettorale, id: { not: regId } },
                select: { cognome: true, nome: true, race: { select: { name: true } } },
            });
            if (other) throw new ConflictException(`Il pettorale ${pettorale} è già di ${other.cognome} ${other.nome} (${other.race.name})`);
        }
        const { pettorale: p } = await this.prisma.registration.update({ where: { id: regId }, data: { pettorale }, select: { pettorale: true } });
        return { id: regId, pettorale: p };
    }
}

@Controller()
@UseGuards(AuthGuard)
export class BibsController {
    constructor(private readonly bibs: BibsService) {}

    @Post('races/:id/bibs')
    @Roles(Role.ADMIN, Role.ORGANIZER)
    assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
        return this.bibs.assign(user, id, dto);
    }

    @Patch('registrations/:id/bib')
    @Roles(Role.ADMIN, Role.ORGANIZER)
    setOne(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BibDto) {
        return this.bibs.setOne(user, id, dto.pettorale);
    }
}

@Module({ controllers: [BibsController], providers: [BibsService] })
export class BibsModule {}
