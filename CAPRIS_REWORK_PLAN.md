# Capris App Rework Plan

## Purpose

This document breaks the Capris App rework into practical phases and tasks. The goal is to turn the previous iteration into a cleaner production-ready field operations platform with a separated frontend, backend API, database, evidence uploads, reporting, dashboards, and bilingual support.

The previous version already includes a useful foundation:

- Frontend/PWA: Next.js
- Backend API: NestJS
- Database: PostgreSQL with Prisma
- Shared package: contracts, enums, permissions, validation, and i18n
- Mobile prototype: Expo

The rework should improve the architecture, data model, workflow rules, reporting, and deployment practices without restarting from zero unless the existing code becomes more expensive to repair than rebuild.

## Target Architecture

The application should be split into independently deployable services:

| Layer | Responsibility | Recommended Location |
| --- | --- | --- |
| Frontend | Admin, supervisor, and field user UI | `apps/web` |
| Backend API | Business logic, auth, permissions, reporting, evidence handling | `apps/api` |
| Database | Persistent operational data | PostgreSQL |
| Shared Contracts | Shared types, enums, validation schemas, i18n keys | `packages/shared` |
| File Storage | Photos and documents | S3-compatible storage, Cloudflare R2, Supabase Storage, or similar |

Core rule: the frontend must not access the database directly. All database access should go through the backend API.

## Phase 0: Repository Audit And Baseline

Objective: establish the real current state before changing behavior.

Tasks:

- Clone or move the Capris repo into the active development workspace.
- Confirm the current branch and latest commit.
- Run dependency installation.
- Run existing checks:
  - API build
  - Web build
  - Prisma validation
  - Existing tests
  - Lint/typecheck
- Document current failures before fixing them.
- Review environment variable requirements.
- Review Docker Compose and Railway deployment files.
- Identify dead code, prototypes, and incomplete features.

Deliverables:

- Baseline technical audit.
- List of failing tests/builds.
- Confirmed development setup instructions.
- Decision on whether to keep the monorepo structure.

Best practices:

- Do not refactor before the app can be built locally.
- Separate setup problems from product bugs.
- Keep one source of truth for environment variables.

## Backend Architecture Pass

Objective: decide the backend direction before making fixes.

Current backend signals from the previous Capris implementation:

- The API already exists as a NestJS service.
- PostgreSQL and Prisma are already present.
- The backend already has modules for auth, tasks, visits, evidence, reports, dashboard-style field operations, audit, object storage, catalogs, and admin configuration.
- There is already a meaningful backend test suite.
- The backend currently uses some flexible string fields for dates and statuses.
- Some services use manual ID generation with `Math.random`.
- Some Prisma access is loosely typed with `any`.
- CORS is enabled broadly.
- Task status workflow does not yet match the required business process.

Recommendation: keep the current backend stack, but rework the architecture and contracts.

Recommended backend stack:

| Concern | Recommendation | Reason |
| --- | --- | --- |
| API framework | NestJS | Already present, modular, good for guards, services, dependency injection, testing, and enterprise-style workflows |
| Language | TypeScript | Already used across frontend, backend, and shared contracts |
| Database | PostgreSQL | Strong fit for relational field operations, reporting, filters, audit trails, and operational history |
| ORM | Prisma | Already present, productive, type-safe enough when used carefully, good migration tooling |
| Validation | Shared schemas plus NestJS validation pipe | Keeps API inputs explicit and prevents frontend/backend drift |
| Auth | JWT with refresh/session tracking | Already started; should be hardened rather than replaced |
| File storage | S3-compatible object storage | Better for photos/documents than storing files in PostgreSQL |
| Reports | Backend aggregation queries first | Keeps dashboard and export logic consistent |
| RBAC | Role-based permissions plus scoped access policies | Supports admins, supervisor/auditors, developer/SRE users, and field users without over-granting |
| Metrics | Prometheus endpoint with Grafana dashboards | Gives developer/SRE users operational visibility without mixing monitoring with product dashboards |
| Background jobs | Add later only if needed | Avoid complexity until uploads, reports, or reminders require async processing |

Stack alternatives considered:

| Alternative | Benefit | Tradeoff | Decision |
| --- | --- | --- | --- |
| Express-only API | Simpler and lighter | Would lose existing NestJS module structure, guards, dependency injection, and tests | Do not switch |
| Fastify with custom services | Faster raw request handling | App is business-rule heavy, not request-throughput constrained yet | Do not switch now |
| Supabase-only backend | Faster CRUD and auth setup | Business workflow, permissions, audit, reporting, and evidence rules need custom backend control | Not primary backend |
| Firebase/Firestore | Easy realtime/mobile sync | Reporting and relational filters are weaker for this domain | Do not use as main database |
| MongoDB | Flexible documents | Tasks, users, clients, geography, evidence, and reports are relational | Do not use |
| Microservices | Clear separation at scale | Too much operational overhead for the current stage | Avoid for now |

Backend architecture decision:

- Use a modular monolith backend first.
- Keep one NestJS API service.
- Keep PostgreSQL as the system of record.
- Keep Prisma, but tighten schema design and migrations.
- Keep shared TypeScript contracts, but separate public API contracts from internal persistence models.
- Add background workers later only when a workflow genuinely needs async processing.

Why modular monolith:

