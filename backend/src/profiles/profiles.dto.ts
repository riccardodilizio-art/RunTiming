import { IsBirthDate } from '../common/validators';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEmail,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';

export const ENTI = ['fidal', 'runcard', 'uisp', 'csi', 'acsi', 'aics', 'libertas', 'altro', 'non_competitiva'];

export class AffiliationDto {
    @IsIn(ENTI) ente!: string;
    @IsString() @MinLength(1) @MaxLength(120) societaNome!: string;
    @IsOptional() @IsString() @MaxLength(20) codiceSocieta?: string;
    @IsOptional() @IsString() @MaxLength(30) numeroTessera?: string;
    @IsOptional() @IsDateString() certScadenza?: string;
    @IsOptional() @IsIn(['fidal_db', 'manual']) source?: string;
}

export class AthleteProfileDto {
    @IsString() @MinLength(1) @MaxLength(80) nome!: string;
    @IsString() @MinLength(1) @MaxLength(80) cognome!: string;
    @IsBirthDate() dataNascita!: string;
    @IsIn(['M', 'F']) sesso!: string;
    @IsOptional() @Matches(/^[A-Za-z0-9]{16}$/, { message: 'Codice fiscale non valido' }) codFiscale?: string;
    @IsOptional() @IsString() @MaxLength(30) phone?: string;
    @IsOptional() @IsString() @MaxLength(120) club?: string;
    @IsOptional() @IsIn(['agonistico', 'non_agonistico', 'esenzione']) certType?: string;
    @IsOptional() @IsDateString() certExpiry?: string;
    @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AffiliationDto)
    affiliations?: AffiliationDto[];
}

export class SocietyProfileDto {
    @IsString() @MinLength(2) @MaxLength(120) societaNome!: string;
    @IsIn(ENTI) ente!: string;
    @IsOptional() @IsString() @MaxLength(20) codiceFidal?: string;
    /** Roster come nel prototipo (RosterAthlete[]). */
    @IsOptional() @IsArray() @ArrayMaxSize(2000) roster?: unknown[];
}

export class SocietyFidalDecisionDto {
    @IsBoolean() approved!: boolean;
}

export class CertDecisionDto {
    @IsIn(['VERIFICATO', 'RIFIUTATO', 'IN_ATTESA']) certStatus!: 'VERIFICATO' | 'RIFIUTATO' | 'IN_ATTESA';
}

export class CreateStaffDto {
    @IsEmail() email!: string;
    @IsString() @MinLength(8) @MaxLength(128) password!: string;
    @IsIn(['ADMIN', 'ORGANIZER']) role!: 'ADMIN' | 'ORGANIZER';
    @IsOptional() @IsString() @MaxLength(120) displayName?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) assignedEventIds?: string[];
}

export class UpdateStaffDto {
    @IsOptional() @IsString() @MaxLength(120) displayName?: string;
    /** true = account disattivato (niente accesso, login aperti chiusi subito). */
    @IsOptional() @IsBoolean() disabled?: boolean;
    @IsOptional() @IsArray() @IsString({ each: true }) assignedEventIds?: string[];
}

export class SearchDto {
    @IsOptional() @IsString() @MaxLength(80) q?: string;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
