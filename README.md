# Capris App

Bilingual field-operations platform for Costa Rica, built for field users, supervisor/auditors, developer/SRE operators, and admins.

Capris combines a container-ready Next.js PWA with a NestJS API for task assignment, route execution, visits, evidence, activities, exhibitions, consignations, client follow-up, dashboards, reports, imports, and access control.

## Overview

Capris is designed for teams that manage field work across Costa Rican provinces, operational zones, clients, and points of sale.

- Field users execute assigned route work, visits, check-ins/check-outs, evidence capture, activities, and exhibitions.
- Supervisor/auditors plan route work by person and date, add shared route stops/stores, prepare consignations, create agenda events, and review assigned operational progress.
- Admins manage full platform access, reports, imports, configuration, and organization-wide operations.
- Developer/SRE users get operational access for metrics, platform health, and environment-level troubleshooting without inheriting business-planning permissions.
- Business performance tracking for field users should stay in admin/supervisor-only dashboards and reports.
- Platform observability metrics should stay in developer/SRE operational surfaces and should not be mixed into business dashboards.
- Phase 3 implementation notes live in [docs/phase-3-analytics-observability.md](/C:/Users/alesz/Projects_Apps/Capris-App/docs/phase-3-analytics-observability.md).

## Current Functionality

- Email/password login and account creation backed by JWT access/refresh sessions.
- Optional Google auth placeholders remain available for a later Google OAuth rollout.
- Protected web app shell: users must authenticate before entering the app.
- Role-aware navigation: privileged access/admin surfaces are hidden from field users.
- Task assignment by supervisor/admin with required province, zone, and point-of-sale/store linkage.
- Personal calendar for field users and shared/team calendar planning for supervisors/admins.
- Route page with Costa Rica province/canton/district route tools, shared route stop creation, consignation preparation, and visit execution.
- Consignation review/send/fail is restricted to supervisor/admin permissions.
- Field users can view their scoped consignations but cannot approve/send them.
- PostgreSQL + Prisma persistence with an AWS-oriented deployment path.
- Spanish-first UX pass is in progress across the web app.

## Monorepo Structure

- `apps/api`: NestJS backend, Prisma schema, API modules, tests, and provider-neutral container config.
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
- Locations: Costa Rica province, canton, and district catalogs drive route scope and field execution.
- Containers: Docker + Docker Compose
- Deployment target: AWS App Runner or ECS Fargate for containers, RDS PostgreSQL, and S3 object storage

## Architecture Summary

`packages/shared` is the contract layer used by the API, web app, and mobile app. The API remains the source of truth for permissions, actor scope, persistence, audit logs, replay protection, signed media, reporting, and database access.

The web app is currently the primary deployed field/admin experience. It supports authenticated PWA access from desktop and mobile browsers. The Expo mobile app remains useful as a prototype/offline reference, but the current deployment path favors the containerized PWA plus API.

## Roles And Permissions

- `admin`: full organization-level platform control.
- `supervisor_auditor`: scoped planning, review, and auditing control, including task assignment, calendar management, route stop creation, consignation review/send, evidence visibility, reports, and exceptions.
- `developer_sre`: operational visibility for metrics, diagnostics, and platform support paths.
- `field_user`: personal route execution, visit performance, evidence upload, notes, activities, exhibitions, calendar visibility, and scoped consignation visibility.

Analytics split:

- Business dashboards and field-user performance views are for `admin` and `supervisor_auditor`.
- Platform health and app observability views are for `developer_sre` and any explicitly approved break-glass admin path.
- Field users should not see team performance ranking, cross-user scorecards, or platform observability panels.

Important security behavior:

- The web app requires a valid JWT before loading protected pages.
- The API derives organization ownership from the authenticated actor where possible.
- Field users only see their personal calendar and scoped operational records.
- Field users no longer have `consignations.review_send`; consignation approval/delivery is supervisor/auditor or admin-only.

## Route And Agenda Workflow

Supervisor/auditor/admin planning flow:

1. Add or select a shared point of sale/store under `Rutas`.
2. Assign work to a specific user and day from `Agenda` or the task assignment surface.
3. Each route task must include province, zone, and point of sale/store.
4. Prepare consignations from assigned route tasks when needed.
5. Use shared calendar events for team meetings, activation windows, blockers, and follow-up.

Field-user flow:

1. Log in with email/password.
2. Open the assigned work calendar or route page.
3. Execute visits, check-in/check-out, evidence capture, activities, and exhibitions.
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

Local environment source of truth:

- Use the repo-root `.env` file for local development values.
- API and web scripts now load the root `.env` before running Prisma, Nest, or Next commands.
- `apps/api/.env` should be treated as legacy/local override only and should not be required for normal setup.
- `apps/web/.env.local` should only be needed for deliberate web-only overrides.

