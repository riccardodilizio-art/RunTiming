import { IsBirthDate } from '../common/validators';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEmail,
    IsIn,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    Matches,
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
    @IsOptional() @IsIn(['fidal', 'runcard', 'estero', 'eps', 'libero']) tesseramento?: string;
    /** Nazionalità, codice a 3 lettere (default ITA). */
    @IsOptional() @Matches(/^[A-Za-z]{3}$/) nazionalita?: string;
    /** Straniero tesserato nel suo paese: la federazione (es. FFA). */
    @IsOptional() @IsString() @MaxLength(60) federazione?: string;
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

/** Staffetta: il capitano (frazione 1) iscrive tutta la squadra. */
export class CreateStaffettaDto {
    @IsString() raceId!: string;
    @IsString() @MinLength(1) @MaxLength(60) squadra!: string;
    /** In ordine di frazione: il primo è il capitano. */
    @IsArray() @ArrayMinSize(2) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AthleteDataDto)
    frazionisti!: AthleteDataDto[];
    /** Consensi e campi extra del modulo (dati dal capitano per la squadra). */
    @IsOptional() @IsObject() formData?: Record<string, string | boolean>;
    @IsOptional() @IsString() @MaxLength(40) discountCode?: string;
    @IsOptional() @IsIn(['paypal', 'bank', 'onsite', 'online', 'manual']) paymentMethod?: string;
    @IsOptional() @ValidateNested() @Type(() => GenitoreDto) genitore?: GenitoreDto;
    @IsOptional() @IsBoolean() markPaid?: boolean;
    @IsOptional() @IsString() @MaxLength(4096) captchaToken?: string;
}

/** Staffetta: cambio di un frazionista (frazione 2..n). */
export class FrazionistaDto {
    @IsInt() @Min(2) @Max(10) frazione!: number;
    @ValidateNested() @Type(() => AthleteDataDto) atleta!: AthleteDataDto;
}

/** Import da Excel: una riga del file (numero di riga per spiegare gli errori). */
export class ImportRigaDto {
    @IsInt() @Min(1) @Max(100_000) riga!: number;
    @ValidateNested() @Type(() => AthleteDataDto) atleta!: AthleteDataDto;
}

/** Import da Excel della segreteria / organizzatore. */
export class ImportDto {
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => ImportRigaDto)
    righe!: ImportRigaDto[];
    /** pagato = già incassato · sul_posto = da pagare al ritiro · gratuito */
    @IsIn(['pagato', 'sul_posto', 'gratuito']) pagamento!: 'pagato' | 'sul_posto' | 'gratuito';
    /** Anteprima: controlla le righe senza scrivere. */
    @IsOptional() @IsBoolean() prova?: boolean;
}
