import {
  IsString,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsUrl,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRequisiteDto } from './create-requisite.dto';

export class CreateContactDto {
  @IsNotEmpty()
  @IsString()
  NAME: string; // Tên contact (first name)

  @IsOptional()
  @IsString()
  LAST_NAME?: string; // Tên contact (last name - Bitrix convention)

  @IsOptional()
  @IsString()
  SECOND_NAME?: string; // Tên đệm (middle name - Bitrix convention)

  @IsOptional()
  @IsString()
  ADDRESS_1?: string; // Địa chỉ - đường/số nhà

  @IsOptional()
  @IsString()
  ADDRESS_CITY?: string; // Tỉnh/Thành phố

  @IsOptional()
  @IsString()
  ADDRESS_REGION?: string; // Quận/Huyện

  @IsOptional()
  @IsString()
  ADDRESS_PROVINCE?: string; // Phường/Xã (often mapped to Province in Bitrix for finer grain)

  @IsOptional()
  @IsPhoneNumber('VN', { message: 'Must be a valid Vietnamese phone number.' }) // Adjust 'VN' if different country
  PHONE?: string;

  @IsOptional()
  @IsEmail()
  EMAIL?: string;

  @IsOptional()
  @IsUrl()
  WEB?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRequisiteDto)
  requisite?: CreateRequisiteDto; // Thông tin ngân hàng
}
