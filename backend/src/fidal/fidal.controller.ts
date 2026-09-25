import {
    BadRequestException, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FidalService } from './fidal.service';

// API pulita esposta al frontend. Il frontend chiama SEMPRE queste rotte, mai
// WISE direttamente (che è HTTP, cookie-based e cross-origin).
//
// TODO: proteggere con guard RBAC (admin/organizzatore) quando l'auth sarà
// cablata su tutti i moduli.
@Controller('fidal')
export class FidalController {
    constructor(private readonly fidal: FidalService) {}

    /** GET /api/fidal/verifica?tessera=NC000657 */
    @Get('verifica')
    verifica(@Query('tessera') tessera?: string) {
        if (!tessera?.trim()) throw new BadRequestException('Parametro "tessera" mancante');
        return this.fidal.verifyByTessera(tessera.trim());
    }

    /** GET /api/fidal/cerca?cognome=Rossi&nome=Marco&categoria=0&societa=0 */
    @Get('cerca')
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

    /** GET /api/fidal/societa/:codice */
    @Get('societa/:codice')
    societa(@Param('codice') codice: string) {
        if (!codice?.trim()) throw new BadRequestException('Codice società mancante');
        return this.fidal.listBySociety(codice.trim());
    }

    /**
     * POST /api/fidal/import — carica il dump tesseramenti FIDAL (.xlsx) come
     * campo "file" (multipart). È l'unica fonte della scadenza certificato.
     * TODO: proteggere con guard admin.
     */
    @Post('import')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
    importDump(@UploadedFile() file?: Express.Multer.File) {
        if (!file?.buffer?.length) throw new BadRequestException('File .xlsx mancante');
        return this.fidal.importDump(file.buffer);
    }
}
