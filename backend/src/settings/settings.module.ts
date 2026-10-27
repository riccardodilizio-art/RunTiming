import { Body, Controller, Get, Global, Injectable, Module, Put, UseGuards } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { IsIn, IsNumber, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles } from '../common/auth';
import { CommissionConfig, ZERO_COMMISSION } from '../registrations/rules';

const COMMISSION_KEY = 'commission';

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) {}

    async commission(): Promise<CommissionConfig> {
        const row = await this.prisma.setting.findUnique({ where: { key: COMMISSION_KEY } });
        return (row?.value as unknown as CommissionConfig) ?? ZERO_COMMISSION;
    }

    async setCommission(c: CommissionConfig): Promise<CommissionConfig> {
        const value = c as unknown as Prisma.InputJsonValue;
        await this.prisma.setting.upsert({
            where: { key: COMMISSION_KEY },
            create: { key: COMMISSION_KEY, value },
            update: { value },
        });
        return c;
    }
}

class CommissionDto implements CommissionConfig {
    @IsNumber() @Min(0) fixedFee!: number;
    @IsNumber() @Min(0) percentFee!: number;
    @IsIn(['buyer', 'organizer']) appliedTo!: 'buyer' | 'organizer';
}

@Controller('settings')
export class SettingsController {
    constructor(private readonly settings: SettingsService) {}

    /** Commissione globale di default (pubblica: serve per mostrare il prezzo). */
    @Get('commission')
    getCommission() {
        return this.settings.commission();
    }

    @Put('commission')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    putCommission(@Body() dto: CommissionDto) {
        return this.settings.setCommission({ ...dto });
    }
}

@Global()
@Module({
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule {}
