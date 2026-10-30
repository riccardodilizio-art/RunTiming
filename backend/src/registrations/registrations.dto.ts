import { IsBirthDate } from '../common/validators';
import { Type } from 'class-transformer';
import {
    IsBoolean,
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
    @IsBirthDate() dataNascita!: string;
    @IsIn(['M', 'F']) sesso!: 'M' | 'F';
    @IsOptional() @IsString() @MaxLength(120) societa?: string;
    @IsOptional() @IsString() @MaxLength(20) codiceSocieta?: string;
    @IsOptional() @IsString() @MaxLength(30) tessera?: string;
    @IsOptional() @IsEmail() email?: string;
    /** Con quale tesseramento si iscrive (se assente lo ricava il server). */
    @IsOptional() @IsIn(['fidal', 'runcard', 'eps', 'libero']) tesseramento?: string;
    /** Tesserato verificato su FIDAL/WISE (certificato valido in automatico). */
    @IsOptional() @IsBoolean() fidalVerified?: boolean;
}

/** Minorenne, se la gara la chiede: dichiarazione del genitore o tutore. */
export class GenitoreDto {
    @IsString() @MinLength(1) @MaxLength(80) nome!: string;
    @IsString() @MinLength(1) @MaxLength(80) cognome!: string;
    @IsBoolean() consenso!: boolean;
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
    /** Iscrizione a una combinata dell'evento (raceId = una delle sue gare). */
    @IsOptional() @IsString() @MaxLength(40) combinataId?: string;
    /** Atleta minorenne in una gara che chiede la dichiarazione del genitore. */
    @IsOptional() @ValidateNested() @Type(() => GenitoreDto) genitore?: GenitoreDto;
    /** Solo admin / organizzatore: segna subito come pagata (es. contanti). */
    @IsOptional() @IsBoolean() markPaid?: boolean;
    /** Token anti-robot (Turnstile) per le iscrizioni da ospite, se configurato. */
    @IsOptional() @IsString() @MaxLength(4096) captchaToken?: string;
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
    @IsBirthDate() dataNascita!: string;
}
