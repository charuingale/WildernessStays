import {
  IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  guests?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rooms?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialRequests?: string;

  @IsOptional()
  @IsIn(['confirmed', 'pending', 'cancelled'])
  status?: 'confirmed' | 'pending' | 'cancelled';
}