- The product has connected workflows: tasks, evidence, users, clients, locations, reports, and permissions all depend on each other.
- A single backend service is easier to secure, test, deploy, and reason about at this stage.
- NestJS modules already give internal boundaries without the cost of distributed services.

Target backend module ownership:

| Module | Owns | Should Not Own |
| --- | --- | --- |
| `auth` | Login, JWT, sessions, guards, actor identity | Business workflow decisions |
| `identity-access` | Users, roles, permission matrix, supervisor scopes, platform scopes | Task mutation rules |
| `catalogs` | Provinces, cantons, districts, zones, clients, activities, task types | User task state |
| `tasks` | Assignment, task lifecycle, objective, status transitions, task history | Raw file storage |
| `evidence` | Evidence metadata, upload validation, completion requirements | Dashboard aggregation |
| `object-storage` | Local/S3 storage adapter, signed read URLs | Business rules about whether evidence is required |
| `field-operations` | Dashboard/report aggregation and exports | Task mutation side effects |
| `audit` | Immutable audit records | User-facing task status history |
| `system-health` | Health/readiness checks | Product metrics |
| `observability` | Prometheus metrics, request counters, latency histograms, operational gauges | Business dashboards |

Important distinction:

- Audit logs answer "who did what in the system?"
- Task status history answers "what happened to this task over time?"

Both are needed. They should not be collapsed into one table.

## RBAC Architecture

Objective: support business users, supervisor/auditors, and developer/SRE users without making every privileged user an admin.

Recommended model:

- Use roles for broad responsibility.
- Use permissions for exact actions.
- Use scopes for what data a user can access.
- Keep business roles separate from platform/operations roles.

Proposed roles:

| Role | Purpose | Typical Access |
| --- | --- | --- |
| `admin` | Business administrator | Manage users, clients, catalogs, tasks, dashboards, reports, and configuration |
| `supervisor_auditor` | Field operations manager and compliance reviewer | Assign/review scoped work, view evidence, reports, and audit logs within assigned scope |
| `field_user` | Collaborator/agent | View and complete assigned tasks, upload evidence |
| `developer_sre` | Application maintainer and reliability/operator role | Health, metrics, logs, diagnostics, readiness, operational dashboards, and environment-gated developer tools |

Recommended permission groups:

| Group | Example Permissions |
| --- | --- |
| User management | `users.view`, `users.manage`, `roles.manage` |
| Catalogs | `catalogs.view`, `catalogs.manage`, `geography.manage` |
| Tasks | `tasks.view`, `tasks.assign`, `tasks.complete`, `tasks.cancel`, `tasks.reschedule`, `tasks.override` |
| Evidence | `evidence.view`, `evidence.upload`, `evidence.review`, `evidence.delete` |
| Reports | `dashboards.view`, `reports.view`, `reports.export` |
| Audit | `audit.view`, `audit.export` |
| System | `system_health.view`, `metrics.view`, `ops.read`, `ops.manage`, `developer_tools.use` |
| Sessions | `device_sessions.view`, `device_sessions.revoke` |

Recommended analytics split:

| Surface | Audience | Purpose | Example data |
| --- | --- | --- | --- |
| Operations dashboard | `admin`, `supervisor_auditor` | Track field execution and team performance | task completion, pending/cancelled/rescheduled work, on-time completion, evidence completion, route coverage, activity totals |
| Operations reports/scorecards | `admin`, `supervisor_auditor` | Filter, compare, and export field-user performance over time | per-agent weekly/monthly scorecards, province/zone/client slices, completion trends, exception counts |
| Platform observability dashboard | `developer_sre` | Monitor runtime health and app behavior | request rate, latency, readiness, error counts, upload failures, email failures, queue depth |
| Platform observability drill-down | `developer_sre` | Debug and operate the platform | Prometheus metrics, protected health details, scrape health, release/build identifiers |

Two required ways to track field-user work:

1. A live supervisor/admin dashboard for current execution state.
2. Historical supervisor/admin reports and scorecards for weekly/monthly performance review.

These should remain separate from developer observability so business managers are not forced into Prometheus-style tooling and developers are not granted broad business analytics by default.

Recommended data scopes:

| Scope | Meaning |
| --- | --- |
| `organization` | Entire organization |
| `team` | Assigned team |
| `province` | Assigned province |
| `canton` | Assigned canton |
| `district` | Assigned district |
| `zone` | Assigned business zone |
| `client` | Assigned client |
| `self` | Only the authenticated user |

Role guidance:

- `admin` can mutate business configuration and users.
- `supervisor_auditor` can assign and review work inside scope, and can inspect evidence, reports, and audit logs inside scope.
- `developer_sre` should see operational health, metrics, logs, readiness, and diagnostics, but should not need business data mutation by default.
- `field_user` should not be able to assign tasks to others.

Important design choice:

- Do not model developer/SRE users as business admins.
- Give platform/operations users their own permissions.
- Use environment gates so developer tools only exist in local/staging unless explicitly enabled.

RBAC implementation tasks:

- Replace the current role list with `admin`, `supervisor_auditor`, `field_user`, and `developer_sre`.
- Split `system_health.view` from `metrics.view`.
- Add scoped audit/report permissions for `supervisor_auditor`.
- Add operational and developer diagnostics permissions for `developer_sre`.
- Add route coverage tests that ensure every controller has either `@Public()` or `@RequirePermissions(...)`.
- Add permission matrix tests for every role.
- Add scope tests for `supervisor_auditor`, `field_user`, and `developer_sre` access.
- Add explicit separation between:
  - business performance analytics permissions for `admin` and `supervisor_auditor`
  - platform observability permissions for `developer_sre`

