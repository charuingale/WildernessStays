import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';
import { User } from '../users/user.entity';
import { Room } from '../rooms/room.entity';

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Hotel, (h) => h.bookings, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column()
  hotelId: string;

  @ManyToOne(() => Room, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column({ nullable: true })
  roomId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Column()
  guestName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column('date')
  checkIn: string;

  @Column('date')
  checkOut: string;

  @Column('int', { default: 1 })
  guests: number;

  @Column('int', { default: 1 })
  rooms: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ default: 'confirmed' })
  status: BookingStatus;

  @Column({ nullable: true })
  paymentRef: string;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cancellationFee: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  refundAmount: number | null;

  @Column({ nullable: true })
  refundRef: string;

  @Column('text', { nullable: true })
  specialRequests: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
