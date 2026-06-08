import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        HealthModule,
        AuthModule,
        EventsModule,
        // TODO (moduli successivi, stessa struttura): athletes, registrations,
        // societies, races, discounts, results, certificates, fidal, storage, jobs.
    ],
})
export class AppModule {}