Analytics implementation tasks:

- Define a supervisor/admin performance dashboard contract that includes:
  - summary KPIs
  - by-agent leaderboard/scorecard
  - by-zone / by-province / by-client slices
  - date-window filtering
- Define a supervisor/admin reporting/export contract that includes:
  - weekly and monthly scorecards
  - task status totals by agent
  - cancelled and rescheduled counts
  - evidence compliance
  - overdue and aging indicators
- Define a developer/SRE observability dashboard contract that includes:
  - readiness/liveness state
  - request throughput and latency
  - error and failed-upload rates
  - email/report export failure counters
  - build/release metadata when available
- Keep platform observability endpoints and screens separated from business dashboards in both API routing and frontend navigation.

Suggested permission refinement:

- Keep `dashboards.view` and `reports.export` for business analytics.
- Introduce `performance.view` and `performance.export` if business analytics need to be separated further from general dashboards/reports.
- Keep `metrics.view`, `system_health.view`, and `ops.read` reserved for platform observability.
- If admins need emergency observability access, treat it as an explicit break-glass path rather than the default dashboard experience.

Best practices:

- Permissions should be additive and explicit.
- Backend guards must enforce permissions even if the frontend hides UI.
- Avoid using one large `admin` role for non-business users.
- Avoid exposing Prometheus metrics publicly unless protected by network policy, API gateway, or a metrics-specific token.

## Developer/SRE Observability Metrics

Objective: expose operational signals that developer/SRE users can use in Prometheus and Grafana.

Recommended approach:

- Keep `/api/v1/system-health` for health/readiness JSON.
- Add `/metrics` or `/api/v1/metrics` for Prometheus format.
- Protect metrics through infrastructure/network policy, a metrics token, or the `metrics.view` permission.
- Use Prometheus for collection.
- Use Grafana for dashboards and alerting.

Recommended NestJS implementation:

- Use `prom-client` directly, or a maintained NestJS Prometheus integration.
- Add a metrics module.
- Add HTTP request counters and duration histograms.
- Add business-safe operational gauges.
- Avoid high-cardinality labels such as user ID, task ID, client name, email, or raw route params.

Recommended metrics:

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `capris_api_http_requests_total` | Counter | method, route, status_code | Request volume and error rates |
| `capris_api_http_request_duration_seconds` | Histogram | method, route, status_code | Latency and SLO tracking |
| `capris_api_active_sessions_total` | Gauge | environment | Active device/session count |
| `capris_api_failed_uploads_total` | Gauge | environment | Evidence upload health |
| `capris_api_pending_uploads_total` | Gauge | environment | Sync backlog |
| `capris_api_failed_email_total` | Gauge | environment | Email/consignation reliability |
| `capris_api_report_exports_total` | Counter | report_name, status | Report export usage/failures |
| `capris_api_task_status_transitions_total` | Counter | from_status, to_status | Workflow behavior and unexpected spikes |
| `capris_api_audit_events_total` | Counter | action, status | Security and operational trail volume |
| `capris_api_db_query_duration_seconds` | Histogram | operation | Database latency trend |
| `capris_api_object_storage_operations_total` | Counter | operation, status | Storage reliability |
| `capris_api_object_storage_duration_seconds` | Histogram | operation | Upload/download latency |

Grafana dashboard sections:

- API health and uptime.
- Request rate by route group.
- Error rate by route group.
- p50/p95/p99 latency.
- Database latency.
- Upload backlog and failures.
- Report export failures.
- Active sessions.
- Task transition volume.
- Audit event volume.

Alert candidates:

- API error rate above threshold.
- p95 latency above threshold.
- Database latency spike.
- Failed uploads above threshold.
- Pending uploads growing for a sustained period.
- Report export failures.
- Metrics endpoint unavailable.
- Health endpoint reports attention/degraded status.

Best practices:

- Product dashboards and developer/SRE dashboards are different things.
- Metrics must not leak client names, user emails, file names, task IDs, or evidence URLs.
- Use route templates as labels, not raw paths.
- Keep label cardinality low.
- Add metrics tests for endpoint availability and core counters.

## Backend Fix Workstream

Objective: turn the architecture pass into concrete backend tasks.

### Backend Phase 1: Stabilize And Protect The API Boundary

Tasks:

- Run the current API build and test suite.
- Add or confirm global request validation.
- Replace broad CORS with environment-based allowed origins.
- Add explicit API versioning strategy under `/api/v1`.
- Document backend environment variables.
- Confirm health and readiness endpoints.
- Confirm frontend never imports Prisma or backend-only modules.

Best practices:

- Reject invalid input at the controller boundary.
- Keep API error responses consistent.
- Avoid exposing internal stack traces to clients.

### Backend Phase 2: Normalize Core Domain Types

Tasks:

- Replace free-form task status strings with a shared enum.
- Add required statuses:
  - `pending`
  - `completed`
  - `cancelled`
  - `rescheduled`
- Decide whether `in_progress` remains useful.
- Convert important date fields from strings to database date/date-time fields where appropriate.
- Keep display formatting in the frontend, not the database.
- Replace manual `Math.random` IDs with UUIDs or CUIDs generated by Prisma.

