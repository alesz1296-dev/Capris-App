# Capris App

Bilingual field-operations platform for Costa Rica, built for field users, supervisors, and admins.

Capris combines a Railway-deployable Next.js PWA with a NestJS API for task assignment, route execution, visits, GPS-backed evidence, activities, exhibitions, consignations, client follow-up, dashboards, reports, imports, and access control.

## Overview

Capris is designed for teams that manage field work across Costa Rican provinces, operational zones, clients, and points of sale.

- Field users execute assigned route work, visits, GPS check-ins/check-outs, evidence capture, activities, and exhibitions.
- Supervisors plan route work by person and date, add shared route stops/stores, prepare consignations, create agenda events, and review assigned operational progress.
- Admins manage full platform access, reports, imports, configuration, and organization-wide operations.

## Current Functionality

- Email/password login and account creation backed by JWT access/refresh sessions.
- Optional Google auth placeholders remain available for a later Google OAuth rollout.
- Protected web app shell: users must authenticate before entering the app.
- Role-aware navigation: privileged access/admin surfaces are hidden from field users.
- Task assignment by supervisor/admin with required province, zone, and point-of-sale/store linkage.
- Personal calendar for field users and shared/team calendar planning for supervisors/admins.
- Route page with Costa Rica province map, route tools, shared route stop creation, consignation preparation, and visit execution.
- Consignation review/send/fail is restricted to supervisor/admin permissions.
- Field users can view their scoped consignations but cannot approve/send them.
- PostgreSQL + Prisma persistence with Railway as the main staging/deployment path.
- Spanish-first UX pass is in progress across the web app.

## Monorepo Structure

- `apps/api`: NestJS backend, Prisma schema, API modules, tests, Railway API config.
- `apps/web`: Next.js PWA for admin/supervisor/field web workflows.
- `apps/mobile`: Expo React Native field app prototype and offline workflow foundation.
- `packages/shared`: shared contracts, enums, permissions, validation, sync types, and i18n resources.

## Tech Stack

- Web/PWA: Next.js 15
- API: NestJS
- Database: PostgreSQL + Prisma
- Auth: JWT access/refresh sessions, email/password login, future Google OAuth support
- Mobile prototype: React Native + Expo
- Offline foundation: SQLite/mobile queue contracts
- Storage: local adapter plus S3-compatible object storage hooks
- Email: Postmark or SendGrid hooks
- Maps/GPS: Costa Rica province geometry in web routes, GPS capture support in field flows, Mapbox token reserved for future tile/polygon layers
- Containers: Docker + Docker Compose
- Deployment: Railway

## Architecture Summary

`packages/shared` is the contract layer used by the API, web app, and mobile app. The API remains the source of truth for permissions, actor scope, persistence, audit logs, replay protection, signed media, reporting, and database access.

The web app is currently the primary deployed field/admin experience. It supports authenticated PWA access from desktop and mobile browsers through Railway. The Expo mobile app remains useful as a prototype/offline reference, but the current deployment path favors the Railway-hosted PWA.

## Roles And Permissions

- `admin`: full organization-level platform control.
- `supervisor`: scoped planning and operational control, including task assignment, calendar management, route stop creation, consignation review/send, evidence visibility, reports, and exceptions.
- `field_user`: personal route execution, visit performance, evidence upload, notes, activities, exhibitions, calendar visibility, and scoped consignation visibility.

Important security behavior:

- The web app requires a valid JWT before loading protected pages.
- The API derives organization ownership from the authenticated actor where possible.
- Field users only see their personal calendar and scoped operational records.
- Field users no longer have `consignations.review_send`; consignation approval/delivery is supervisor/admin-only.

## Route And Agenda Workflow

Supervisor/admin planning flow:

1. Add or select a shared point of sale/store under `Rutas`.
2. Assign work to a specific user and day from `Agenda` or the task assignment surface.
3. Each route task must include province, zone, and point of sale/store.
4. Prepare consignations from assigned route tasks when needed.
5. Use shared calendar events for team meetings, activation windows, blockers, and follow-up.

Field-user flow:

1. Log in with email/password.
2. Open the assigned work calendar or route page.
3. Execute visits, GPS check-in/check-out, evidence capture, activities, and exhibitions.
4. View scoped consignations prepared for their assigned work.

## Local Development

Install dependencies from the repo root:

```bash
npm install
```

Run local apps:

```bash
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Default local URLs:

- API: `http://localhost:4000/api/v1`
- Web: `http://localhost:3000`

## Database

The project is PostgreSQL-first.

Local example:

```env
DATABASE_URL=postgresql://<db_user>:<db_password>@localhost:5432/capris_app?schema=public
```

Useful API database commands:

```bash
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:push
npm --workspace apps/api run db:seed
npm --workspace apps/api run db:seed:roles
```

For Railway, use the Postgres service connection string from the same Railway project/environment. The internal Railway URL works from Railway services only; use the public database URL only from local tools if Railway exposes one.

`db:seed:roles` upserts three QA users for role verification:

- Admin: `maria.solis@capris.example`
- Supervisor: `daniel.rojas@capris.example`
- Field user: `lucia.vargas@capris.example`

Set `CAPRIS_QA_PASSWORD` before running the role fixture script in staging. If no password is provided outside production, the local-only default is `CaprisLocal123!`.

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

Docker note:

- The PWA/web app and API can be containerized.
- The Expo mobile app is not containerized for normal development.

## Railway Deployment

Railway service split:

- API service: `apps/api`
- Web/PWA service: `apps/web`
- Postgres service: Railway PostgreSQL plugin/service in the same project and environment

API health check:

```text
/api/v1/system-health
```

Important Railway variables:

- API: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MEDIA_URL_SIGNING_SECRET`, `NODE_ENV`, optional email/storage/map tokens.
- Web/PWA: `NEXT_PUBLIC_API_BASE_URL=https://<api-service-domain>/api/v1`.

Do not commit real secrets. Keep Railway secrets in Railway variables only.

## Validation Workflow

Recommended checks before pushing:

```bash
npm --workspace apps/api run build
npm --workspace apps/web run build
npm run typecheck
npm test
```

Schema changes also require:

```bash
npm --workspace apps/api run db:push
```

## Testing Paths

- Local browser/PWA testing: `apps/web`
- Local API testing: `apps/api`
- Shared backend staging: Railway API + Railway Postgres
- Mobile-browser testing: Railway-hosted PWA URL
- Expo testing: optional prototype path for native/offline behavior
- Local container QA: Docker Compose

## Role And Route QA Checklist

1. Run `npm --workspace apps/api run db:seed:roles` against the target database.
2. Log in as admin and confirm `Acceso`, reports, imports, and admin-only surfaces are visible.
3. Log in as supervisor and open `Rutas`.
4. Add a shared point of sale/store under the supervisor route workspace.
5. Open `Agenda`, select a day, assign route work to the field user, and confirm province, zone, and point of sale/store are required.
6. Return to `Rutas` as supervisor and prepare a consignation for the assigned task.
7. Log in as the field user and confirm `Rutas` is the main daily workspace with map, visits/GPS, evidence, and exceptions.
8. Confirm the field user can see scoped work and execute route actions, but cannot review, send, or fail consignations.

## Near-Term Enhancements

- Replace the current province map layer with Mapbox/Leaflet tiles and official province/zone polygons.
- Add live route tracking/background location mode if required by field operations.
- Add Redis for near-term caching, job coordination, rate limiting, health smoothing, and queue support. Redis has not been implemented yet because the current priority is correctness of auth, Postgres persistence, Railway deployment, and core route workflows.
- Continue Spanish-first UI cleanup across secondary surfaces.
