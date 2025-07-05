import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { UpdateRequisiteDto } from './update-requisite.dto';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  NAME?: string;

  @IsOptional()
  @IsString()
  LAST_NAME?: string;

  @IsOptional()
  @IsString()
  SECOND_NAME?: string;

  @IsOptional()
  @IsString()
  ADDRESS_1?: string;

  @IsOptional()
  @IsString()
  ADDRESS_CITY?: string;

  @IsOptional()
  @IsString()
  ADDRESS_REGION?: string;

  @IsOptional()
  @IsString()
  ADDRESS_PROVINCE?: string;

  @IsOptional()
  @IsPhoneNumber('VN', { message: 'Must be a valid Vietnamese phone number.' })
  PHONE?: string;

  @IsOptional()
  @IsEmail()
  EMAIL?: string;

  @IsOptional()
  @IsUrl()
  WEB?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRequisiteDto)
  requisite?: UpdateRequisiteDto;
}
