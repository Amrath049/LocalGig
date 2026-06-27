# LocalGig Project Knowledge

This file captures the current working understanding of the LocalGig project so future changes can start from here instead of re-reading the whole repo.

## Project Summary

LocalGig is a hyperlocal job board for a single city, currently Udupi in the frontend copy. It connects workers with local employers. Workers can browse jobs, register/login, apply to jobs, and manage a basic profile. Employers can register/login, post jobs, view their listings, and manage application statuses.

The project is a monorepo:

- `backend/`: NestJS API with Prisma and PostgreSQL.
- `frontend/`: Vite React app generated from a Figma/v0-style design bundle.
- `docker-compose.yml`: local services for PostgreSQL, Redis, and Elasticsearch.

Important: the root and backend READMEs are outdated in places. They still describe an early scaffold phase and mention a Next.js frontend, but the actual frontend is Vite React and the backend already has auth, jobs, users, applications, mail, and placeholder search modules.

## Current Stack

Backend:

- NestJS 11
- TypeScript
- Prisma 6
- PostgreSQL
- JWT auth with Passport
- bcrypt password hashing
- SendGrid mail service, with dev fallback that logs verification links
- Joi environment validation

Frontend:

- Vite
- React
- Tailwind CSS 4
- shadcn/Radix UI components present in `frontend/src/app/components/ui`
- lucide-react icons
- API wrapper in `frontend/src/lib/api.ts`

## Backend Structure

The backend mostly follows the intended layered architecture:

```text
Controller -> Service -> Repository -> Prisma/PostgreSQL
```

Key modules:

- `backend/src/auth`: register, OTP email verification, login, refresh, logout, JWT guard/strategy.
- `backend/src/users`: current user profile read/update.
- `backend/src/jobs`: public job listing, employer job creation, employer job listing, close job.
- `backend/src/applications`: worker applications and employer status management.
- `backend/src/mail`: SendGrid verification email or dev-log fallback.
- `backend/src/search`: placeholder module.
- `backend/src/prisma`: global Prisma module/service.

Key backend files:

- `backend/src/main.ts`: global validation pipe, CORS, app port.
- `backend/src/app.module.ts`: module wiring.
- `backend/prisma/schema.prisma`: source of truth for DB models/enums.
- `backend/src/config/env.validation.ts`: environment validation.

## Backend Data Model

Core models:

- `User`: email, password hash, string `role`, email verification flag, profiles, posted jobs, applications, refresh tokens.
- `WorkerProfile`: name, phone, skill tags.
- `EmployerProfile`: business name, phone.
- `Job`: title, description, type, location, status, optional pay fields, employer relation.
- `Application`: worker/job relation, status, optional message.
- `RefreshToken`: hashed refresh token with expiry.
- `EmailVerificationOtp`: hashed 6-digit email verification OTP with expiry/consumption tracking.

Enums:

- `JobType`: `FULL_TIME`, `PART_TIME`, `GIG`
- `PayType`: `FIXED`, `RANGE`, `CUSTOM`
- `JobStatus`: `OPEN`, `CLOSED`
- `ApplicationStatus`: `APPLIED`, `SEEN`, `SHORTLISTED`, `HIRED`, `NOT_SELECTED`

Product rules already represented:

- Workers can apply to the same job only once via a DB unique constraint.
- Jobs are manually closed by employers.
- Login requires verified email. Signup sends a 6-digit OTP by email, and the frontend verifies it before logging the new user in.

