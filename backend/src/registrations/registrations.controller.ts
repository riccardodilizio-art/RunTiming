import { Body, Controller, Get, Header, Ip, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { assertHuman } from '../common/captcha';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthGuard, AuthUser, CurrentUser, OptionalAuthGuard, Roles, ThrottlePerIp } from '../common/auth';
import { RegistrationsService } from './registrations.service';
import { PayMethod } from './rules';
import {
    CreateRegistrationDto,
    CreateStaffettaDto,
    ListQueryDto,
    UpdateCertDto,
    UpdatePaymentDto,
    VerifyDto,
} from './registrations.dto';
import { entrantsXlsx } from './export';

@Controller()
export class RegistrationsController {
    constructor(private readonly regs: RegistrationsService) {}

    // ─── Pubbliche ───────────────────────────────────────────────────────

    /** Prezzo attuale (quota + sconto + commissione + maggiorazione del metodo). ?code=XYZ&method=bank */
    @Get('races/:id/quote')
    @ThrottlePerIp({ staffExempt: true })
    @Throttle({ default: { limit: 60, ttl: 60_000 } })
    quote(@Param('id') id: string, @Query('code') code?: string, @Query('method') method?: string) {
        const m = ['paypal', 'bank', 'onsite'].includes(method ?? '') ? (method as PayMethod) : undefined;
        return this.regs.quote(id, code, m);
    }

    /** Elenco iscritti pubblico paginato, cache 60s (CDN/browser). */
    @Get('races/:id/entrants')
    @Header('Cache-Control', 'public, max-age=60')
    publicList(@Param('id') id: string, @Query() q: ListQueryDto) {
        return this.regs.publicList(id, q);
    }

    /** "Verifica iscrizione": cognome + data di nascita. */
    @Post('events/:slug/verify')
    @ThrottlePerIp({ staffExempt: true })
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    verify(@Param('slug') slug: string, @Body() dto: VerifyDto) {
        return this.regs.verify(slug, dto);
    }

    // ─── Utente autenticato ──────────────────────────────────────────────

    /** Con login (atleta, società, staff) oppure come ospite con i dati atleta ed email. */
    @Post('registrations')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @UseGuards(OptionalAuthGuard)
    async create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateRegistrationDto, @Ip() ip: string) {
        if (!user) await assertHuman(dto.captchaToken, ip); // ospiti: verifica anti-robot
        return this.regs.create(user, dto);
    }

    /** Staffetta: il capitano iscrive tutta la squadra (un solo pagamento). */
    @Post('registrations/staffetta')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @UseGuards(OptionalAuthGuard)
    async createStaffetta(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateStaffettaDto, @Ip() ip: string) {
        if (!user) await assertHuman(dto.captchaToken, ip);
        return this.regs.createStaffetta(user, dto);
    }

    @Get('registrations/me')
    @UseGuards(AuthGuard)
    mine(@CurrentUser() user: AuthUser) {
        return this.regs.mine(user);
    }

    // ─── Admin / organizzatore ───────────────────────────────────────────

    @Get('races/:id/registrations')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    staffList(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: ListQueryDto) {
        return this.regs.staffList(user, id, q);
    }

    /** Excel nel tracciato del cronometraggio. */
    @Get('races/:id/export.xlsx')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    async export(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
        const { race, rows } = await this.regs.exportRows(user, id);
        const buf = await entrantsXlsx(race.name, rows);
        const name = `iscritti-${race.name.replace(/[^\w-]+/g, '-').toLowerCase()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.send(buf);
    }

    @Patch('registrations/:id/payment')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    setPayment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
        return this.regs.setPayment(user, id, dto.paymentStatus);
    }

    @Patch('registrations/:id/cert')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    setCert(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCertDto) {
        return this.regs.setCert(user, id, dto.certStatus);
    }
}
