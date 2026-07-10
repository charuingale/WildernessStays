import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryBookingsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['confirmed', 'pending', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsUUID()
  hotelId?: string;
}
