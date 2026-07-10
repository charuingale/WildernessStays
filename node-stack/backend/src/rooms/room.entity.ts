import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';

/** A physical, individually bookable room. One active reservation blocks it for that date range. */
@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Hotel, (h) => h.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column()
  hotelId: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('int', { default: 2 })
  capacity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerNight: number;

  @Column('simple-array')
  amenities: string[];

  @Column('simple-array')
  images: string[];

  @CreateDateColumn()
  createdAt: Date;
}