Recommended decision:

- Use `DateTime` for event timestamps such as `completedAt`, `cancelledAt`, `createdAt`, and evidence upload times.
- Use either `DateTime` or a clearly named date-only convention for scheduled task dates.
- Use Prisma-generated IDs, preferably `@default(cuid())` or `@default(uuid())`.

Tradeoff:

- Date-only fields are convenient for schedules, but JavaScript and databases can introduce timezone confusion.
- `DateTime` is safer for audit/history events.
- For field operations in Costa Rica, the backend should standardize around `America/Costa_Rica` for business-day interpretation.

### Backend Phase 3: Rework Database Schema

Tasks:

- Add `Canton` and `District` models.
- Connect tasks and points of sale to official geography.
- Keep `Zone` as a business grouping, separate from official geography.
- Add `objective` to `Task`.
- Add task lifecycle fields:
  - `completedAt`
  - `cancelledAt`
  - `rescheduledFrom`
  - `rescheduledTo`
  - `cancellationReason`
  - `completionNotes`
- Add `TaskStatusHistory`.
- Rename or generalize `EvidencePhoto` to `TaskEvidence`.
- Keep `MediaAsset` for storage metadata.
- Add useful indexes for agent, client, location, status, and date filters.

Best practices:

- Use migrations for production.
- Keep seed data deterministic.
- Avoid destructive schema changes until existing data migration is planned.

### Backend Phase 4: Rework Task Workflow Rules

Tasks:

- Centralize allowed task transitions in the task service.
- Add validation for:
  - Completion
  - Cancellation
  - Rescheduling
  - Evidence requirements
  - Supervisor override
- Write task status history inside the same database transaction as status updates.
- Add tests for each valid and invalid transition.
- Make task deletion rare and guarded.

Recommended transition model:

| From | To | Required Data |
| --- | --- | --- |
| `pending` | `completed` | Evidence or supervisor override |
| `pending` | `cancelled` | Cancellation reason |
| `pending` | `rescheduled` | New date |
| `rescheduled` | `completed` | Evidence or supervisor override |
| `rescheduled` | `cancelled` | Cancellation reason |
| `completed` | No normal transition | Admin correction only |
| `cancelled` | No normal transition | Admin correction only |

Open decision:

- Decide whether `in_progress` is a real business status or only a frontend convenience.
- If field agents need check-in/check-out, that may belong to `Visit`, not `Task`.

### Backend Phase 5: Evidence And Storage Rework

Tasks:

- Generalize evidence from photo-only language to file evidence.
- Support image and document MIME types.
- Add server-side size/type validation.
- Store file bytes in object storage.
- Store file metadata in PostgreSQL.
- Generate signed read URLs for private files.
- Avoid generating image thumbnails for documents.
- Add tests for supported and rejected file types.

Recommended structure:

- `MediaAsset`: storage object metadata.
- `TaskEvidence`: business relationship between task and file.

Tradeoff:

- Base64 upload is simple, but inefficient for larger documents.
- Multipart uploads or signed direct uploads are better for production.
- For the first backend pass, keep current local/S3 storage adapter, then improve upload transport.

### Backend Phase 6: Reporting And Dashboard Backend

Tasks:

- Keep report aggregation in backend services.
- Add weekly, monthly, and custom date range filters.
- Add filters for:
  - Agent
  - Client
  - Province
  - Canton
  - District
  - Zone
  - Activity
  - Status
- Add completion rate calculations.
- Add missing evidence calculations.
- Add overdue and rescheduled metrics.
- Keep CSV export first.
- Add Excel/PDF later only after CSV behavior is correct.

Best practices:

- Use database filters before in-memory filtering when data grows.
- Add indexes before adding heavy dashboard views.
- Keep report definitions testable.

### Backend Phase 7: Security And Operational Hardening

Tasks:

- Confirm all controllers require auth unless explicitly public.
- Confirm permission decorators exist on all sensitive routes.
- Expand RBAC for `admin`, `supervisor_auditor`, `field_user`, and `developer_sre` roles.
- Add permission groups for audit, metrics, operations, and developer diagnostics.
- Scope every read/write by organization.
- Scope field users to their own assignments.
- Scope supervisor/auditors by configured province, canton, district, zone, client, or team.
- Keep developer/SRE access focused on health, metrics, logs, diagnostics, and operational state.
- Keep developer tools environment-gated and least-privileged.
- Add rate limiting for auth and upload endpoints.
- Add request size limits per endpoint, not just globally.
- Add structured logging.
- Add error tracking hooks.
- Add Prometheus metrics endpoint.
- Add request counters, latency histograms, and operational gauges.
- Add Grafana dashboard definitions or setup notes.

Best practices:

- Frontend can hide actions, but backend must enforce every permission.
- Never rely on client-supplied user IDs without checking the authenticated actor.
- Keep audit records immutable.
- Do not expose metrics publicly without infrastructure protection or explicit metrics auth.
- Do not include sensitive business identifiers in metric labels.

### Backend Phase 8: Migration And Compatibility Plan

Tasks:

- Create migration plan from old schema to new schema.
- Map old `EvidencePhoto` records to new `TaskEvidence`.
- Map old task statuses to new statuses.
- Add default objectives for legacy tasks if needed.
- Add default canton/district values only after confirming location source data.
- Preserve audit logs.
- Preserve media storage paths.

