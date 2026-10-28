import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/throttle';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { FidalModule } from './fidal/fidal.module';
import { SettingsModule } from './settings/settings.module';
import { DiscountsModule } from './discounts/discounts.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { AccessModule } from './common/access';
import { ProfilesModule } from './profiles/profiles.module';
import { ResultsModule } from './results/results.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MailModule,
        // Limite di richieste per IP: 300 al minuto in generale, più basso sulle
        // rotte sensibili (login, iscrizioni, verifica, codici sconto) con @Throttle.
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MIN) || 300 }]),
        PrismaModule,
        HealthModule,
        AuthModule,
        AccessModule,
        SettingsModule,
        EventsModule,
        FidalModule,
        DiscountsModule,
        RegistrationsModule,
        ProfilesModule,
        ResultsModule,
        PaymentsModule,
        // TODO: storage file (certificati, locandine), email.
    ],
    providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
