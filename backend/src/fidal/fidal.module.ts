import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WiseClient } from './wise.client';
import { FidalService } from './fidal.service';
import { FidalController } from './fidal.controller';

@Module({
    imports: [PrismaModule],
    controllers: [FidalController],
    providers: [WiseClient, FidalService],
    exports: [FidalService],
})
export class FidalModule {}
