import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
    constructor(private readonly events: EventsService) {}

    @Get()
    all() {
        return this.events.findAll();
    }

    @Get(':slug')
    one(@Param('slug') slug: string) {
        return this.events.findOne(slug);
    }
}
