import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRequisiteDto {
  @IsOptional() // Make NAME optional, as it might not always be provided directly in the DTO
  @IsString()
  NAME?: string; // Add this line

  @IsNotEmpty()
  @IsString()
  RQ_BANK_NAME: string; // Tên ngân hàng

  @IsNotEmpty()
  @IsString()
  RQ_ACC_NUM: string; // Số tài khoản ngân hàng
}