Best practices:

- Back up production data before migration.
- Run migration on staging first.
- Validate report totals before and after migration.

## Backend Priority Order

1. Confirm build/test baseline.
2. Add global validation and CORS hardening.
3. Fix shared status contract.
4. Add task objective and lifecycle fields.
5. Add `Canton`, `District`, and indexes.
6. Add `TaskStatusHistory`.
7. Rework task status transitions.
8. Generalize evidence from photos to files.
9. Add backend reporting filters for week/month/agent.
10. Expand RBAC for `supervisor_auditor` and `developer_sre`.
11. Add Prometheus metrics and Grafana dashboard guidance.
12. Harden permissions, metrics, and audit coverage.

## Backend Implementation Phases

Objective: split the backend rework into concrete implementation phases and tasks.

### Implementation Phase 1: Baseline And Safety Rails

Objective: make the backend measurable, buildable, and protected before changing roles, schema, workflow, or reporting behavior.

This phase should avoid product changes. The goal is to establish a safe baseline and fix only the issues that prevent reliable backend development.

### Phase 1.1: Repository And Backend Baseline

Tasks:

- Confirm the active repo, branch, and working tree status.
- Identify existing unrelated changes and avoid touching them.
- Confirm Node.js and npm versions match the repo requirements.
- Confirm workspace package structure.
- Confirm the backend entrypoint, modules, and current route prefix.
- Confirm whether dependencies are installed.

Commands:

- `git status --short`
- `node --version`
- `npm --version`
- `npm --workspace apps/api run typecheck`
- `npm --workspace apps/api run build`

Deliverables:

- Backend baseline note with:
  - Branch name
  - Node/npm versions
  - Backend package version
  - Build result
  - Typecheck result
  - Existing unrelated worktree changes

Exit criteria:

- We know whether the backend builds before functional edits begin.
- We know which failures are pre-existing.

### Phase 1.2: Test And Prisma Baseline

Tasks:

- Run the backend test suite.
- Validate the Prisma schema.
- Confirm whether a local database is required for tests.
- Confirm whether tests are unit-only, integration-style, or mixed.
- Record failures by category:
  - Type errors
  - Schema errors
  - Missing environment variables
  - Missing database
  - Business logic test failures
  - Permission failures

Commands:

- `npx prisma validate --schema apps/api/prisma/schema.prisma`
- `npm --workspace apps/api run test`
- `npm --workspace apps/api run db:generate`

Deliverables:

- Test baseline summary.
- Prisma validation result.
- List of commands that pass/fail.
- First failing test or error per category.

Exit criteria:

- Prisma schema validity is known.
- Test suite status is known.
- Any environment dependency is documented.

### Phase 1.3: Environment Configuration Audit

Tasks:

- Identify all backend environment variables used by the API.
- Group variables by purpose:
  - Server
  - Database
  - Auth/JWT
  - Google auth if still used
  - Object storage
  - Media signing
  - Email
  - CORS
  - Metrics
- Create or update backend environment documentation.
- Confirm which variables are required in local, staging, and production.
- Confirm no secrets are committed.

Expected environment variables:

- `PORT`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MEDIA_URL_SIGNING_SECRET`
- `MEDIA_URL_TTL_SECONDS`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `CORS_ALLOWED_ORIGINS`
- `METRICS_TOKEN`

Deliverables:

- Backend environment variable reference.
- Local `.env.example` recommendation if missing.
- Required versus optional variable list.

Exit criteria:

- A developer can tell which variables are needed to run the backend locally.
- Production-only secrets are clearly separated from local defaults.

### Phase 1.4: API Boundary And Validation Safety

Tasks:

- Confirm all routes are under `/api/v1`.
- Add or verify global request validation.
- Confirm controllers parse request bodies through shared schemas or DTOs.
- Confirm invalid input produces predictable 400 responses.
- Confirm payload size limits are appropriate.
- Confirm public endpoints are explicitly marked public.
- Confirm protected endpoints require auth and permissions.

Recommended backend changes:

- Add a global validation layer if missing.
- Keep shared Zod schemas where already used.
- Add a consistent `parseInput` helper if the pattern already exists.
- Avoid duplicating validation in frontend components.

Deliverables:

- API validation checklist.
- List of routes that still need validation.
- Route protection checklist.

Exit criteria:

- New backend features have a clear validation pattern to follow.
- Unsafe or unvalidated route patterns are documented before Phase 2.

### Phase 1.5: CORS And Request Hardening

Tasks:

- Replace broad `app.enableCors()` with environment-based CORS.
- Add `CORS_ALLOWED_ORIGINS` support.
- Allow local frontend origins for development.
- Restrict production origins.
- Confirm allowed methods and headers.
- Review JSON/body size limits.
- Plan endpoint-specific upload limits for evidence.

Recommended behavior:

- Local can allow `http://localhost:3000` and other documented dev ports.
- Staging should allow only staging frontend domains.
- Production should allow only production frontend domains.
- Metrics should not be exposed through ordinary browser CORS.

Deliverables:

- Hardened CORS configuration.
- CORS environment docs.
- Request size limit notes.

Exit criteria:

- Backend is not using unrestricted CORS outside local development.
- Frontend/backend separation has a clean API boundary.

### Phase 1.6: Health And Readiness Baseline

Tasks:

