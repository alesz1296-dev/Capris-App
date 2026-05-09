# Capris App

Bilingual field operations platform for Costa Rica, built for field teams, supervisors, and admins.

Capris combines a mobile field workflow with a web operations console for task execution, visits, evidence capture, consignations, client follow-up, dashboards, reports, imports, and operational controls.

## Overview

Capris is designed for teams that need to manage field work across provinces, zones, clients, and points of sale with:

- English and Spanish support
- online and offline field execution
- mandatory evidence workflows
- visit check-in/check-out
- activities and exhibitions tracking
- consignation review and delivery flow
- supervisor/admin dashboards and reporting
- imports, retention settings, reminder rules, and system-health visibility

## Current Repo Status

This repo already includes a substantial working foundation across API, web, mobile, offline, auth, permissions, reporting, and admin tooling.

Implemented at a high level:

- Google sign-in layered over JWT sessions
- global JWT enforcement plus permission-based backend protection
- organization, role, and supervisor-scope model
- task, visit, evidence, activity, exhibition, consignation, exception, agenda, and client-request flows
- offline mobile queue with encrypted payload handling
- signed media delivery
- dashboards, CSV exports, and immutable report snapshots
- CSV imports and admin configuration
- audit, email, notification, and replay-protection foundations
- Docker for local Postgres + API + web
- Railway as the default backend staging target

## Monorepo Structure

- `apps/api`: NestJS backend
- `apps/web`: Next.js admin/supervisor console
- `apps/mobile`: Expo React Native field app
- `packages/shared`: shared contracts, enums, permissions, sync types, validation, and i18n resources

## Tech Stack

- Mobile: React Native + Expo
- Web: Next.js
- API: NestJS
- Database: PostgreSQL + Prisma
- Mobile offline store: SQLite
- Storage: local adapter + S3-compatible object storage
- Auth: Google sign-in + JWT access/refresh sessions
- Email: Postmark or SendGrid
- Maps: Mapbox
- Notifications: Firebase Cloud Messaging
- Containers: Docker + Docker Compose
- Staging: Railway

## Architecture Summary

Capris follows a monorepo architecture with a shared domain package.

- `packages/shared` defines the canonical contracts used across API, web, and mobile.
- `apps/api` is the system source of truth for permissions, scope checks, persistence, auditability, signed media, reporting, and replay-safe offline mutation handling.
- `apps/web` focuses on supervisor/admin operations: catalogs, tasks, visits, evidence review, activities, exceptions, reports, imports, admin config, and dashboards.
- `apps/mobile` focuses on route-day execution: sign-in, task/visit flows, evidence capture, activities, exhibitions, consignations, and offline sync.

## Authentication And Security

The current auth/security model includes:

- Google identity exchange into Capris JWT sessions
- refresh-token-backed device sessions
- global JWT route protection by default
- permission-based controller protection
- actor-derived ownership and scope checks
- supervisor read-side scope filtering
- signed media URLs for protected media access
- durable audit, email, and notification logs
- encrypted mobile offline payload handling

## Local Development

Install dependencies from the repo root:

```bash
npm install
```

Run the local apps:

```bash
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Default local API target:

- `http://localhost:4000/api/v1`

Default local web target:

- `http://localhost:3000`

## Database

The project is now Postgres-first.

Default local connection target:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/capris_app?schema=public
```

Useful API database scripts:

```bash
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:push
npm --workspace apps/api run db:seed
```

## Docker

Docker support is included for local container QA.

Files:

- `docker-compose.yml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Bring the stack up with:

```bash
docker compose up --build
```

This starts:

- Postgres on `5432`
- API on `4000`
- web on `3000`

Important note:

<<<<<<< HEAD
- Mobile is not containerized for normal development.
- The official mobile testing path remains Expo development builds.
=======
- The API is now configured for PostgreSQL by default.
- A local helper compose file exists at `docker-compose.postgres.yml`.
- API env defaults point to `postgresql://<db_user>:<db_password>@localhost:5432/capris_app?schema=public`.
>>>>>>> 2c8020f (fix: TS any errors)

## Railway Staging

Railway is the default shared backend staging path.

Relevant files:

- `apps/api/railway.json`
- `docs/railway-staging.md` (private, ignored from Git)

Current staging flow:

- deploy API to Railway
- attach Railway Postgres
- configure staging env vars
- seed if needed
- point local web and Expo dev builds at the Railway API

## Environment Variables

Example env values live in:

- `.env.example`

Important variables include:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MEDIA_URL_SIGNING_SECRET`
- `GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_BASE_URL`
- `POSTMARK_TOKEN` or `SENDGRID_API_KEY`

## Validation Workflow

The working local validation rule is:

- every meaningful code slice: `npm.cmd run typecheck` and `npm.cmd test`
- every frontend or shared-contract change: `npm.cmd --workspace apps/web run build`
- every schema change: `npm.cmd --workspace apps/api run db:push`
- every workflow milestone: run the affected app in `dev` mode for manual validation

Useful commands:

```bash
npm run typecheck
npm test
npm --workspace apps/web run build
```

## Testing Paths

- Local browser/admin testing: `apps/web`
- Local API testing: `apps/api`
- Mobile testing: Expo development builds
- Shared backend staging: Railway
- Local container QA: Docker Compose

## Working Model

The repo is being built in visible implementation sessions rather than one large opaque batch.

Project rule summary:

- private `docs/` and `guides/` files are the implementation source of truth
- features should move in this order whenever practical:
  spec, shared contract, validation, implementation, tests, doc update

Those private docs are intentionally ignored by Git and are not part of the public repository context.
