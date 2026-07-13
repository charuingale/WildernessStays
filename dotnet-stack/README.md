# Wilderness Stays — .NET Stack 🏔️

Self-contained implementation: **ASP.NET Core 8 + EF Core + PostgreSQL + Redis + SignalR** backend with the React frontend (dependency-free SignalR client).

| Piece | Tech | Port |
|---|---|---|
| API | ASP.NET Core 8, EF Core + Npgsql | 3001 |
| Frontend | React + Vite + Zustand | 5174 |
| Database | PostgreSQL 16 (Docker) | 5434 |
| Cache | Redis 7 (Docker, optional) | 6380 |
| Real-time | SignalR at /hubs/events | — |

## Architecture (layered)

```
core/      WildernessStays.Core  — class library, packaged as a NuGet package
           entities · EF Core DbContext · seeding · booking rules · availability
           engine · auth · caching · payments · domain exceptions · event abstraction
backend/   WildernessStays.Api   — thin ASP.NET Core host
           controllers · SignalR hub · JWT wiring · exception→HTTP mapping
```

The API references the library as a **NuGet package** (`WildernessStays.Core 1.0.0`)
served from the `local-packages/` folder feed (see `nuget.config`). After changing
library code, repack and bump/clear the cache:

```bash
dotnet pack core -c Release -o local-packages
```

## Run

Prerequisites: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0), Node 18+ (frontend only), Docker.

```bash
# 1. Databases
docker compose up -d

# 2. Build the core library package, then run the API (terminal 1)
dotnet pack core -c Release -o local-packages
cd backend
dotnet run                 # restores packages, creates + seeds wilderness_stays_net,
                           # serves http://localhost:3001/api — Swagger at /swagger

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev                # open http://localhost:5174
```

Seeding is automatic on first start (8 hotels × 3 rooms, demo users, sample bookings).

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@wilderness.ca | admin123 |
| Guest | guest@example.com | guest123 |

## Verify everything

With the backend running:

```bash
node smoke-test.mjs        # 17 end-to-end checks against :3001
```

## Cancellation policy

Free cancellation until **7 days before check-in** (100% refund). Within 7 days of
check-in, a **70% cancellation fee** applies (30% refunded). Bookings can't be
cancelled on or after the check-in date. Cancelled bookings record the fee, refund
amount, refund reference, and timestamp; refunds go through Stripe when configured,
mock references otherwise.

```
GET  /api/bookings/:id/cancellation-quote   preview fee & refund before confirming
POST /api/bookings/:id/cancel               cancel under the policy
```

## View the database

```bash
docker exec -it wilderness_postgres_net psql -U wilderness -d wilderness_stays_net
```

Or connect pgAdmin/DBeaver to `localhost:5434`, db `wilderness_stays_net`, user/password `wilderness`/`wilderness`. Tables: `hotels`, `rooms`, `bookings`, `users`.

## API

Same contract as the Node stack (see its README) on port 3001, plus interactive docs at `http://localhost:3001/swagger`. Real-time uses SignalR instead of Socket.IO — the frontend already speaks it natively.

Runs fully independently of the Node stack — different ports, containers, and database. Both stacks can run at the same time.