Default local URLs:

- API: `http://localhost:4000/api/v1`
- Web: `http://localhost:3000`

## Database

The project is PostgreSQL-first.

Local example:

```env
DATABASE_URL=postgresql://<db_user>:<db_password>@localhost:5432/capris_app?schema=public
```

Docker Compose example:

```env
DATABASE_URL_DOCKER=postgresql://<db_user>:<db_password>@postgres:5432/capris_app?schema=public
```

Useful API database commands:

```bash
npm --workspace apps/api run db:generate
npm --workspace apps/api run db:push
npm --workspace apps/api run db:seed
npm --workspace apps/api run db:seed:roles
```

For AWS, use the RDS PostgreSQL connection string in the deployed API environment. Keep local and container database URLs separate so host-local tooling can use `localhost` while Compose containers use the `postgres` service name.

`db:seed:roles` upserts QA users for role verification:

- Admin: `maria.solis@capris.example`
- Supervisor/Auditor: `daniel.rojas@capris.example`
- Developer/SRE: `andres.campos@capris.example`
- Field user: `lucia.vargas@capris.example`

Set `CAPRIS_QA_PASSWORD` before running the role fixture script in staging. If no password is provided outside production, the local-only default is `CaprisLocal123!`.

## Docker

Docker support is included for local container QA.

Files:

- `docker-compose.yml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Local-first validation notes live in [docs/local-first-validation.md](/C:/Users/alesz/Projects_Apps/Capris-App/docs/local-first-validation.md).

Bring the stack up with:

```bash
docker compose up --build
```

Env split:

- `DATABASE_URL` is for host-local commands like `npm run dev:api`
- `DATABASE_URL_DOCKER` is for the API container inside Compose
- keep both values aligned on credentials and database name, but use `localhost` for local tools and `postgres` for Compose

This starts:

- Postgres on `5432`
- MinIO S3-compatible storage on `9000`
- MinIO console on `9001`
- API on `4000`
- web on `3000`

Docker note:

- The PWA/web app and API can be containerized.
- The Expo mobile app is not containerized for normal development.

## AWS Deployment

AWS deployment notes live in [docs/aws-deployment-plan.md](/C:/Users/alesz/Projects_Apps/Capris-App/docs/aws-deployment-plan.md).

Recommended MVP service split:

- API container: AWS App Runner or ECS Fargate
- Web/PWA container: AWS App Runner or ECS Fargate
- Database: Amazon RDS for PostgreSQL
- Evidence storage: Amazon S3
- Secrets: AWS Secrets Manager or SSM Parameter Store
- Logs/metrics: CloudWatch plus Prometheus/Grafana path

API probe endpoints:

```text
/api/v1/system-health
/api/v1/system-health/liveness
/api/v1/system-health/readiness
/api/v1/metrics
```

Web probe endpoints:

```text
/api/health
/api/readiness
```

Important deployed variables:

- API: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MEDIA_URL_SIGNING_SECRET`, `NODE_ENV`, optional `METRICS_BEARER_TOKEN`, plus optional email/storage/map tokens.
- Web/PWA: `NEXT_PUBLIC_API_BASE_URL=https://<api-service-domain>/api/v1`.

Do not commit real secrets. Keep API/runtime secrets in AWS Secrets Manager, SSM Parameter Store, Kubernetes secrets, or another secret store. Keep web `NEXT_PUBLIC_*` values limited to non-sensitive configuration only.

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
- Shared backend staging: deployed API + RDS PostgreSQL
- Mobile-browser testing: deployed PWA URL
- Expo testing: optional prototype path for native/offline behavior
- Local container QA: Docker Compose

## Role And Route QA Checklist

1. Run `npm --workspace apps/api run db:seed:roles` against the target database.
2. Log in as admin and confirm `Acceso`, reports, imports, and admin-only surfaces are visible.
3. Log in as supervisor/auditor and open `Rutas`.
4. Add a shared point of sale/store under the supervisor/auditor route workspace.
5. Open `Agenda`, select a day, assign route work to the field user, and confirm province, zone, and point of sale/store are required.
6. Return to `Rutas` as supervisor/auditor and prepare a consignation for the assigned task.
7. Log in as the field user and confirm `Rutas` is the main daily workspace with visits, administrative locations, evidence, and exceptions.
8. Confirm the field user can see scoped work and execute route actions, but cannot review, send, or fail consignations.

## Near-Term Enhancements

- Continue improving province, canton, and district catalog coverage for route assignment.
- Add Redis for near-term caching, job coordination, rate limiting, health smoothing, and queue support. Redis has not been implemented yet because the current priority is correctness of auth, Postgres persistence, AWS deployment, and core route workflows.
- Continue Spanish-first UI cleanup across secondary surfaces.
