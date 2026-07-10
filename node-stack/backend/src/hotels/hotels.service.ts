import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { Booking } from '../bookings/booking.entity';
import { Room } from '../rooms/room.entity';
import { QueryHotelsDto } from './dto/query-hotels.dto';
import { CacheService } from '../cache/cache.service';

export interface RoomWithAvailability extends Room {
  available: boolean;
}

export interface HotelWithAvailability extends Hotel {
  roomsAvailable: number;
}

@Injectable()
export class HotelsService {
  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    private readonly cache: CacheService,
  ) {}

  /** Room ids in this hotel that are blocked by an active reservation overlapping the range. */
  private async blockedRoomIds(hotelId: string, checkIn: string, checkOut: string): Promise<Set<string>> {
    const rows = await this.bookings
      .createQueryBuilder('b')
      .select('DISTINCT b.roomId', 'roomId')
      .where('b.hotelId = :hotelId', { hotelId })
      .andWhere('b.roomId IS NOT NULL')
      .andWhere("b.status != 'cancelled'")
      .andWhere('b.checkIn < :checkOut AND b.checkOut > :checkIn', { checkIn, checkOut })
      .getRawMany<{ roomId: string }>();
    return new Set(rows.map((r) => r.roomId));
  }

  /** Number of rooms still free in a hotel for the given range. */
  private async freeRoomCount(hotelId: string, checkIn: string, checkOut: string): Promise<number> {
    const total = await this.rooms.countBy({ hotelId });
    const blocked = await this.blockedRoomIds(hotelId, checkIn, checkOut);
    return Math.max(0, total - blocked.size);
  }

  async findAll(query: QueryHotelsDto): Promise<HotelWithAvailability[]> {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const checkIn = query.checkIn || today;
    const checkOut = query.checkOut || tomorrow;

    const cacheKey = `hotels:${JSON.stringify({ ...query, checkIn, checkOut })}`;
    const cached = await this.cache.get<HotelWithAvailability[]>(cacheKey);
    if (cached) return cached;

    const qb = this.hotels.createQueryBuilder('h');
    if (query.place) {
      qb.andWhere('(LOWER(h.place) LIKE :place OR LOWER(h.region) LIKE :place OR LOWER(h.name) LIKE :place)', {
        place: `%${query.place.toLowerCase()}%`,
      });
    }
    if (query.minPrice != null) qb.andWhere('h.pricePerNight >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice != null) qb.andWhere('h.pricePerNight <= :maxPrice', { maxPrice: query.maxPrice });
    qb.orderBy('h.rating', 'DESC');

    const list = await qb.getMany();
    const enriched: HotelWithAvailability[] = [];
    for (const hotel of list) {
      const roomsAvailable = await this.freeRoomCount(hotel.id, checkIn, checkOut);
      if (query.availableOnly === 'true' && roomsAvailable === 0) continue;
      enriched.push({ ...hotel, pricePerNight: Number(hotel.pricePerNight), rating: Number(hotel.rating), roomsAvailable });
    }

    await this.cache.set(cacheKey, enriched, 30);
    return enriched;
  }

  async findOne(id: string, checkIn?: string, checkOut?: string): Promise<HotelWithAvailability> {
    const hotel = await this.hotels.findOneBy({ id });
    if (!hotel) throw new NotFoundException('Hotel not found');
    const ci = checkIn || new Date().toISOString().slice(0, 10);
    const co = checkOut || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const rooms = await this.rooms.find({ where: { hotelId: id }, order: { pricePerNight: 'DESC' } });
    const blocked = await this.blockedRoomIds(id, ci, co);
    const roomsWithAvailability: RoomWithAvailability[] = rooms.map((r) => ({
      ...r,
      pricePerNight: Number(r.pricePerNight),
      available: !blocked.has(r.id),
    }));
    return {
      ...hotel,
      pricePerNight: Number(hotel.pricePerNight),
      rating: Number(hotel.rating),
      roomsAvailable: roomsWithAvailability.filter((r) => r.available).length,
      rooms: roomsWithAvailability,
    };
  }

  /**
   * Per-day availability for a window of days — powers the calendar UI.
   * A day is "occupied" by bookings where checkIn <= day < checkOut.
   */
  async calendar(hotelId: string, start?: string, days = 62, roomId?: string) {
    const hotel = await this.hotels.findOneBy({ id: hotelId });
    if (!hotel) throw new NotFoundException('Hotel not found');
    const startDate = start || new Date().toISOString().slice(0, 10);
    const span = Math.min(Math.max(days, 1), 186);
    const endDate = new Date(Date.parse(startDate) + span * 86400000).toISOString().slice(0, 10);
    const totalRooms = roomId ? 1 : await this.rooms.countBy({ hotelId });

    const cacheKey = `hotels:calendar:${hotelId}:${roomId || 'all'}:${startDate}:${span}`;
    const cached = await this.cache.get<{ date: string; available: number }[]>(cacheKey);
    if (cached) return cached;

    const qb = this.bookings
      .createQueryBuilder('b')
      .select(['b.checkIn AS "checkIn"', 'b.checkOut AS "checkOut"', 'b.roomId AS "roomId"'])
      .where('b.hotelId = :hotelId', { hotelId })
      .andWhere('b.roomId IS NOT NULL')
      .andWhere("b.status != 'cancelled'")
      .andWhere('b.checkIn < :endDate AND b.checkOut > :startDate', { startDate, endDate });
    if (roomId) qb.andWhere('b.roomId = :roomId', { roomId });
    const overlapping = await qb.getRawMany<{ checkIn: string; checkOut: string; roomId: string }>();

    const result: { date: string; available: number; total: number }[] = [];
    for (let i = 0; i < span; i++) {
      const date = new Date(Date.parse(startDate) + i * 86400000).toISOString().slice(0, 10);
      const blockedToday = new Set(
        overlapping
          .filter((b) => String(b.checkIn) <= date && date < String(b.checkOut))
          .map((b) => b.roomId),
      );
      result.push({ date, available: Math.max(0, totalRooms - blockedToday.size), total: totalRooms });
    }

    await this.cache.set(cacheKey, result, 30);
    return result;
  }

  async invalidateCache(): Promise<void> {
    await this.cache.invalidatePrefix('hotels:');
  }
}
