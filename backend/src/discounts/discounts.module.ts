import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { DiscountCode, Prisma, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles, ThrottlePerIp } from '../common/auth';

export const normCode = (c: string) => c.trim().toUpperCase();

/** Motivo per cui un codice non è utilizzabile, oppure null se valido. */
export function discountProblem(d: DiscountCode | null, now = new Date(), eventId?: string): string | null {
    if (!d || !d.isActive) return 'Codice sconto non valido';
    // Codice di un altro evento: stesso messaggio (non si rivela che esiste)
    if (d.eventId && d.eventId !== eventId) return 'Codice sconto non valido';
    if (d.expiresAt && d.expiresAt < now) return 'Codice sconto scaduto';
    if (d.maxUses != null && d.usedCount >= d.maxUses) return 'Codice sconto esaurito';
    return null;
}

class CreateDiscountDto {
    // Almeno 6 caratteri e solo lettere/numeri: un codice corto si indovina provando
    @IsString() @MinLength(6, { message: 'Il codice deve avere almeno 6 caratteri' }) @MaxLength(30)
    @Matches(/^[A-Za-z0-9-]+$/, { message: 'Il codice può contenere solo lettere, numeri e trattini' }) code!: string;
    /** Evento su cui vale ('' o assente = tutti). */
    @IsOptional() @IsString() @MaxLength(40) eventId?: string;
    @IsOptional() @IsString() description?: string;
    @IsIn(['fixed', 'percent']) type!: string;
    @IsNumber() @Min(0) value!: number;
    @IsOptional() @IsInt() @Min(1) maxUses?: number;
    @IsOptional() @IsDateString() expiresAt?: string;
    @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateDiscountDto {
    @IsOptional() @IsString() @MaxLength(40) eventId?: string;
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsIn(['fixed', 'percent']) type?: string;
    @IsOptional() @IsNumber() @Min(0) value?: number;
    @IsOptional() @IsInt() @Min(1) maxUses?: number;
    @IsOptional() @IsDateString() expiresAt?: string;
    @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
export class DiscountsService {
    constructor(private readonly prisma: PrismaService) {}

    list() {
        return this.prisma.discountCode.findMany({ orderBy: { code: 'asc' } });
    }

    async create(dto: CreateDiscountDto) {
        try {
            return await this.prisma.discountCode.create({
                data: { ...dto, code: normCode(dto.code), eventId: dto.eventId || null, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null },
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ConflictException('Codice già esistente');
            }
            throw e;
        }
    }

    async update(id: string, dto: UpdateDiscountDto) {
        await this.get(id);
        return this.prisma.discountCode.update({
            where: { id },
            data: {
                ...dto,
                ...(dto.eventId !== undefined ? { eventId: dto.eventId || null } : {}),
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
            },
        });
    }

    async remove(id: string) {
        await this.get(id);
        await this.prisma.discountCode.delete({ where: { id } });
        return { ok: true };
    }

    /** Verifica pubblica di un codice: restituisce solo tipo e valore. */
    async check(code: string, raceId?: string) {
        const d = await this.prisma.discountCode.findUnique({ where: { code: normCode(code) } });
        let eventId: string | undefined;
        if (d?.eventId && raceId) {
            const race = await this.prisma.race.findUnique({ where: { id: raceId }, select: { day: { select: { eventId: true } } } });
            eventId = race?.day.eventId;
        }
        const problem = discountProblem(d, new Date(), eventId);
        if (problem) return { valid: false, message: problem };
        return { valid: true, code: d!.code, type: d!.type, value: d!.value, description: d!.description };
    }

    private async get(id: string) {
        const d = await this.prisma.discountCode.findUnique({ where: { id } });
        if (!d) throw new NotFoundException('Codice non trovato');
        return d;
    }
}

@Controller('discounts')
export class DiscountsController {
    constructor(private readonly discounts: DiscountsService) {}

    @Get('check/:code')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    check(@Param('code') code: string, @Query('gara') raceId?: string) {
        return this.discounts.check(code, raceId);
    }

    @Get()
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    list() {
        return this.discounts.list();
    }

    @Post()
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    create(@Body() dto: CreateDiscountDto) {
        return this.discounts.create(dto);
    }

    @Patch(':id')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    update(@Param('id') id: string, @Body() dto: UpdateDiscountDto) {
        return this.discounts.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.discounts.remove(id);
    }
}

@Module({
    controllers: [DiscountsController],
    providers: [DiscountsService],
})
export class DiscountsModule {}
