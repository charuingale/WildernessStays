import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';
import { Room } from '../rooms/room.entity';
import { randomBytes, scryptSync } from 'crypto';
import hotelsData from './hotels.json';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'wilderness',
  password: process.env.DB_PASSWORD || 'wilderness',
  database: process.env.DB_NAME || 'wilderness_stays',
  entities: [Hotel, Booking, User, Room],
  synchronize: true,
});

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

async function seed() {
  await dataSource.initialize();
  console.log('Connected. Seeding…');

  await dataSource.getRepository(Booking).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Room).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Hotel).createQueryBuilder().delete().execute();
  await dataSource.getRepository(User).createQueryBuilder().delete().execute();

  const hashPassword = (password: string) => {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  };
  const userRepo = dataSource.getRepository(User);
  const admin = await userRepo.save(userRepo.create({
    name: 'Lodge Manager', email: 'admin@wilderness.ca',
    passwordHash: hashPassword('admin123'), role: 'admin',
  }));
  const demoGuest = await userRepo.save(userRepo.create({
    name: 'Maya Desai', email: 'guest@example.com',
    passwordHash: hashPassword('guest123'), role: 'guest',
  }));
  console.log(`Seeded users: ${admin.email} / admin123 (admin), ${demoGuest.email} / guest123 (guest)`);

  const hotelRepo = dataSource.getRepository(Hotel);
  const roomRepo = dataSource.getRepository(Room);
  const hotels: Hotel[] = [];
  const roomsByHotel = new Map<string, Room[]>();
  for (const raw of hotelsData as any[]) {
    const { rooms: roomData, ...hotelFields } = raw;
    const hotel = await hotelRepo.save(hotelRepo.create(hotelFields as Partial<Hotel>));
    hotels.push(hotel);
    const rooms: Room[] = [];
    for (const r of roomData) {
      const room = new Room();
      Object.assign(room, r, { hotelId: hotel.id });
      rooms.push(await roomRepo.save(room));
    }
    roomsByHotel.set(hotel.id, rooms);
  }
  console.log(`Seeded ${hotels.length} hotels with ${[...roomsByHotel.values()].flat().length} rooms.`);

  const bookingRepo = dataSource.getRepository(Booking);
  const sample = [
    { hotel: hotels[0], guestName: 'Maya Desai', email: 'maya.desai@example.com', phone: '+1 403 555 0142', inD: 3, nights: 4, guests: 2, rooms: 1, status: 'confirmed', specialRequests: 'High floor with a mountain view, please.' },
    { hotel: hotels[1], guestName: 'Liam Tremblay', email: 'liam.t@example.com', phone: '+1 514 555 0179', inD: 10, nights: 3, guests: 2, rooms: 1, status: 'confirmed', specialRequests: 'Anniversary trip — late checkout if possible.' },
    { hotel: hotels[3], guestName: 'Sofia Martins', email: 'sofia.m@example.com', phone: '+1 604 555 0114', inD: 1, nights: 5, guests: 4, rooms: 1, status: 'pending', specialRequests: '' },
    { hotel: hotels[4], guestName: 'Noah Campbell', email: 'noah.c@example.com', phone: '+1 250 555 0186', inD: 21, nights: 2, guests: 2, rooms: 1, status: 'confirmed', specialRequests: 'Storm-watching season — ocean-facing room.' },
    { hotel: hotels[6], guestName: 'Émile Roy', email: 'emile.roy@example.com', phone: '+1 819 555 0133', inD: -6, nights: 3, guests: 3, rooms: 1, status: 'cancelled', specialRequests: '' },
  ];
  for (const s of sample) {
    const hotelRooms = roomsByHotel.get(s.hotel.id) || [];
    const room = hotelRooms[Math.min(1, hotelRooms.length - 1)];
    await bookingRepo.save(
      bookingRepo.create({
        hotelId: s.hotel.id,
        roomId: room?.id,
        userId: demoGuest.id,
        guestName: s.guestName,
        email: s.email,
        phone: s.phone,
        checkIn: daysFromNow(s.inD),
        checkOut: daysFromNow(s.inD + s.nights),
        guests: s.guests,
        rooms: s.rooms,
        totalPrice: Number(room?.pricePerNight ?? s.hotel.pricePerNight) * s.nights,
        status: s.status as any,
        paymentRef: `mock_pi_seed_${Math.random().toString(36).slice(2, 10)}`,
        specialRequests: s.specialRequests || null,
      }),
    );
  }
  console.log(`Seeded ${sample.length} bookings.`);
  await dataSource.destroy();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
