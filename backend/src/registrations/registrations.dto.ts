import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEmail,
    IsIn,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';

/** Anagrafica inserita da società / organizzatore (l'atleta usa il suo profilo). */
export class AthleteDataDto {
    @IsString() @MinLength(1) @MaxLength(80) nome!: string;
    @IsString() @MinLength(1) @MaxLength(80) cognome!: string;
    @IsDateString() dataNascita!: string;
    @IsIn(['M', 'F']) sesso!: 'M' | 'F';
    @IsOptional() @IsString() @MaxLength(120) societa?: string;
    @IsOptional() @IsString() @MaxLength(20) codiceSocieta?: string;
    @IsOptional() @IsString() @MaxLength(30) tessera?: string;
    @IsOptional() @IsEmail() email?: string;
    /** Tesserato verificato su FIDAL/WISE (certificato valido in automatico). */
    @IsOptional() @IsBoolean() fidalVerified?: boolean;
}

export class CreateRegistrationDto {
    @IsString() raceId!: string;
    /** Campi extra del modulo gara (chiave = id campo del formSchema). */
    @IsOptional() @IsObject() formData?: Record<string, string | boolean>;
    @IsOptional() @IsString() @MaxLength(40) discountCode?: string;
    /** paypal (anche carte) · bank (bonifico, +maggiorazione) · onsite · online = alias di paypal */
    @IsOptional() @IsIn(['paypal', 'bank', 'onsite', 'online', 'manual']) paymentMethod?: string;
    /** Solo atleta: quale tesseramento usare (default: quello dell'ente gara). */
    @IsOptional() @IsString() affiliationId?: string;
    /** Società / organizzatore / admin: dati dell'atleta da iscrivere. */
    @IsOptional() @ValidateNested() @Type(() => AthleteDataDto) athlete?: AthleteDataDto;
    /** Solo admin / organizzatore: segna subito come pagata (es. contanti). */
    @IsOptional() @IsBoolean() markPaid?: boolean;
}

export class ListQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
    /** Ricerca per cognome / nome / società. */
    @IsOptional() @IsString() @MaxLength(80) q?: string;
    @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'REJECTED']) paymentStatus?: string;
}

export class UpdatePaymentDto {
    @IsIn(['PENDING', 'CONFIRMED', 'REJECTED']) paymentStatus!: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}

export class UpdateCertDto {
    @IsIn(['NON_RICHIESTO', 'IN_ATTESA', 'VERIFICATO', 'RIFIUTATO'])
    certStatus!: 'NON_RICHIESTO' | 'IN_ATTESA' | 'VERIFICATO' | 'RIFIUTATO';
}

/** "Verifica iscrizione" pubblica, sul modello Endu: cognome + data di nascita. */
export class VerifyDto {
    @IsString() @MinLength(2) @MaxLength(80) cognome!: string;
    @IsDateString() dataNascita!: string;
}
