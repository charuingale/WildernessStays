import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'guest' | 'admin';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: 'guest' })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;
}
