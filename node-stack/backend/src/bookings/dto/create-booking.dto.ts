import {
  IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  hotelId: string;

  @IsUUID()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  guestName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsInt()
  @Min(1)
  @Max(20)
  guests: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialRequests?: string;
}
