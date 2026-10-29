import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean } from 'class-validator';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import { EventsService } from './events.service';
import { EventDto, EventInfoDto, EventsQueryDto } from './events.dto';

class OpenDto {
    @IsBoolean() isOpen!: boolean;
}

@Controller()
export class EventsController {
    constructor(private readonly events: EventsService) {}

    /** Calendario pubblico: GET /api/events?when=upcoming|past|all&q=&page= */
    @Get('events')
    @Header('Cache-Control', 'public, max-age=60')
    list(@Query() q: EventsQueryDto) {
        return this.events.list(q);
    }

    @Get('events/:slug')
    @Header('Cache-Control', 'public, max-age=60')
    one(@Param('slug') slug: string) {
        return this.events.findOne(slug);
    }

    @Post('events')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    create(@CurrentUser() user: AuthUser, @Body() dto: EventDto) {
        return this.events.create(user, dto);
    }

    @Put('events/:id')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    update(@Param('id') id: string, @Body() dto: EventDto) {
        return this.events.update(id, dto);
    }

    /** Info generali: admin o organizzatore dell'evento. */
    @Patch('events/:id/info')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    updateInfo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EventInfoDto) {
        return this.events.updateInfo(user, id, dto);
    }

    /** Nuova edizione: copia dell'evento con le date all'anno dopo (gare chiuse). */
    @Post('events/:id/copy')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    copy(@Param('id') id: string) {
        return this.events.copy(id);
    }

    @Delete('events/:id')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.events.remove(id);
    }

    /** Apri / chiudi le iscrizioni di una gara. */
    @Patch('races/:id/open')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    setOpen(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OpenDto) {
        return this.events.setRaceOpen(user, id, dto.isOpen);
    }
}
