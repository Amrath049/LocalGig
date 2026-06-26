# LocalGig

A **hyperlocal job board** connecting blue-collar workers with local employers in a
single city. Workers browse and apply for jobs; employers post jobs and manage
applicants. Fully free, no payments — built as a backend-focused learning project.

> **Status:** Phase 1 — Scaffold (in progress). See [Build phases](#build-phases).

---

## Monorepo layout

```
LocalGig/
├── frontend/            # Next.js 16 app (from v0.app) — runs on :3000
├── backend/             # NestJS 11 API (primary focus) — runs on :4000
├── docker-compose.yml   # local infra: Postgres, Redis, Elasticsearch
└── README.md            # you are here
```

| Part                          | Stack                                          | Docs                                  |
| ----------------------------- | ---------------------------------------------- | ------------------------------------- |
| [`backend/`](backend/)        | NestJS 11, Prisma 6, PostgreSQL, Redis, ES     | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend/)      | Next.js 16, React 19, Tailwind 4, shadcn       | (v0.app generated)                    |

---

## What it does

| Role         | Can do                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| **Worker**   | Browse jobs without logging in. Must log in (verified email) to apply. Keeps a minimal profile: name, phone, skill tags. |
| **Employer** | Registers with a business name + phone. Posts jobs and manages applicants through their hiring pipeline. |

Single website with **role-based redirection** after login.

---

## Architecture

The backend uses a strict, layered **repository pattern**:

```
Gateway (controller)  →  Service (business logic)  →  Repository (DB access)  →  Postgres
```

Only repositories touch Prisma. Search runs through Elasticsearch (kept in sync via a
Bull/Redis queue). Auth issues short-lived JWT access tokens with refresh-token
rotation stored in Redis.

### Tech stack

- **API:** NestJS 11 (TypeScript, strict)
- **Database:** PostgreSQL 16 + Prisma 6
- **Cache / queues:** Redis 7 (refresh tokens, Bull job queues)
- **Search:** Elasticsearch 8 (`localgig_jobs` index)
- **Auth:** JWT (15 min) + refresh rotation (7 d), email verification via SendGrid
- **Local infra:** Docker Compose
- **CI:** GitHub Actions (added in the Polish phase)

---

## Data model

Five core models (full schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)):

- **User** — credentials, role, email-verified flag
- **WorkerProfile** — name, phone, skill tags (1:1 with a worker User)
- **EmployerProfile** — business name, phone (1:1 with an employer User)
- **Job** — title, description, type, optional pay, status (owned by an employer)
- **Application** — a worker's application to a job, with a status

### Enums

| Enum                | Values                                                        |
| ------------------- | ------------------------------------------------------------ |
| `Role`              | WORKER · EMPLOYER                                            |
| `JobType`           | FULL_TIME · PART_TIME · GIG                                  |
| `PayType`           | FIXED · RANGE · CUSTOM  _(pay is optional on a job)_         |
| `JobStatus`         | OPEN · CLOSED  _(closed manually by the employer)_           |
| `ApplicationStatus` | APPLIED → SEEN → SHORTLISTED → HIRED / NOT_SELECTED          |

### Key product rules

- A worker can apply to a given job **only once** (enforced by a DB unique constraint).
- Jobs are **closed manually** by the employer — no auto-expiry.
- **Email verification is required before login.**
- **City-scoped** for the MVP (a single city).

---

## Backend modules

| Module               | Responsibility                                          |
| -------------------- | ------------------------------------------------------- |
| `AuthModule`         | Register, login, email verify, refresh, logout          |
| `UsersModule`        | User + profile management                               |
| `JobsModule`         | Post jobs, list, status management                      |
| `ApplicationsModule` | Apply, track, status updates                            |
| `SearchModule`       | Elasticsearch indexing + search endpoint                |
| `MailModule`         | Transactional email (SendGrid)                          |
| `HealthModule`       | Health checks                                           |

---

## Quickstart

> **Prerequisite:** Docker Desktop running. On Windows 11 Home this needs the WSL2
> backend — see the [backend README](backend/README.md#prerequisites) if Docker
> won't start.

```bash
# 1. Start infrastructure (Postgres, Redis, Elasticsearch)
docker compose up -d

# 2. Set up and run the backend
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev          # API on http://localhost:4000

# 3. (Optional) run the frontend in another terminal
cd ../frontend
npm install                # or: pnpm install
npm run dev                # app on http://localhost:3000
```

### Local service ports

| Service       | URL / Port             |
| ------------- | ---------------------- |
| Backend API   | http://localhost:4000  |
| Frontend      | http://localhost:3000  |
| PostgreSQL    | localhost:5432         |
| Redis         | localhost:6379         |
| Elasticsearch | http://localhost:9200  |

---

## Build phases

| Phase | Goal                                                              | Status        |
| ----- | ---------------------------------------------------------------- | ------------- |
| 1     | **Scaffold** — NestJS, Docker Compose, Prisma connected         | 🟡 In progress |
| 2     | **Auth** — register, login, verify email, refresh, logout       | ⬜ Planned     |
| 3     | **Jobs** — post, list, status management                        | ⬜ Planned     |
| 4     | **Search** — Elasticsearch index, Bull sync, search endpoint    | ⬜ Planned     |
| 5     | **Applications** — apply, track, status updates                 | ⬜ Planned     |
| 6     | **Profile** — worker + employer edit                            | ⬜ Planned     |
| 7     | **Polish** — health checks, global filters, interceptors, CI    | ⬜ Planned     |
