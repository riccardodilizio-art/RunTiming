import { Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, ValidateNested,
} from 'class-validator';
import { AthleteDataDto } from '../registrations/registrations.dto';

export const MAX_GRUPPO = 300;

export class GroupAthleteDto {
    @ValidateNested() @Type(() => AthleteDataDto) athlete!: AthleteDataDto;
    /** Campi del modulo gara compilati per l'atleta (come per l'iscrizione singola). */
    @IsOptional() @IsObject() formData?: Record<string, string | boolean>;
}

export class GroupPreviewDto {
    @IsString() raceId!: string;
    @Type(() => Number) @IsInt() @Min(1) @Max(MAX_GRUPPO) count!: number;
    @IsOptional() @IsIn(['bank', 'onsite']) paymentMethod?: 'bank' | 'onsite';
}

export class CreateGroupDto {
    @IsString() raceId!: string;
    @IsIn(['bank', 'onsite']) paymentMethod!: 'bank' | 'onsite';
    /** La società dichiara di aver raccolto i consensi degli atleti (privacy, regolamento). */
    @IsBoolean() consensi!: boolean;
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_GRUPPO) @ValidateNested({ each: true }) @Type(() => GroupAthleteDto)
    athletes!: GroupAthleteDto[];
}

export class GroupPaymentDto {
    @IsIn(['PENDING', 'CONFIRMED', 'REJECTED']) paymentStatus!: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}

export class GroupListDto {
    @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'REJECTED']) status?: string;
}
