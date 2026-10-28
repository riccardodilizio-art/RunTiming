import {
    BadRequestException, Controller, ForbiddenException, Get, Logger, Param, Post, Query, ServiceUnavailableException, UploadedFile,
    UseGuards, UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normName } from '../registrations/rules';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, AuthUser, CurrentUser, Roles, ThrottlePerIp } from '../common/auth';
import { FileInterceptor } from '@nestjs/platform-express';
import { FidalService } from './fidal.service';

// API pulita esposta al frontend. Il frontend chiama SEMPRE queste rotte, mai
// WISE direttamente (che è HTTP, cookie-based e cross-origin).
// Pubblica solo la verifica tessera (con cognome + data di nascita); ricerca per
// nome e roster società sono riservati; gli import del database solo all'admin.
@Controller('fidal')
export class FidalController {
    private readonly log = new Logger(FidalController.name);

    constructor(
        private readonly fidal: FidalService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * GET /api/fidal/verifica?tessera=…&cognome=…&dataNascita=AAAA-MM-GG — pubblica
     * (serve all'iscrizione senza account). Risponde "tesserato" solo se tessera,
     * cognome E data di nascita corrispondono, e non restituisce né la data di
     * nascita né la scadenza del certificato: chi conosce solo tessera e cognome
     * non scopre altro. Limite sempre per IP (il login non dà più tentativi).
     */
    @Get('verifica')
    @ThrottlePerIp()
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    async verifica(@Query('tessera') tessera?: string, @Query('cognome') cognome?: string, @Query('dataNascita') dataNascita?: string) {
        if (!tessera?.trim() || tessera.length > 30) throw new BadRequestException('Parametro "tessera" mancante');
        if (!cognome?.trim()) throw new BadRequestException('Indica anche il cognome');
        if (!dataNascita || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascita)) throw new BadRequestException('Indica anche la data di nascita (AAAA-MM-GG)');
        let r: Awaited<ReturnType<FidalService['verifyByTessera']>>;
        try {
            r = await this.fidal.verifyByTessera(tessera.trim());
        } catch (e) {
            this.log.warn(`Verifica FIDAL non riuscita: ${(e as Error).message}`);
            throw new ServiceUnavailableException('Verifica FIDAL non disponibile in questo momento: compila i dati a mano');
        }
        const a = r.atleta;
        if (!a || normName(a.cognome) !== normName(cognome) || a.dataNascita?.slice(0, 10) !== dataNascita) {
            return { tessera: r.tessera, tesserato: false, atleta: null };
        }
        // Niente data di nascita (la conosce già chi chiede) né scadenza certificato (dato sanitario)
        const { certScadenza: _cert, dataNascita: _dob, ...atleta } = a;
        void _cert; void _dob;
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

    /**
     * GET /api/fidal/societa/:codice — staff, oppure la società stessa per il
     * proprio codice, solo dopo che l'admin l'ha approvato.
     */
    @Get('societa/:codice')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER, Role.SOCIETY)
    async societa(@CurrentUser() user: AuthUser, @Param('codice') codice: string) {
        if (!codice?.trim()) throw new BadRequestException('Codice società mancante');
        if (user.role === Role.SOCIETY) {
            const s = await this.prisma.society.findUnique({
                where: { accountId: user.sub },
                select: { codiceFidal: true, fidalApproved: true },
            });
            if (!s?.codiceFidal || s.codiceFidal.toUpperCase() !== codice.trim().toUpperCase()) {
                throw new ForbiddenException('Puoi vedere solo gli atleti della tua società');
            }
            if (!s.fidalApproved) {
                throw new ForbiddenException('Codice FIDAL in attesa di approvazione da parte di TimingRun');
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
