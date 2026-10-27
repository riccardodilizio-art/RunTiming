import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { FidalModule } from './fidal/fidal.module';
import { SettingsModule } from './settings/settings.module';
import { DiscountsModule } from './discounts/discounts.module';
import { RegistrationsModule } from './registrations/registrations.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        HealthModule,
        AuthModule,
        SettingsModule,
        EventsModule,
        FidalModule,
        DiscountsModule,
        RegistrationsModule,
        // TODO (moduli successivi, stessa struttura): athletes, societies,
        // races (CRUD admin), results, certificates, storage, payments.
    ],
})
export class AppModule {}
