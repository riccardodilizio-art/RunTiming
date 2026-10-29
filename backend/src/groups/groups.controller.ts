import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import { GroupsService } from './groups.service';
import { CreateGroupDto, GroupListDto, GroupPaymentDto, GroupPreviewDto } from './groups.dto';

@Controller()
@UseGuards(AuthGuard)
export class GroupsController {
    constructor(private readonly groups: GroupsService) {}

    /** Società: riepilogo prima di confermare (omaggi, totale). */
    @Post('groups/preview')
    @Roles(Role.SOCIETY)
    preview(@CurrentUser() user: AuthUser, @Body() dto: GroupPreviewDto) {
        return this.groups.preview(user, dto);
    }

    /** Società: iscrive più atleti con un solo pagamento. */
    @Post('groups')
    @Roles(Role.SOCIETY)
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
        return this.groups.create(user, dto);
    }

    @Get('groups/me')
    @Roles(Role.SOCIETY)
    mine(@CurrentUser() user: AuthUser) {
        return this.groups.mine(user);
    }

    /** Segreteria: bonifici dei gruppi. */
    @Get('admin/groups')
    @Roles(Role.ADMIN)
    list(@Query() q: GroupListDto) {
        return this.groups.list(q.status);
    }

    @Patch('admin/groups/:id/payment')
    @Roles(Role.ADMIN)
    setPayment(@Param('id') id: string, @Body() dto: GroupPaymentDto) {
        return this.groups.setPayment(id, dto.paymentStatus as PaymentStatus);
    }
}
