import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthGuard, AuthUser, CurrentUser, OptionalAuthGuard, Roles } from '../common/auth';
import { RegistrationsService } from './registrations.service';
import {
    CreateRegistrationDto,
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

    /** Prezzo attuale (quota + sconto + commissione). GET /api/races/:id/quote?code=XYZ */
    @Get('races/:id/quote')
    quote(@Param('id') id: string, @Query('code') code?: string) {
        return this.regs.quote(id, code);
    }

    /** Elenco iscritti pubblico paginato, cache 60s (CDN/browser). */
    @Get('races/:id/entrants')
    @Header('Cache-Control', 'public, max-age=60')
    publicList(@Param('id') id: string, @Query() q: ListQueryDto) {
        return this.regs.publicList(id, q);
    }

    /** "Verifica iscrizione": cognome + data di nascita. */
    @Post('events/:slug/verify')
    verify(@Param('slug') slug: string, @Body() dto: VerifyDto) {
        return this.regs.verify(slug, dto);
    }

    // ─── Utente autenticato ──────────────────────────────────────────────

    /** Con login (atleta, società, staff) oppure come ospite con i dati atleta ed email. */
    @Post('registrations')
    @UseGuards(OptionalAuthGuard)
    create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateRegistrationDto) {
        return this.regs.create(user, dto);
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
