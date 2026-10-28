import { Body, Controller, Get, Global, Injectable, Module, Put, UseGuards } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, Roles } from '../common/auth';
import { CommissionConfig, ZERO_COMMISSION } from '../registrations/rules';

const COMMISSION_KEY = 'commission';
const PAYMENTS_KEY = 'payments';

/**
 * Impostazioni dei pagamenti. Tutti gli incassi arrivano alla segreteria del sito, che a
 * fine gara gira le quote agli organizzatori: le maggiorazioni dei metodi
 * di pagamento sono a carico dell'atleta e restano alla segreteria.
 */
export interface PaymentSettings {
    /** Maggiorazione fissa per il bonifico (controllo e regolarizzazione). */
    bankFee: number;
    /** Commissione PayPal / carta a carico dell'atleta: percentuale + fisso. */
    paypalPercent: number;
    paypalFixed: number;
    /** Giorni entro cui va fatto il bonifico (indicazione all'atleta). */
    bankDays: number;
    /** Dati per il bonifico mostrati all'atleta. */
    iban: string;
    intestatario: string;
    banca: string;
}

export const DEFAULT_PAYMENTS: PaymentSettings = {
    bankFee: 1,
    paypalPercent: 3.4,
    paypalFixed: 0.35,
    bankDays: 5,
    iban: '',
    intestatario: '', // da impostare dal pannello admin (titolare del conto)
    banca: '',
};

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) {}

    private async get<T>(key: string, fallback: T): Promise<T> {
        const row = await this.prisma.setting.findUnique({ where: { key } });
        return row ? { ...fallback, ...(row.value as unknown as T) } : fallback;
    }

    private async set<T>(key: string, value: T): Promise<T> {
        const v = value as unknown as Prisma.InputJsonValue;
        await this.prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
        return value;
    }

    commission(): Promise<CommissionConfig> {
        return this.get(COMMISSION_KEY, ZERO_COMMISSION);
    }

    setCommission(c: CommissionConfig): Promise<CommissionConfig> {
        return this.set(COMMISSION_KEY, c);
    }

    payments(): Promise<PaymentSettings> {
        return this.get(PAYMENTS_KEY, DEFAULT_PAYMENTS);
    }

    async setPayments(p: Partial<PaymentSettings>): Promise<PaymentSettings> {
        const defined = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
        return this.set(PAYMENTS_KEY, { ...(await this.payments()), ...defined });
    }
}

class CommissionDto implements CommissionConfig {
    @IsNumber() @Min(0) fixedFee!: number;
    @IsNumber() @Min(0) percentFee!: number;
    @IsIn(['buyer', 'organizer']) appliedTo!: 'buyer' | 'organizer';
}

class PaymentsDto implements Partial<PaymentSettings> {
    @IsOptional() @IsNumber() @Min(0) @Max(20) bankFee?: number;
    @IsOptional() @IsNumber() @Min(0) @Max(20) paypalPercent?: number;
    @IsOptional() @IsNumber() @Min(0) @Max(5) paypalFixed?: number;
    @IsOptional() @IsInt() @Min(1) @Max(60) bankDays?: number;
    @IsOptional() @IsString() @MaxLength(40) iban?: string;
    @IsOptional() @IsString() @MaxLength(120) intestatario?: string;
    @IsOptional() @IsString() @MaxLength(120) banca?: string;
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

    /**
     * Impostazioni pagamenti pubbliche: maggiorazioni, dati bonifico e
     * client-id PayPal (pubblico per definizione: serve ai pulsanti PayPal).
     */
    @Get('payments')
    async getPayments() {
        const p = await this.settings.payments();
        return {
            ...p,
            paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
            paypalEnv: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
        };
    }

    @Put('payments')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    putPayments(@Body() dto: PaymentsDto) {
        const p: Partial<PaymentSettings> = { ...dto };
        if (dto.iban !== undefined) p.iban = dto.iban.replace(/\s+/g, '').toUpperCase();
        return this.settings.setPayments(p);
    }
}

@Global()
@Module({
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule {}
