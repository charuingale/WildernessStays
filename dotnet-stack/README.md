# Wilderness Stays — .NET Stack 🏔️

Self-contained implementation: **ASP.NET Core 8 + EF Core + PostgreSQL + Redis + SignalR** backend with the React frontend (dependency-free SignalR client).

| Piece | Tech | Port |
|---|---|---|
| API | ASP.NET Core 8, EF Core + Npgsql | 3001 |
| Frontend | React + Vite + Zustand | 5174 |
| Database | PostgreSQL 16 (Docker) | 5434 |
| Cache | Redis 7 (Docker, optional) | 6380 |
| Real-time | SignalR at /hubs/events | — |

## Run

Prerequisites: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0), Node 18+ (frontend only), Docker.

```bash
# 1. Databases
docker compose up -d

# 2. Backend (terminal 1)
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

## View the database

```bash
docker exec -it wilderness_postgres_net psql -U wilderness -d wilderness_stays_net
```

Or connect pgAdmin/DBeaver to `localhost:5434`, db `wilderness_stays_net`, user/password `wilderness`/`wilderness`. Tables: `hotels`, `rooms`, `bookings`, `users`.

## API

Same contract as the Node stack (see its README) on port 3001, plus interactive docs at `http://localhost:3001/swagger`. Real-time uses SignalR instead of Socket.IO — the frontend already speaks it natively.

Runs fully independently of the Node stack — different ports, containers, and database. Both stacks can run at the same time.
