import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryHotelsDto {
  @IsOptional()
  @IsString()
  place?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  availableOnly?: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;
}
