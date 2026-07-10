import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hotel } from './hotels/hotel.entity';
import { User } from './users/user.entity';
import { Room } from './rooms/room.entity';
import { Booking } from './bookings/booking.entity';
import { HotelsModule } from './hotels/hotels.module';
import { BookingsModule } from './bookings/bookings.module';
import { EventsModule } from './events/events.module';
import { AppCacheModule } from './cache/cache.module';
import { PaymentsModule } from './payments/payments.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: parseInt(config.get('DB_PORT', '5432'), 10),
        username: config.get('DB_USER', 'wilderness'),
        password: config.get('DB_PASSWORD', 'wilderness'),
        database: config.get('DB_NAME', 'wilderness_stays'),
        entities: [Hotel, Booking, User, Room],
        synchronize: true, // dev convenience; use migrations in production
      }),
    }),
    AppCacheModule,
    AuthModule,
    EventsModule,
    PaymentsModule,
    HotelsModule,
    BookingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
