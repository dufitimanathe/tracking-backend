# Fleet Transport Platform — Backend

Multi-tenant NestJS backend for corporate motorcycle transport, fleet GPS, dispatch, billing, incidents, WhatsApp, and AI-assisted request parsing.

## Stack

- NestJS + TypeScript (strict)
- PostgreSQL + PostGIS + TypeORM (migrations, `synchronize: false`)
- Redis + BullMQ
- Socket.IO (tenant-scoped rooms)
- JWT + Argon2 + RBAC + company membership isolation
- Swagger at `/api/docs`
- Docker Compose (`api`, `worker`, `postgres`, `redis`)

## Quick start

### 1. Prerequisites

- Node.js 22+
- Docker Desktop (recommended) **or** local PostgreSQL 16 + PostGIS + Redis 7
- npm



### 2. Environment

```bash
cp .env.example .env
```

Required secrets are validated at startup (`JWT_*` must be ≥ 32 chars).

### 3. Infrastructure

```bash
docker compose up -d postgres redis
```



### 4. Install & migrate

```bash
npm ci --legacy-peer-deps
# If argon2 native build fails: npm install-scripts approve argon2 && npm rebuild argon2
npm run migration:run
npm run seed
```

Seed company: **Kampere Motari Ltd**

Admin: `theodufi.rw@gmail.com` / `Password123!`

### 5. Run API (+ optional worker)

```bash
npm run start:dev
npm run start:worker
```

- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/api/docs`



### Full stack with Docker

```bash
docker compose up --build
```

If the database was started before migrations worked (empty schema / missing `users`), reset the volume once:

```bash
docker compose down -v
docker compose up --build
```

API startup runs migrations + seed automatically.

## MVP workflow (REST, no WhatsApp/AI required)

1. `POST /api/v1/auth/register-company` — company + COMPANY_ADMIN
2. Login → create supervisors, employees, riders, motorcycles
3. Assign rider ↔ motorcycle
4. Set rider `AVAILABLE` + `POST /api/v1/locations/rider`
5. Create transport request → approve → auto/manual dispatch
6. Rider accept → arrive → start → complete
7. Billing record generated; dashboard + live fleet update
8. Unauthorized movement (no active trip + thresholds) → incident + realtime alert

Company A **cannot** read Company B data (membership + `companyId` query scoping).

## Key modules


| Area           | Path                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| Auth / tenancy | `src/auth`, `src/companies`, `src/company-members`                     |
| Fleet          | `src/riders`, `src/motorcycles`, `src/locations`                       |
| Ops            | `src/transport-requests`, `src/approvals`, `src/trips`, `src/dispatch` |
| Money          | `src/billing`, `src/invoices` (decimal.js, not float)                  |
| Safety         | `src/incidents`, `src/realtime`                                        |
| Integrations   | `src/maps`, `src/whatsapp`, `src/ai`                                   |




## Pricing (default RWF)

- First 1 km → **500**
- 



## Tests

```bash
npm test
npm run test:e2e   # when DB available
```



## External integrations

See **[docs/INTEGRATION_REQUIREMENTS.md](docs/INTEGRATION_REQUIREMENTS.md)** for WhatsApp Cloud API, OpenAI/Gemini, and Google Maps/Routes credentials and setup. The core platform runs without them (Haversine maps + mock AI).

## Security notes

- Never commit real `.env` secrets
- Refresh tokens stored hashed
- Webhooks: WhatsApp signature + message idempotency
- GPS provider abstraction (not vendor-locked)
- No cascade-delete of trip/billing history

