import { Body, Controller, Get, Header, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, AuthUser, CurrentUser, Roles, ThrottlePerIp } from '../common/auth';
import { RegistrationsModule } from '../registrations/registrations.module';
import { ChangesService } from './changes.service';
import { ChangeDto, ChangeListDto, ChangePaymentDto } from './changes.dto';
import { FrazionistaDto } from '../registrations/registrations.dto';

@Controller()
export class ChangesController {
    constructor(private readonly changes: ChangesService) {}

    // ─── Con il link personale dell'email (anche senza account) ──────────

    @Get('manage/:token')
    @Header('Cache-Control', 'no-store')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 30, ttl: 60_000 } })
    byToken(@Param('token') token: string) {
        return this.changes.options({ token });
    }

    @Post('manage/:token/changes')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    requestByToken(@Param('token') token: string, @Body() dto: ChangeDto) {
        return this.changes.request({ token }, dto);
    }

    @Post('manage/:token/ritiro')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    ritiroByToken(@Param('token') token: string) {
        return this.changes.ritiro({ token });
    }

    @Post('manage/:token/frazionista')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    frazionistaByToken(@Param('token') token: string, @Body() dto: FrazionistaDto) {
        return this.changes.cambiaFrazionista({ token }, dto);
    }

    // ─── Atleta, società, admin ──────────────────────────────────────────

    @Get('registrations/:id/changes')
    @UseGuards(AuthGuard)
    @Roles(Role.ATHLETE, Role.SOCIETY, Role.ADMIN)
    options(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.changes.options({ user }, id);
    }

    @Post('registrations/:id/changes')
    @UseGuards(AuthGuard)
    @Roles(Role.ATHLETE, Role.SOCIETY, Role.ADMIN)
    request(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChangeDto) {
        return this.changes.request({ user }, dto, id);
    }

    @Post('registrations/:id/ritiro')
    @UseGuards(AuthGuard)
    @Roles(Role.ATHLETE, Role.SOCIETY, Role.ADMIN)
    ritiro(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.changes.ritiro({ user }, id);
    }

    @Post('registrations/:id/frazionista')
    @UseGuards(AuthGuard)
    @Roles(Role.ATHLETE, Role.SOCIETY, Role.ADMIN)
    frazionista(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FrazionistaDto) {
        return this.changes.cambiaFrazionista({ user }, dto, id);
    }

    // ─── Segreteria ──────────────────────────────────────────────────────

    @Get('admin/changes')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    list(@Query() q: ChangeListDto) {
        return this.changes.list(q.status);
    }

    @Patch('admin/changes/:id/payment')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    setPayment(@Param('id') id: string, @Body() dto: ChangePaymentDto) {
        return this.changes.setPayment(id, dto.paymentStatus as PaymentStatus);
    }
}

/** Cambi dopo l'iscrizione: cambio gara, cessione del pettorale, trasferimento all'anno dopo. */
@Module({
    imports: [RegistrationsModule],
    controllers: [ChangesController],
    providers: [ChangesService],
    exports: [ChangesService],
})
export class ChangesModule {}