- Confirm public health endpoint behavior.
- Confirm protected health/details endpoint behavior.
- Decide whether to split:
  - Liveness: API process is alive.
  - Readiness: API can reach required dependencies.
  - Details: protected operational summary.
- Add database connectivity to readiness if missing.
- Keep detailed operational state protected.

Recommended endpoints:

- `GET /api/v1/system-health`
- `GET /api/v1/system-health/readiness`
- `GET /api/v1/system-health/details`

Deliverables:

- Health endpoint behavior notes.
- Readiness checklist.
- Protected operational details checklist.

Exit criteria:

- Deployment platforms can check basic liveness.
- Operators can check protected backend details.
- Detailed health does not leak sensitive data publicly.

### Phase 1.7: Route Permission Coverage Baseline

Tasks:

- Inventory all controllers.
- Confirm every controller method is either:
  - Explicitly public, or
  - Protected by required permissions.
- Identify routes with missing permission decorators.
- Identify routes protected by overly broad permissions.
- Add a route permission coverage test if feasible.

Deliverables:

- Route permission inventory.
- Missing/weak permission list.
- Test recommendation for route coverage.

Exit criteria:

- RBAC Phase 2 can proceed with a known route surface.
- There are no unknown public backend routes.

### Phase 1.8: Phase 1 Report

Tasks:

- Create a short backend baseline report.
- Include pass/fail status for all checks.
- Include known blockers.
- Include recommended fixes before Phase 2.
- Separate pre-existing issues from changes introduced during Phase 1.

Deliverables:

- `docs/backend/phase-1-baseline.md` or equivalent.
- Updated environment documentation if needed.
- Backend safety checklist.

Exit criteria:

- Phase 2 can begin without guessing about build, tests, env config, validation, CORS, health, or route protection.

### Implementation Phase 2: RBAC Role Model Rework

Tasks:

- Replace current roles with:
  - `admin`
  - `supervisor_auditor`
  - `field_user`
  - `developer_sre`
- Update shared role types.
- Update role definitions and translations.
- Update permission matrix.
- Add `metrics.view`, `ops.read`, `ops.manage`, and `developer_tools.use`.
- Split audit/report read permissions from mutation permissions.
- Add tests for every role and permission group.

Deliverables:

- Updated shared RBAC contract.
- Updated backend permission guard tests.
- Updated route permission coverage.

### Implementation Phase 3: Scoped Access Rules

Tasks:

- Extend supervisor/auditor scopes to support:
  - Organization
  - Team
  - Province
  - Canton
  - District
  - Zone
  - Client
  - Self
- Ensure field users only access assigned tasks and related evidence.
- Ensure supervisor/auditors only access records within assigned scope.
- Ensure developer/SRE access does not imply business data mutation.
- Add scoped read/write tests for tasks, evidence, reports, audit, and dashboards.

Deliverables:

- Updated actor access service.
- Scoped access test suite.
- Permission matrix documentation.

### Implementation Phase 4: Observability Foundation

Tasks:

- Add backend `observability` module.
- Add Prometheus metrics endpoint.
- Protect metrics through `metrics.view`, metrics token, or infrastructure network rules.
- Add HTTP request counter.
- Add HTTP request duration histogram.
- Add operational gauges for:
  - Failed uploads
  - Pending uploads
  - Failed emails
  - Active sessions
  - Report export failures
- Add metrics tests.

Deliverables:

- Prometheus-compatible metrics endpoint.
- Core API metrics.
- Operational health gauges.

### Implementation Phase 5: Grafana And Alerting

Tasks:

- Document Grafana dashboard panels.
- Add dashboard JSON later if Grafana target is confirmed.
- Define alert thresholds for:
  - API error rate
  - p95 latency
  - Failed uploads
  - Pending upload backlog
  - Database latency
  - Report export failures
- Document scrape configuration.

Deliverables:

- Grafana dashboard plan.
- Prometheus scrape notes.
- Developer/SRE alert checklist.

### Implementation Phase 6: Domain Schema Rework

Tasks:

- Add `Canton` and `District`.
- Add `objective` to task assignment.
- Add task lifecycle fields.
- Add `TaskStatusHistory`.
- Replace free-form status strings with stable shared statuses.
- Replace manual IDs with Prisma-generated IDs.
- Add reporting indexes.

Deliverables:

- Updated Prisma schema.
- Migration plan.
- Seed strategy for Costa Rica geography.

### Implementation Phase 7: Workflow And Evidence Rework

Tasks:

- Implement task status transitions.
- Require cancellation reason for cancelled tasks.
- Require new date for rescheduled tasks.
- Require evidence or approved override for completed tasks.
- Generalize `EvidencePhoto` into file evidence.
- Add document MIME type support.
- Add upload validation and tests.

Deliverables:

- Task workflow service updates.
- Evidence upload updates.
- Workflow and evidence tests.

### Implementation Phase 8: Reporting And Release Hardening

Tasks:

- Add weekly/monthly report filters.
- Add agent-based report filters.
- Add province/canton/district/zone filters.
- Add report metrics.
- Add final API integration tests.
- Run full backend test suite.
- Update backend README and environment docs.

Deliverables:

- Backend-ready reporting APIs.
- Updated documentation.
- Full backend verification pass.

## Phase 1: Frontend And Backend Separation

Objective: enforce a clean boundary between UI and server logic.

Tasks:

