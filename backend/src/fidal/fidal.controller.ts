import {
    BadRequestException, Controller, ForbiddenException, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normName } from '../registrations/rules';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import { FileInterceptor } from '@nestjs/platform-express';
import { FidalService } from './fidal.service';

// API pulita esposta al frontend. Il frontend chiama SEMPRE queste rotte, mai
// WISE direttamente (che è HTTP, cookie-based e cross-origin).
// Le ricerche restano pubbliche (servono all'iscrizione senza account);
// gli import del database FIDAL sono riservati all'admin.
@Controller('fidal')
export class FidalController {
    constructor(
        private readonly fidal: FidalService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * GET /api/fidal/verifica?tessera=NC000657&cognome=Rossi — pubblica (serve
     * all'iscrizione senza account) ma risponde solo a chi conosce tessera E
     * cognome, e senza la scadenza del certificato (dato sanitario).
     */
    @Get('verifica')
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    async verifica(@Query('tessera') tessera?: string, @Query('cognome') cognome?: string) {
        if (!tessera?.trim()) throw new BadRequestException('Parametro "tessera" mancante');
        if (!cognome?.trim()) throw new BadRequestException('Indica anche il cognome');
        const r = await this.fidal.verifyByTessera(tessera.trim());
        if (!r.atleta || normName(r.atleta.cognome) !== normName(cognome)) {
            return { tessera: r.tessera, tesserato: false, atleta: null };
        }
        const { certScadenza: _cert, ...atleta } = r.atleta;
        void _cert;
        return { tessera: r.tessera, tesserato: true, atleta };
    }

    /**
     * GET /api/fidal/cerca?cognome=Rossi — solo admin e organizzatori (dati personali).
     * Le società no: l'account società si crea liberamente, quindi non è "staff".
     */
    @Get('cerca')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    cerca(
        @Query('cognome') cognome?: string,
        @Query('nome') nome?: string,
        @Query('categoria') categoria?: string,
        @Query('societa') societa?: string,
    ) {
        if (!cognome?.trim() && !nome?.trim()) {
            throw new BadRequestException('Indicare almeno cognome o nome');
        }
        return this.fidal.searchByParams(
            cognome?.trim() ?? '',
            nome?.trim() ?? '',
            Number(categoria ?? 0) || 0,
            Number(societa ?? 0) || 0,
        );
    }

    /** GET /api/fidal/societa/:codice — staff, oppure la società stessa per il proprio codice. */
    @Get('societa/:codice')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER, Role.SOCIETY)
    async societa(@CurrentUser() user: AuthUser, @Param('codice') codice: string) {
        if (!codice?.trim()) throw new BadRequestException('Codice società mancante');
        if (user.role === Role.SOCIETY) {
            const s = await this.prisma.society.findUnique({ where: { accountId: user.sub }, select: { codiceFidal: true } });
            if (!s?.codiceFidal || s.codiceFidal.toUpperCase() !== codice.trim().toUpperCase()) {
                throw new ForbiddenException('Puoi vedere solo gli atleti della tua società');
            }
        }
        return this.fidal.listBySociety(codice.trim());
    }

    /**
     * POST /api/fidal/import — dump tesseramenti FIDAL atleti (.csv o .xlsx)
     * come campo "file" (multipart). Fonte di scadenza cert e data di nascita.
     */
    @Post('import')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
    importDump(@UploadedFile() file?: Express.Multer.File) {
        if (!file?.buffer?.length) throw new BadRequestException('File dump mancante');
        return this.fidal.importDump(file.buffer, file.originalname);
    }

    /**
     * POST /api/fidal/import-societa — anagrafica società FIDAL (.csv) come
     * campo "file" (multipart). Fornisce la denominazione reale per codice.
     */
    @Post('import-societa')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
    importSocieties(@UploadedFile() file?: Express.Multer.File) {
        if (!file?.buffer?.length) throw new BadRequestException('File società mancante');
        return this.fidal.importSocieties(file.buffer);
    }
}
