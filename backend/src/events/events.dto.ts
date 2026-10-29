import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsDateString,
    IsIn,
    IsInt,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

// Stessa forma del tipo `Event` del frontend (types/index.ts), così l'EventEditor
// può salvare direttamente. Le parti flessibili (modulo, quote, categorie,
// commissioni, attestato) restano JSON e sono validate solo come oggetti/array.

/** https://… , http://… oppure un percorso del sito (/immagini/…). */
const SAFE_URL = /^(https?:\/\/[^\s<>"']+|\/(?!\/)[^\s<>"']*)$/i;

export class RaceDto {
    /** Id esistente (aggiornamento) o assente (nuova gara). */
    @IsOptional() @IsString() id?: string;
    @IsString() @MinLength(1) @MaxLength(120) name!: string;
    @IsString() @MaxLength(40) distance!: string;
    @IsIn(['linear', 'laps_fixed', 'laps_timed']) raceType!: string;
    @IsOptional() @IsString() ente?: string;
    /** Tesseramenti ammessi (vuoto = tutti). */
    @IsOptional() @IsArray() @ArrayMaxSize(4) @IsIn(['fidal', 'runcard', 'eps', 'libero'], { each: true }) ammessi?: string[];
    /** Iscrizioni di gruppo: { ogni: 10, gratis: 1 } oppure null. */
    @IsOptional() @IsObject() gruppoOmaggi?: Record<string, unknown> | null;
    @IsOptional() @IsIn(['none', 'online', 'onsite', 'both']) paymentMode?: string;
    @IsOptional() @IsBoolean() requiresMedicalCert?: boolean;
    @IsOptional() @IsInt() @Min(0) minAge?: number;
    @IsOptional() @IsInt() @Min(0) maxAge?: number;
    @IsOptional() @IsNumber() @Min(0) price?: number;
    @IsOptional() @IsInt() @Min(0) maxParticipants?: number;
    @IsOptional() @IsBoolean() isOpen?: boolean;
    /** Chiusura automatica delle iscrizioni (ISO); null = solo a mano. */
    @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() chiusuraIscrizioni?: string | null;
    @IsOptional() @IsInt() @Min(0) @Max(10000) maxPerSocieta?: number;
    @IsOptional() @IsArray() formSchema?: unknown[];
    @IsOptional() @IsArray() priceSteps?: unknown[];
    @IsOptional() @IsArray() @IsString({ each: true }) publicFields?: string[];
    @IsOptional() @IsArray() @IsIn(['category', 'payment', 'cert'], { each: true }) publicColumns?: string[];
    @IsOptional() @IsArray() categories?: unknown[];
    @IsOptional() @IsObject() commission?: Record<string, unknown>;
    @IsOptional() @IsObject() certificateTemplate?: Record<string, unknown>;
}

export class DayDto {
    @IsOptional() @IsString() id?: string;
    @IsDateString() date!: string;
    @IsOptional() @IsString() @MaxLength(80) label?: string;
    @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => RaceDto) races!: RaceDto[];
}

/** Informazioni generali: le uniche modificabili anche dall'organizzatore. */
export class EventInfoDto {
    @IsOptional() @IsString() @MinLength(3) @MaxLength(160) title?: string;
    @IsOptional() @IsString() category?: string;
    @IsOptional() @IsString() location?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() province?: string;
    @IsOptional() @IsNumber() lat?: number;
    @IsOptional() @IsNumber() lng?: number;
    // Solo link http(s) o percorsi del sito: niente javascript:, data: o altri schemi
    @IsOptional() @Matches(SAFE_URL, { message: 'Link non valido (usa https://…)' }) @MaxLength(2000) coverImage?: string;
    @IsOptional() @Matches(SAFE_URL, { message: 'Link non valido (usa https://…)' }) @MaxLength(2000) flyerUrl?: string;
    @IsOptional() @Matches(SAFE_URL, { message: 'Link non valido (usa https://…)' }) @MaxLength(2000) regulationUrl?: string;
    @IsOptional() @IsString() @MaxLength(20000) description?: string;
    @IsOptional() @IsString() organizer?: string;
    @IsOptional() @IsObject() routeInfo?: Record<string, unknown>;
}

/** Evento completo (solo admin): info + flag + commissione + giornate e gare. */
export class EventDto extends EventInfoDto {
    @IsString() @MinLength(3) @MaxLength(160) declare title: string;
    @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
    @IsOptional() @IsBoolean() isFeatured?: boolean;
    @IsOptional() @IsBoolean() isLive?: boolean;
    @IsOptional() @IsObject() commission?: Record<string, unknown>;
    /** Combinate [{ id, nome, raceIds, prezzo }]: raceIds possono essere id provvisori di gare nuove. */
    @IsOptional() @IsArray() @ArrayMaxSize(20) combinate?: unknown[];
    @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => DayDto) days!: DayDto[];
}

export class EventsQueryDto {
    /** upcoming = da oggi in poi (default), past = conclusi, all = tutti */
    @IsOptional() @IsIn(['upcoming', 'past', 'all']) when?: string;
    @IsOptional() @IsString() @MaxLength(80) q?: string;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
