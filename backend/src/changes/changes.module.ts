import { Body, Controller, Get, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, AuthUser, CurrentUser, Roles, ThrottlePerIp } from '../common/auth';
import { RegistrationsModule } from '../registrations/registrations.module';
import { ChangesService } from './changes.service';
import { ChangeDto, ChangeListDto, ChangePaymentDto } from './changes.dto';

@Controller()
export class ChangesController {
    constructor(private readonly changes: ChangesService) {}

    // ─── Con il link personale dell'email (anche senza account) ──────────

    @Get('manage/:token')
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
