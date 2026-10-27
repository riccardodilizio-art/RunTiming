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
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';

// Stessa forma del tipo `Event` del frontend (types/index.ts), così l'EventEditor
// può salvare direttamente. Le parti flessibili (modulo, quote, categorie,
// commissioni, attestato) restano JSON e sono validate solo come oggetti/array.

export class RaceDto {
    /** Id esistente (aggiornamento) o assente (nuova gara). */
    @IsOptional() @IsString() id?: string;
    @IsString() @MinLength(1) @MaxLength(120) name!: string;
    @IsString() @MaxLength(40) distance!: string;
    @IsIn(['linear', 'laps_fixed', 'laps_timed']) raceType!: string;
    @IsOptional() @IsString() ente?: string;
    @IsOptional() @IsIn(['none', 'online', 'onsite', 'both']) paymentMode?: string;
    @IsOptional() @IsBoolean() requiresMedicalCert?: boolean;
    @IsOptional() @IsInt() @Min(0) minAge?: number;
    @IsOptional() @IsInt() @Min(0) maxAge?: number;
    @IsOptional() @IsNumber() @Min(0) price?: number;
    @IsOptional() @IsInt() @Min(0) maxParticipants?: number;
    @IsOptional() @IsBoolean() isOpen?: boolean;
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
    @IsOptional() @IsString() coverImage?: string;
    @IsOptional() @IsString() flyerUrl?: string;
    @IsOptional() @IsString() regulationUrl?: string;
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
    @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => DayDto) days!: DayDto[];
}

export class EventsQueryDto {
    /** upcoming = da oggi in poi (default), past = conclusi, all = tutti */
    @IsOptional() @IsIn(['upcoming', 'past', 'all']) when?: string;
    @IsOptional() @IsString() @MaxLength(80) q?: string;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
