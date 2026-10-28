import { Module } from '@nestjs/common';
import { FidalModule } from '../fidal/fidal.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({
    imports: [FidalModule],
    controllers: [RegistrationsController],
    providers: [RegistrationsService],
})
export class RegistrationsModule {}
