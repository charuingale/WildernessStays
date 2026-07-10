import {
  ConflictException, Injectable, Logger, OnModuleInit, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { User } from '../users/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  exp: number;
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Self-contained auth: scrypt password hashing + HS256 JWTs via node:crypto.
 * No external auth dependencies required.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly secret = process.env.JWT_SECRET || 'wilderness-dev-secret-change-me';
  private readonly ttlSeconds = 7 * 24 * 3600; // 7 days

  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** Guarantee a demo admin exists so the Reservations Desk is usable out of the box. */
  async onModuleInit() {
    const email = 'admin@wilderness.ca';
    const existing = await this.users.findOneBy({ email });
    if (!existing) {
      await this.users.save(
        this.users.create({
          name: 'Lodge Manager',
          email,
          passwordHash: this.hashPassword('admin123'),
          role: 'admin',
        }),
      );
      this.logger.log(`Seeded admin account: ${email} / admin123`);
    }
  }

  /* ---------- passwords ---------- */
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
  }

  /* ---------- tokens ---------- */
  sign(user: User): string {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64url(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + this.ttlSeconds,
      } satisfies JwtPayload),
    );
    const sig = b64url(createHmac('sha256', this.secret).update(`${header}.${payload}`).digest());
    return `${header}.${payload}.${sig}`;
  }

  verify(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Malformed token');
    const [header, payload, sig] = parts;
    const expected = b64url(createHmac('sha256', this.secret).update(`${header}.${payload}`).digest());
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Invalid token');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString()) as JwtPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Session expired — please sign in again');
    return decoded;
  }

  /* ---------- flows ---------- */
  private publicUser(user: User) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async register(name: string, email: string, password: string) {
    const existing = await this.users.findOneBy({ email: email.toLowerCase() });
    if (existing) throw new ConflictException('An account with this email already exists');
    const user = await this.users.save(
      this.users.create({
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash: this.hashPassword(password),
        role: 'guest',
      }),
    );
    return { token: this.sign(user), user: this.publicUser(user) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findOneBy({ email: email.toLowerCase() });
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Incorrect email or password');
    }
    return { token: this.sign(user), user: this.publicUser(user) };
  }
}
