# LocalGig — Backend (NestJS)

REST API for **LocalGig**, a hyperlocal job board for blue-collar workers and local
employers in a single city. This is the learning-focused part of the project.

For the product vision, data model, and full architecture, see the
[project overview](../README.md) at the repo root.

---

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Framework      | NestJS 11 (TypeScript, strict)                     |
| Database       | PostgreSQL 16 (with `pg_trgm` fuzzy indexing) + Prisma 6 |
| Cache / tokens | Redis 7 (refresh-token rotation, Bull queues)      |
| Search         | Elasticsearch 8 (`localgig_jobs` index)            |
| Auth           | JWT (15 min access) + refresh rotation (7 days)     |
| Mail           | SendGrid (email verification)                      |
| Infra (local)  | Docker Compose                                     |

> All major features (Auth, Jobs, Search, Applications, Profile, Skills Taxonomy) are fully implemented.

---

## Architecture — layered, repository pattern

Every feature module follows a strict 3-layer flow. Business logic never touches
the database directly; all DB access is isolated in repositories.

```
HTTP request
   │
   ▼
Gateway (*.controller.ts)   ← routing, DTO validation, guards
   │
   ▼
Service (*.service.ts)      ← business logic / orchestration
   │
   ▼
Repository (*.repository.ts) ← the ONLY layer that injects PrismaService
   │
   ▼
PostgreSQL (via Prisma)
```

`PrismaModule` is global, so any repository can inject `PrismaService` without
re-importing it.

---

## Prerequisites

- **Node.js 20+** and **npm**
- **Docker Desktop** (for Postgres / Redis / Elasticsearch)

> ### ⚠️ Windows 11 Home + Docker
> Docker Desktop on Windows 11 Home can only use the **WSL2 backend** (Hyper-V is
> not available on Home edition). If Docker won't start with a *"Virtual Machine
> Platform not enabled"* error, run this in an **Administrator** PowerShell and
> **reboot**:
> ```powershell
> wsl --install --no-distribution
> ```
> Make sure CPU virtualization is also enabled in your BIOS/UEFI.
>
> _Don't want to use Docker?_ Point `DATABASE_URL` in `.env` at any Postgres
> instance (a local install or a free cloud DB such as Neon) and skip the
> `docker compose` step.

---

## Getting started

All commands run from this `backend/` directory unless noted.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults already match the Docker Compose services below, so for local dev you
typically don't need to change anything. See [Environment variables](#environment-variables).

### 3. Start infrastructure (from the repo root)

```bash
cd ..
docker compose up -d        # Postgres, Redis, Elasticsearch
docker compose ps           # check health
cd backend
```

### 4. Set up the database

```bash
npx prisma generate         # generate the Prisma client
npx prisma migrate dev --name init   # create + apply the initial migration
```

### 5. Run the API

```bash
npm run start:dev           # watch mode with hot reload
```

The API starts on **http://localhost:4000**. A quick smoke test:

```bash
curl http://localhost:4000      # -> "Hello World!" (default scaffold route)
```

---

## Environment variables

Defined and validated at boot by [`src/config/env.validation.ts`](src/config/env.validation.ts)
(Joi). Phase-1 essentials are required; later-phase vars (JWT, SendGrid) are
optional during scaffolding.

| Variable                  | Default                         | Notes                              |
| ------------------------- | ------------------------------- | ---------------------------------- |
| `NODE_ENV`                | `development`                   | development / test / production    |
| `PORT`                    | `4000`                          | API port (frontend uses 3000)      |
| `FRONTEND_URL`            | `http://localhost:3000`         | CORS origin                        |
| `DATABASE_URL`            | local Postgres                  | **required**                       |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379`          | used from Phase 2                  |
| `ELASTICSEARCH_NODE`      | `http://localhost:9200`         | used from Phase 4                  |
| `JWT_ACCESS_SECRET` …     | dev placeholders                | used from Phase 2                  |
| `SENDGRID_API_KEY`        | empty                           | used from Phase 2                  |

---

## Common scripts

| Command                  | What it does                                  |
| ------------------------ | --------------------------------------------- |
| `npm run start:dev`      | Run in watch mode (hot reload)                |
| `npm run build`          | Compile to `dist/`                            |
| `npm run start:prod`     | Run the compiled build                        |
| `npm run lint`           | ESLint (with `--fix`)                         |
| `npm run test`           | Unit tests (Jest)                             |
| `npm run test:e2e`       | End-to-end tests                              |
| `npx prisma migrate dev` | Create/apply a migration in dev               |
| `npx prisma studio`      | Browse the database in a GUI                  |
| `npx prisma generate`    | Regenerate the Prisma client after schema edits |

---

## Project structure

```
backend/
├── prisma/
│   └── schema.prisma        # data model: User, WorkerProfile, EmployerProfile, Job, Application, Skill
├── src/
│   ├── auth/                # registration, login (with role validations)
│   ├── config/
│   │   └── env.validation.ts # Joi env schema
│   ├── jobs/                # job listing, creation, and search orchestration
│   ├── prisma/
│   │   ├── prisma.module.ts  # global module
│   │   └── prisma.service.ts # DB connection lifecycle
│   ├── search/              # Elasticsearch indexing and advanced search queries
│   ├── skills/              # Skill taxonomy management: autocomplete suggestions & resolution
│   ├── app.module.ts         # root module (Config + Prisma wired in)
│   └── main.ts               # bootstrap: validation pipe, CORS, port
├── .env.example
└── README.md
```

As feature modules land, each lives under `src/<feature>/` with its own
`*.controller.ts`, `*.service.ts`, `*.repository.ts`, and `dto/`.

---

## Skills Taxonomy Endpoints

The `skills` module manages normalized skill entities (not freeform text), resolving aliases, and supporting autocomplete matches.

- **`GET /skills/suggest?q=<query>`**: Typo-tolerant prefix autocomplete suggesting up to 8 matched skills.
- **`POST /skills/resolve`**: Resolves a raw skill name into a database-backed skill slug. Pass `{ input: string, forceCreate?: boolean }` in request body.
- **`POST /skills/resolve-batch`**: Resolves multiple raw skill strings in batch. Pass `{ inputs: string[] }` in request body.

---

## Local service ports

| Service       | URL / Port              |
| ------------- | ----------------------- |
| Backend API   | http://localhost:4000   |
| Frontend      | http://localhost:3000   |
| PostgreSQL    | localhost:5432          |
| Redis         | localhost:6379          |
| Elasticsearch | http://localhost:9200   |
