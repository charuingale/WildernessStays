import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking } from './booking.entity';
import { Hotel } from '../hotels/hotel.entity';
import { Room } from '../rooms/room.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { EventsGateway } from '../events/events.gateway';
import { PaymentsService } from '../payments/payments.service';
import { HotelsService } from '../hotels/hotels.service';
import type { JwtPayload } from '../auth/auth.service';

const MS_PER_DAY = 86_400_000;

/** Cancellation policy: free until 7 days before check-in, then a 70% fee. */
export const CANCELLATION_POLICY = { freeUntilDaysBefore: 7, lateFeePercent: 70 };

export interface CancellationQuote {
  cancellable: boolean;
  reason: string | null;
  daysUntilCheckIn: number;
  feePercent: number;
  fee: number;
  refund: number;
  freeCancellationUntil: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    private readonly dataSource: DataSource,
    private readonly events: EventsGateway,
    private readonly payments: PaymentsService,
    private readonly hotelsService: HotelsService,
  ) {}

  private nights(checkIn: string, checkOut: string): number {
    const n = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / MS_PER_DAY);
    if (n < 1) throw new BadRequestException('Check-out must be after check-in');
    return n;
  }

  private assertOwnership(booking: Booking, user: JwtPayload) {
    if (user.role !== 'admin' && booking.userId !== user.sub) {
      throw new ForbiddenException('You can only manage your own bookings');
    }
  }

  async findAll(query: QueryBookingsDto & { userId?: string }): Promise<Booking[]> {
    const qb = this.bookings.createQueryBuilder('b').leftJoinAndSelect('b.hotel', 'hotel');
    if (query.userId) qb.andWhere('b.userId = :userId', { userId: query.userId });
    if (query.search) {
      qb.andWhere(
        '(LOWER(b.guestName) LIKE :s OR LOWER(b.email) LIKE :s OR LOWER(hotel.name) LIKE :s OR LOWER(hotel.place) LIKE :s)',
        { s: `%${query.search.toLowerCase()}%` },
      );
    }
    if (query.status) qb.andWhere('b.status = :status', { status: query.status });
    if (query.hotelId) qb.andWhere('b.hotelId = :hotelId', { hotelId: query.hotelId });
    return qb.orderBy('b.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async findOneOwned(id: string, user: JwtPayload): Promise<Booking> {
    const booking = await this.findOne(id);
    this.assertOwnership(booking, user);
    return booking;
  }

  /**
   * Creates a booking inside a SERIALIZABLE transaction with a pessimistic
   * lock on the hotel row, guaranteeing no overbooking under concurrency.
   */
  async create(dto: CreateBookingDto, userId?: string): Promise<Booking> {
    const nights = this.nights(dto.checkIn, dto.checkOut);

    const booking = await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const hotel = await manager.findOne(Hotel, { where: { id: dto.hotelId } });
      if (!hotel) throw new NotFoundException('Hotel not found');

      // Lock the ROOM row: one active reservation blocks this room
      // for any overlapping date range, while sibling rooms stay bookable.
      const room = await manager.findOne(Room, {
        where: { id: dto.roomId, hotelId: dto.hotelId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!room) throw new NotFoundException('Room not found at this hotel');

      if (dto.guests > room.capacity) {
        throw new BadRequestException(
          `${room.name} sleeps up to ${room.capacity} guest(s) — please pick a larger room`,
        );
      }

      const overlapping = await manager
        .createQueryBuilder(Booking, 'b')
        .where('b.roomId = :roomId', { roomId: dto.roomId })
        .andWhere("b.status != 'cancelled'")
        .andWhere('b.checkIn < :checkOut AND b.checkOut > :checkIn', {
          checkIn: dto.checkIn,
          checkOut: dto.checkOut,
        })
        .getCount();

      if (overlapping > 0) {
        throw new ConflictException(
          `${room.name} at ${hotel.name} is already booked for those dates — pick another room or different dates`,
        );
      }

      const totalPrice = Number(room.pricePerNight) * nights;
      const payment = await this.payments.charge(
        totalPrice,
        `${hotel.name} · ${room.name} — ${dto.checkIn} to ${dto.checkOut}`,
      );

      const entity = manager.create(Booking, {
        ...dto,
        rooms: 1,
        userId: userId || null,
        totalPrice,
        status: 'confirmed',
        paymentRef: payment.ref,
      });
      return manager.save(entity);
    });

    await this.hotelsService.invalidateCache();
    const full = await this.findOne(booking.id);
    this.events.emitBookingCreated(full);
    this.events.emitAvailabilityChanged(dto.hotelId);
    return full;
  }

  async update(id: string, dto: UpdateBookingDto, user: JwtPayload): Promise<Booking> {
    const booking = await this.findOne(id);
    this.assertOwnership(booking, user);

    // Cancellations always go through the policy, even via PATCH.
    if (dto.status === 'cancelled' && booking.status !== 'cancelled') {
      return this.cancel(id, user);
    }

    // Completed stays are immutable history for guests (admins may still correct records).
    const todayStr = new Date().toISOString().slice(0, 10);
    if (user.role !== 'admin' && booking.checkOut < todayStr) {
      throw new BadRequestException('This stay is in the past and can no longer be changed');
    }
    const merged = { ...booking, ...dto };
    const nights = this.nights(merged.checkIn, merged.checkOut);

    // Re-check the room is free when the booking stays (or becomes) active.
    if (merged.status !== 'cancelled' && booking.roomId) {
      const clash = await this.bookings
        .createQueryBuilder('b')
        .where('b.roomId = :roomId', { roomId: booking.roomId })
        .andWhere('b.id != :id', { id })
        .andWhere("b.status != 'cancelled'")
        .andWhere('b.checkIn < :checkOut AND b.checkOut > :checkIn', {
          checkIn: merged.checkIn,
          checkOut: merged.checkOut,
        })
        .getCount();
      if (clash > 0) {
        throw new ConflictException(
          `${booking.room?.name || 'This room'} at ${booking.hotel.name} is already booked for those dates`,
        );
      }
    }
    if (booking.room && merged.guests > booking.room.capacity) {
      throw new BadRequestException(
        `${booking.room.name} sleeps up to ${booking.room.capacity} guest(s)`,
      );
    }

    const nightlyRate = Number(booking.room?.pricePerNight ?? booking.hotel.pricePerNight);
    merged.totalPrice = nightlyRate * nights;

    // Re-activating a cancelled booking clears its cancellation record.
    if (booking.status === 'cancelled' && merged.status !== 'cancelled') {
      merged.cancelledAt = null;
      merged.cancellationFee = null;
      merged.refundAmount = null;
      merged.refundRef = null;
    }

    await this.bookings.save(merged);
    await this.hotelsService.invalidateCache();
    const full = await this.findOne(id);
    this.events.emitBookingUpdated(full);
    this.events.emitAvailabilityChanged(full.hotelId);
    return full;
  }

  /** Compute the refund/fee for cancelling a booking today. */
  quoteFor(booking: Booking): CancellationQuote {
    const todayStr = new Date().toISOString().slice(0, 10);
    const daysUntilCheckIn = Math.round((Date.parse(booking.checkIn) - Date.parse(todayStr)) / MS_PER_DAY);
    const freeCancellationUntil = new Date(
      Date.parse(booking.checkIn) - CANCELLATION_POLICY.freeUntilDaysBefore * MS_PER_DAY,
    ).toISOString().slice(0, 10);
    const total = Number(booking.totalPrice);

    if (booking.status === 'cancelled') {
      return { cancellable: false, reason: 'This booking is already cancelled', daysUntilCheckIn, feePercent: 0, fee: 0, refund: 0, freeCancellationUntil };
    }
    if (daysUntilCheckIn < 1) {
      return { cancellable: false, reason: 'Bookings cannot be cancelled on or after the check-in date', daysUntilCheckIn, feePercent: 0, fee: 0, refund: 0, freeCancellationUntil };
    }
    const feePercent = daysUntilCheckIn >= CANCELLATION_POLICY.freeUntilDaysBefore ? 0 : CANCELLATION_POLICY.lateFeePercent;
    const fee = Math.round(total * feePercent) / 100;
    return {
      cancellable: true,
      reason: null,
      daysUntilCheckIn,
      feePercent,
      fee,
      refund: Math.round((total - fee) * 100) / 100,
      freeCancellationUntil,
    };
  }

  async quote(id: string, user: JwtPayload): Promise<CancellationQuote> {
    const booking = await this.findOne(id);
    this.assertOwnership(booking, user);
    return this.quoteFor(booking);
  }

  /** Cancel under the policy: refund what's due, keep the fee, free the room. */
  async cancel(id: string, user: JwtPayload): Promise<Booking> {
    const booking = await this.findOne(id);
    this.assertOwnership(booking, user);
    const q = this.quoteFor(booking);
    if (!q.cancellable) throw new BadRequestException(q.reason);

    const refund = await this.payments.refund(q.refund, booking.paymentRef);
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationFee = q.fee;
    booking.refundAmount = q.refund;
    booking.refundRef = refund.ref;
    await this.bookings.save(booking);

    await this.hotelsService.invalidateCache();
    const full = await this.findOne(id);
    this.events.emitBookingUpdated(full);
    this.events.emitAvailabilityChanged(full.hotelId);
    return full;
  }

  async remove(id: string, user: JwtPayload): Promise<{ deleted: true }> {
    const booking = await this.findOne(id);
    this.assertOwnership(booking, user);
    await this.bookings.delete(id);
    await this.hotelsService.invalidateCache();
    this.events.emitBookingDeleted(id);
    this.events.emitAvailabilityChanged(booking.hotelId);
    return { deleted: true };
  }

  async exportCsv(query: QueryBookingsDto): Promise<string> {
    const rows = await this.findAll(query);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Booking ID', 'Hotel', 'Room', 'Location', 'Guest', 'Email', 'Phone',
      'Check-in', 'Check-out', 'Guests', 'Rooms', 'Total (CAD)', 'Status', 'Cancellation Fee', 'Refund', 'Payment Ref', 'Created',
    ].join(',');
    const lines = rows.map((b) =>
      [
        b.id, b.hotel?.name, b.room?.name, b.hotel ? `${b.hotel.place}, ${b.hotel.region}` : '',
        b.guestName, b.email, b.phone, b.checkIn, b.checkOut, b.guests, b.rooms,
        Number(b.totalPrice).toFixed(2), b.status,
        b.cancellationFee != null ? Number(b.cancellationFee).toFixed(2) : '',
        b.refundAmount != null ? Number(b.refundAmount).toFixed(2) : '',
        b.paymentRef,
        b.createdAt.toISOString(),
      ].map(esc).join(','),
    );
    return [header, ...lines].join('\r\n');
  }
}
