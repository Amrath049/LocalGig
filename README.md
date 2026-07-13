# LocalGig — Hyperlocal Job Board

LocalGig is a hyperlocal job board designed to connect local blue-collar workers with nearby employers in a single city (e.g. Udupi). Employers can post jobs, manage applications, and move candidates through a hiring pipeline. Workers can search for jobs, filter by criteria, get real-time recommendations, and apply instantly.

This project is built as a monorepo specifically designed to showcase **advanced Elasticsearch search and discovery capabilities** integrated into a production-ready **NestJS & Prisma** architecture.

---

## 📂 Monorepo Layout

```text
LocalGig/
├── frontend/            # Vite + React client — runs on http://localhost:5173
├── backend/             # NestJS 11 REST API — runs on http://localhost:4000
├── docker-compose.yml   # Infrastructure (Postgres, Redis, Elasticsearch/OpenSearch)
└── README.md            # You are here
```

| Component | Tech Stack | Responsibility |
| :--- | :--- | :--- |
| [`backend/`](backend/) | NestJS 11, Prisma 6, PostgreSQL, Redis, Elasticsearch | Role-based REST API, async search queue, query pipeline |
| [`frontend/`](frontend/) | React 18, Vite 6, Tailwind CSS v4, Lucide React | Highly responsive UI, dynamic filters, autocomplete, detailed modal |

---

## ⚡ Elasticsearch Showcase (Advanced Search Concepts)

The search implementation is backed by Elasticsearch/OpenSearch and includes the following industry-standard search features:

1. **Dynamic Facets (Faceted Search)**: Filter categories (Job Type, Skills, Areas) are not hardcoded. They are populated dynamically using Elasticsearch **terms aggregations**, displaying real-time job counts next to filter criteria (e.g., `Full-time (12)`, `Gig (3)`).
2. **Search Term Highlighting**: Matches within titles or descriptions are highlighted. The backend injects CSS-highlighted snippets (`<mark>` tags) into search hits, which are rendered inline inside the job cards so candidates see exactly why a job matched their query.
3. **Real-time Autocomplete (Search-As-You-Type)**: As users type in the search bar, the UI displays query suggestions matching job titles or skills using phrase prefix matching.
4. **Similar Jobs Widget (Recommendations)**: When viewing a job description, an Elasticsearch `more_like_this` query identifies similar active openings based on title, description text, and skills.
5. **Personalized Skill Boosting**: If a candidate is logged in, their profile skills are sent to the search request, applying a match boost factor (`boost: 2.5`) to prioritize jobs that align with their background.

---

## 🏗️ Architecture

The backend follows a layered **Controller-Service-Repository** pattern:

```text
Controller (HTTP Route) ──> Service (Business Logic) ──> Repository (Database Query) ──> Prisma/PostgreSQL
```

### Event-Driven Index Syncing
To keep PostgreSQL and Elasticsearch in sync without blocking requests:
- Creating, closing, or removing jobs enqueues a sync event in a **Redis list queue**.
- A background worker consumes the queue asynchronously to update the Elasticsearch index, ensuring high reliability and performance.
- On startup, the NestJS server checks index mappings and automatically synchronizes all active job postings.

---

## 📊 Data Model

Core entities (defined in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)):

- **User**: Authentication details, user role (`WORKER` or `EMPLOYER`), and email verification status.
- **WorkerProfile**: Full name, phone number, and a string array of skills (e.g. `["plumbing", "painting"]`).
- **EmployerProfile**: Business name and contact phone number.
- **Job**: Title, description, type (`FULL_TIME`, `PART_TIME`, `GIG`), location locality, status (`open`, `closed`, `removed`), pay details, and an array of required skills.
- **Application**: Join table representing worker applications to jobs with pipeline states (`applied`, `seen`, `shortlisted`, `hired`, `not_selected`).
- **RefreshToken**: Hashed tokens supporting secure rotation sessions.
- **EmailVerificationOtp**: One-time email validation tokens.

---

## 🚀 Quickstart

### Prerequisites
- Node.js (v18+)
- Docker Desktop (if using local infrastructure)

### 1. Setup Infrastructure
To start local PostgreSQL, Redis, and Elasticsearch containers:
```bash
docker compose up -d
```
*(Alternatively, configure cloud-hosted URLs in `backend/.env` for remote databases).*

### 2. Configure & Start Backend
```bash
cd backend
npm install
cp .env.example .env     # Update database, Redis, and Elasticsearch environment keys
npx prisma db push       # Sync Prisma schema to PostgreSQL
npm run start:dev        # API server starts on http://localhost:4000
```

### 3. Start Frontend
```bash
cd ../frontend
npm install
npm run dev              # Vite client starts on http://localhost:5173
```