## Backend API Contracts Used By Frontend

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify` with `{ email, otp }`
- `POST /auth/refresh`
- `POST /auth/logout`

Users:

- `GET /users/me`
- `PATCH /users/me`

Jobs:

- `GET /jobs`
- `GET /jobs?type=...&search=...`
- `GET /jobs/mine` for employers
- `POST /jobs` for employers
- `PATCH /jobs/:id/close` for employers

Applications:

- `POST /applications` for workers
- `GET /applications/me` for workers
- `GET /applications/employer` for employers
- `PATCH /applications/:id/status` for employers

The frontend API wrapper lives in `frontend/src/lib/api.ts`. Preserve those response shapes unless updating the frontend at the same time.

## Frontend Structure

The main frontend behavior is currently concentrated in:

- `frontend/src/app/App.tsx`

That file contains:

- UI types
- API-to-UI mapping helpers
- `PaperTexture`
- `NeighbourhoodIllustration`
- shared tags/cards/filter panel
- `JobsPage`
- `Navbar`
- `HomePage`
- `LoginPage`
- `WorkerDashboard`
- `EmployerDashboard`
- root `App`

Styles:

- `frontend/src/styles/index.css`: imports fonts, Tailwind, theme.
- `frontend/src/styles/theme.css`: generated shadcn-style CSS variables and base layer.
- `frontend/src/styles/tailwind.css`, `globals.css`, `fonts.css`.

The UI currently uses many hardcoded Tailwind arbitrary colors such as:

- background: `#FAF7F2`
- surface: `#FFFDF9`
- border: `#E8DDD4`
- primary brown: `#7C4A2D`
- text dark: `#2C1A0E`
- muted: `#8C7B6E`
- action orange: `#E07B39`
- green success: `#2D6B3D`, `#6A9E78`

Design direction:

- Warm, local, paper-like visual tone.
- Serif display headings via `Fraunces`.
- Body copy via `DM Sans`.
- Rounded cards/buttons, soft shadows, neighborhood line illustration.

## Known Gaps And Standardization Targets

Documentation:

- Root README and backend README are out of date.
- They mention scaffold status and Next.js, but actual code is more advanced and uses Vite.
- Some files/docs show mojibake/broken characters in places where dashes, arrows, quotes, or rupee symbols were probably intended. Treat this as an encoding/text cleanup target.

Frontend:

- `App.tsx` is too large and should eventually be split into components, feature views, and utilities.
- Design tokens are mostly hardcoded in class names; centralize colors/radius/shadows where practical.
- Several UI patterns are repeated: cards, tabs, pills, form controls, dashboard sections.
- The frontend currently stores only the access token in localStorage, not the refresh token.
- Some status values differ between API enum style and UI title case; be careful when changing application status logic.

Backend:

- `User.role` is a string in Prisma instead of a Prisma enum.
- DTO typing/validation can be tightened.
- `RegisterDto` currently uses `@IsEnum(['WORKER', 'EMPLOYER'])`; prefer a proper enum-like approach.
- `skillTags` should be validated as an array of strings if standardized.
- `UsersController.updateMe` accepts a loose `Record<string, unknown>` instead of a DTO.
- `ApplicationsRepository.listByEmployer` includes `worker: true`, but employer listing UI expects worker profile data. This may need profile include alignment.
- `ApplicationsService.updateStatus` loads all employer applications then finds one in memory; can be optimized later.
- Search module is placeholder despite README mentioning Elasticsearch indexing.

Environment:

- Backend CORS defaults to `FRONTEND_URL=http://localhost:3000`, while the current frontend screenshot/dev server uses `localhost:5173`. Keep this in mind when debugging local API calls.

Git/worktree:

- The repo currently has many uncommitted changes/additions. Do not revert or overwrite user work.
- Treat current files as user-owned unless making an explicit requested edit.

## Safe Change Principles

When standardizing:

- Preserve existing route paths and payload/response shapes unless frontend and backend are updated together.
- Keep backend architecture as controller/service/repository.
- Keep design improvements incremental; avoid rebuilding the whole app.
- Prefer extracting repeated UI pieces from `App.tsx` before changing behavior.
- Keep the warm LocalGig visual identity, but reduce hardcoded styling over time.
- Run frontend build after frontend changes: `npm run build` from `frontend/`.
- Run backend build/lint/tests as appropriate from `backend/`.

## Quick Commands

Backend:

```bash
cd backend
npm run build
npm run lint
npm run test
npm run start:dev
```

Frontend:

```bash
cd frontend
npm run build
npm run dev
```

Infra:

```bash
docker compose up -d
```
