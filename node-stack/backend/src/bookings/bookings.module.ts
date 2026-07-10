import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { Hotel } from '../hotels/hotel.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Hotel]), HotelsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
