# Wilderness Stays — Node Stack 🏔️

Self-contained implementation: **NestJS + PostgreSQL + Redis + Socket.IO** backend with the React frontend.

| Piece | Tech | Port |
|---|---|---|
| API | NestJS (Node.js), TypeORM | 3000 |
| Frontend | React + Vite + Zustand | 5173 |
| Database | PostgreSQL 16 (Docker) | 5432 |
| Cache | Redis 7 (Docker, optional) | 6379 |
| Real-time | Socket.IO | — |

## Run

Prerequisites: Node 18+, Docker.

```bash
# 1. Databases
docker compose up -d

# 2. Backend (terminal 1)
cd backend
npm install
cp .env.example .env       # skip if .env already exists
npm run seed               # 8 hotels × 3 rooms, demo users, sample bookings
npm run start:dev          # http://localhost:3000/api

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev                # open http://localhost:5173
```

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@wilderness.ca | admin123 |
| Guest | guest@example.com | guest123 |

## Verify everything

With the backend running:

```bash
cd backend
npm run smoke              # 17 end-to-end checks
```

## View the database

```bash
docker exec -it wilderness_postgres psql -U wilderness -d wilderness_stays
```

Or connect pgAdmin/DBeaver to `localhost:5432`, db `wilderness_stays`, user/password `wilderness`/`wilderness`. Tables: `hotels`, `rooms`, `bookings`, `users`.

## API

```
GET    /api/health
POST   /api/auth/register | /api/auth/login      GET /api/auth/me
GET    /api/hotels?place=&minPrice=&maxPrice=&availableOnly=&checkIn=&checkOut=
GET    /api/hotels/:id?checkIn=&checkOut=        (rooms[] with per-room availability)
GET    /api/hotels/:id/calendar?start=&days=&roomId=
GET    /api/bookings (admin) | /api/bookings/mine | /api/bookings/export/csv (admin)
POST   /api/bookings        PATCH/DELETE /api/bookings/:id (owner or admin)
WS     socket.io: booking.created|updated|deleted, availability.changed
```

Runs fully independently of the .NET stack — different ports, containers, and database.
