import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Room } from '../rooms/room.entity';

export interface NearbyPlace {
  name: string;
  distance: string;
  type: string;
}

@Entity('hotels')
export class Hotel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  place: string;

  @Column()
  region: string;

  @Column('text')
  description: string;

  @Column('text')
  roomDescription: string;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerNight: number;

  @Column('decimal', { precision: 2, scale: 1, default: 4.5 })
  rating: number;

  @Column('int', { default: 10 })
  roomsTotal: number;

  @Column('simple-array')
  amenities: string[];

  @Column('simple-array')
  images: string[];

  @Column('jsonb', { default: [] })
  nearbyPlaces: NearbyPlace[];

  @OneToMany(() => Booking, (b) => b.hotel)
  bookings: Booking[];

  @OneToMany(() => Room, (r) => r.hotel)
  rooms: Room[];

  @CreateDateColumn()
  createdAt: Date;
}
