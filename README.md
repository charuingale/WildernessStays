# Wilderness Stays 🏔️

**Canadian Rustic Luxury — a full-stack hotel reservation platform, in two independent implementations.**

| Folder | Stack | API | Frontend | Postgres | Redis |
|---|---|---|---|---|---|
| [`node-stack/`](node-stack/README.md) | NestJS + TypeORM + Socket.IO | :3000 | :5173 | :5432 | :6379 |
| [`dotnet-stack/`](dotnet-stack/README.md) | ASP.NET Core 8 + EF Core + SignalR | :3001 | :5174 | :5434 | :6380 |

Both are complete and identical in features: hotel browsing with filters, room-level booking with photos/amenities/capacity, per-room date blocking (no double-booking, enforced by serializable transactions with row locks), availability calendar, JWT auth with private booking history, admin reservations desk, CSV export, real-time updates, offline demo mode, and a smoke-test suite.

Ports never overlap, each stack has its own Docker containers and database, so you can run either one — or both simultaneously. See each folder's README for run instructions.

Demo accounts (both stacks): admin@wilderness.ca / admin123 · guest@example.com / guest123
