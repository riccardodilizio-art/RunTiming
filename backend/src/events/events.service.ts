import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.event.findMany({
            include: { days: { include: { races: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    findOne(slug: string) {
        return this.prisma.event.findUnique({
            where: { slug },
            include: { days: { include: { races: true } } },
        });
    }
}