- Confirm `apps/web` only calls backend API endpoints.
- Remove any direct database, Prisma, or server-only imports from frontend code.
- Centralize frontend API calls in a client layer.
- Define API response contracts in `packages/shared`.
- Make `NEXT_PUBLIC_API_BASE_URL` the only frontend API location setting.
- Confirm backend owns:
  - Auth
  - Permissions
  - Task status rules
  - Reporting queries
  - Evidence upload signing/storage
  - Database access
- Add CORS configuration for the frontend domain.
- Add health endpoint for backend monitoring.

Deliverables:

- Clean frontend API client.
- Backend-only database access.
- Documented environment variables for web and API.
- Verified local frontend/backend communication.

Best practices:

- No Prisma client in frontend.
- No business rules duplicated in React components.
- Keep frontend state focused on presentation and user interaction.

## Phase 2: Database Model Rework

Objective: support the full field operations workflow with a durable schema.

Tasks:

- Review current Prisma schema.
- Add or confirm models for:
  - Organization
  - User
  - Role/permissions
  - Client
  - Province
  - Canton
  - District
  - Zone
  - Activity
  - Task
  - TaskEvidence
  - TaskStatusHistory
  - ReportSnapshot
- Add missing task fields:
  - `objective`
  - `scheduledDate`
  - `completedAt`
  - `cancelledAt`
  - `rescheduledFrom`
  - `rescheduledTo`
  - `cancellationReason`
  - `completionNotes`
- Model Costa Rica geography as:
  - Province
  - Canton
  - District
- Keep business zones separate from official geography.
- Add indexes for reporting queries:
  - `assignedToId`
  - `clientId`
  - `provinceId`
  - `districtId`
  - `status`
  - `scheduledDate`
- Add seed data for Costa Rica provinces, cantons, and districts.

Deliverables:

- Updated Prisma schema.
- Database migration or `db:push` strategy.
- Seed script for geography and core roles.
- Entity relationship notes.

Best practices:

- Use migrations for production databases.
- Avoid storing files directly in PostgreSQL.
- Keep status history immutable.
- Add indexes based on dashboard/report filters.

## Phase 3: Task Workflow Rework

Objective: match the real operational workflow.

Required statuses:

- `pending`
- `completed`
- `cancelled`
- `rescheduled`

Tasks:

- Replace the limited task status enum with the required statuses.
- Define valid status transitions.
- Add backend validation:
  - Completed tasks require evidence or supervisor override.
  - Cancelled tasks require a reason.
  - Rescheduled tasks require a new date.
  - Status changes create a history record.
- Add task assignment fields:
  - Collaborator/agent
  - Client
  - Province
  - Canton
  - District
  - Zone
  - Activity
  - Objective
  - Date
- Add audit tracking:
  - Created by
  - Assigned by
  - Updated by
  - Status changed by
- Update frontend task forms.
- Update field user task completion flow.

Deliverables:

- New task workflow API.
- Updated task assignment UI.
- Updated field execution UI.
- Status history visible to supervisors/admins.

Best practices:

- Put transition rules in backend services.
- Use shared enums for frontend labels, not frontend-only strings.
- Make workflow validation explicit and testable.

## Phase 4: Evidence Uploads

Objective: support photos and documents as proof of work.

Supported evidence types:

- Photos
- PDFs
- Word documents
- Excel files
- Other approved business documents

Tasks:

- Create or update `TaskEvidence` model.
- Store file metadata:
  - Task ID
  - Uploaded by
  - File name
  - MIME type
  - File size
  - Storage key or URL
  - Upload timestamp
  - Optional GPS coordinates
- Add backend upload endpoint.
- Add file type and size validation.
- Add storage adapter for local development.
- Add production adapter for S3-compatible storage.
- Update frontend upload component.
- Allow multiple files per task.
- Show evidence preview or download links.
- Add missing evidence report.

Deliverables:

- Evidence upload API.
- Evidence UI for field users.
- Evidence review UI for supervisors/admins.
- Storage configuration documentation.

Best practices:

- Store files outside the database.
- Validate MIME type and size server-side.
- Do not trust browser-provided file metadata alone.
- Use signed URLs for private files.

## Phase 5: Reports And Dashboard

Objective: automatically consolidate work and expose weekly/monthly results.

Dashboard views:

- Weekly
- Monthly
- Custom date range

Core metrics:

- Tasks assigned
- Tasks completed
- Tasks pending
- Tasks cancelled
- Tasks rescheduled
- Completion rate
- Overdue tasks
- Missing evidence
- Activity count
- Client coverage
- Agent productivity
- District/province activity distribution

Report filters:

- Agent
- Client
- Province
- Canton
- District
- Zone
- Activity
- Status
- Date range

Tasks:

- Create reporting service in backend.
- Add aggregation queries.
- Add report endpoints.
- Add export support:
  - CSV first
  - Excel second
  - PDF later if needed
- Update dashboard UI with period controls.
- Add charts/tables for agent and client reporting.
- Add empty/loading/error states.

Deliverables:

- Weekly dashboard.
- Monthly dashboard.
- Agent-based report.
- Client-based report.
- Exportable report data.

Best practices:

- Keep report calculations in backend.
- Add database indexes before heavy dashboard queries.
- Avoid calculating large reports only in the browser.

## Phase 6: Bilingual English/Spanish Support

Objective: make bilingual support complete and consistent.

