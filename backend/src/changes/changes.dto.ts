import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AthleteDataDto } from '../registrations/registrations.dto';

export class ChangeDto {
    @IsIn(['gara', 'cessione', 'trasferimento']) tipo!: 'gara' | 'cessione' | 'trasferimento';
    /** Cambio gara: la nuova gara (stesso evento). */
    @IsOptional() @IsString() @MaxLength(40) raceId?: string;
    /** Cessione: il nuovo atleta. */
    @IsOptional() @ValidateNested() @Type(() => AthleteDataDto) athlete?: AthleteDataDto;
    @IsOptional() @IsObject() formData?: Record<string, string | boolean>;
    @IsOptional() @IsIn(['paypal', 'bank']) paymentMethod?: 'paypal' | 'bank';
}

export class ChangePaymentDto {
    @IsIn(['CONFIRMED', 'REJECTED']) paymentStatus!: 'CONFIRMED' | 'REJECTED';
}

export class ChangeListDto {
    @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'REJECTED']) status?: string;
}
