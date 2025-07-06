import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRequisiteDto {
  @IsOptional()
  @IsString()
  NAME?: string;

  @IsNotEmpty()
  @IsString()
  RQ_BANK_NAME: string;

  @IsNotEmpty()
  @IsString()
  RQ_ACC_NUM: string;
}