Tasks:

- Audit all visible frontend strings.
- Move hardcoded strings into translation files.
- Add language toggle.
- Persist user language preference.
- Translate:
  - Navigation
  - Task statuses
  - Forms
  - Validation messages
  - Dashboard labels
  - Report headers
  - Empty states
  - Error messages
- Confirm backend-generated messages support both languages where user-facing.

Deliverables:

- Complete English translations.
- Complete Spanish translations.
- Language preference saved per user.
- Bilingual report labels.

Best practices:

- Use translation keys instead of duplicated conditional text.
- Keep enum values stable and translate labels separately.
- Test the longest Spanish labels in compact UI areas.

## Phase 7: Authentication, Roles, And Permissions

Objective: protect operational data by role and scope.

Roles:

- Admin
- Supervisor/auditor
- Field user/agent
- Developer/SRE

Tasks:

- Review current JWT implementation.
- Confirm refresh token flow.
- Verify role-based access rules.
- Enforce server-side permissions for:
  - Creating tasks
  - Assigning tasks
  - Completing tasks
  - Cancelling tasks
  - Rescheduling tasks
  - Viewing reports
  - Reviewing evidence
  - Exporting reports
- Ensure field users only see their assigned work.
- Ensure supervisor/auditors only see scoped team, location, client, report, evidence, and audit data unless configured otherwise.
- Ensure developer/SRE users can access operational health, metrics, logs, and diagnostics without business mutation by default.

Deliverables:

- Permission matrix.
- Backend guards/policies.
- Tests for role access.

Best practices:

- Hide unavailable UI actions, but enforce permissions on the backend.
- Never trust role checks from the frontend alone.
- Add audit fields for sensitive actions.

## Phase 8: Quality, Testing, And Best Practices

Objective: make the app maintainable and safer to change.

Tasks:

- Add or improve unit tests for:
  - Task status transitions
  - Task assignment validation
  - Evidence upload validation
  - Report filters
  - Permission rules
- Add API integration tests for critical flows.
- Add frontend tests for task forms and dashboard filters.
- Add linting and type checking to CI.
- Add Prisma schema validation to CI.
- Add build checks for web and API.
- Add seed data for local QA.
- Document local test commands.

Deliverables:

- Passing test suite.
- CI workflow.
- Local QA checklist.
- Regression test coverage for core flows.

Best practices:

- Test business rules where they live: the backend.
- Keep frontend tests focused on user workflows.
- Add test data that mirrors real Costa Rica operations.

## Phase 9: Deployment And Environments

Objective: prepare the app for clean local, staging, and production deployments.

Environments:

- Local
- Staging
- Production

Tasks:

- Define required environment variables.
- Split deployment services:
  - Web service
  - API service
  - PostgreSQL service
  - Object storage
- Configure CORS per environment.
- Configure database migrations.
- Configure storage credentials.
- Add health checks.
- Add deployment documentation.
- Add backup strategy for PostgreSQL.
- Add basic observability:
  - API logs
  - Error tracking
  - Failed upload logging
  - Slow report query logging

Deliverables:

- Deployment guide.
- Environment variable reference.
- Staging environment.
- Production readiness checklist.

Best practices:

- Keep secrets out of source control.
- Run migrations intentionally in production.
- Use separate databases for local, staging, and production.

## Phase 10: Product Polish And Field Readiness

Objective: make the app reliable for daily field use.

Tasks:

- Improve mobile responsiveness.
- Make task completion fast from mobile.
- Add clear offline/error states.
- Add upload progress for evidence.
- Add retry for failed uploads.
- Add supervisor review screen.
- Add admin configuration screens for:
  - Clients
  - Zones
  - Activities
  - Users
  - Geography imports
- Add dashboard print/export support if needed.

Deliverables:

- Mobile-friendly field workflow.
- Supervisor review workflow.
- Admin configuration workflow.
- Field QA checklist.

Best practices:

- Optimize the field user flow for speed.
- Avoid making agents navigate through admin-heavy screens.
- Keep dashboard pages dense, clear, and operational.

## Suggested Execution Order

1. Stabilize the repo and confirm builds.
2. Enforce frontend/backend separation.
3. Rework the database schema.
4. Implement the new task workflow.
5. Expand evidence uploads.
6. Build reports and dashboard filters.
7. Complete bilingual support.
8. Harden permissions and tests.
9. Prepare staging deployment.
10. Polish the mobile field experience.

## Immediate Next Tasks

These should be handled first:

- Bring the Capris repo into the active workspace.
- Run the current build/test baseline.
- Review and update the Prisma schema.
- Add missing task statuses.
- Add `objective` to task assignment.
- Add Costa Rica canton/district hierarchy.
- Update frontend task creation form.
- Update field task completion flow.
- Add document evidence support.
- Add weekly/monthly dashboard filters.

## Definition Of Done

The rework is complete when:

- Frontend and backend are independently deployable.
- Backend owns all database access and business rules.
- PostgreSQL is configured for local, staging, and production.
- Tasks can be assigned by client, location, activity, objective, and date.
- Tasks support pending, completed, cancelled, and rescheduled states.
- Photos and documents can be uploaded as evidence.
- Reports can be generated by agent.
- Weekly and monthly dashboards are available.
- English and Spanish are supported across the main workflows.
- Role-based permissions are enforced by the backend.
- Core workflows are covered by tests.
