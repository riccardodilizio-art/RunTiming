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
import { AccessModule } from './common/access';
import { ProfilesModule } from './profiles/profiles.module';
import { ResultsModule } from './results/results.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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
        // TODO: storage file (certificati, locandine), pagamenti online.
    ],
})
export class AppModule {}
