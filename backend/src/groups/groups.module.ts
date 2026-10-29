import { Module } from '@nestjs/common';
import { RegistrationsModule } from '../registrations/registrations.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

/** Iscrizioni di gruppo delle società (un solo pagamento, quote in omaggio). */
@Module({
    imports: [RegistrationsModule],
    controllers: [GroupsController],
    providers: [GroupsService],
})
export class GroupsModule {}
