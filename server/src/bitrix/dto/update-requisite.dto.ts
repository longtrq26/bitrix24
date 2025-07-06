import { IsOptional, IsString } from 'class-validator';

export class UpdateRequisiteDto {
  @IsOptional()
  @IsString()
  NAME?: string;

  @IsOptional()
  @IsString()
  RQ_BANK_NAME?: string;

  @IsOptional()
  @IsString()
  RQ_ACC_NUM?: string;
}
