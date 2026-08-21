# Backend Phase 1 Baseline

Last updated: 2026-08-20

## Scope

Phase 1 establishes backend safety rails before RBAC, schema, workflow, and reporting changes.

Implemented in this pass:

- Environment-based CORS configuration in `apps/api/src/main.ts`
- Public readiness endpoint in `apps/api/src/modules/system-health`
- Backend environment template in `apps/api/.env.example`
- Phase 1 baseline and manual validation notes in this document

## Current backend boot behavior

- API prefix: `/api/v1`
- JSON/body limit: `25mb`
- Database startup: Prisma service selects an explicit datasource URL and refuses localhost Postgres in production-like environments
- CORS:
  - Local development allows documented localhost origins by default
  - Production/staging should use `CORS_ALLOWED_ORIGINS`
- Health endpoints:
  - `GET /api/v1/system-health`
- `GET /api/v1/system-health/readiness`
- `GET /api/v1/system-health/details`

## Observed verification results on 2026-08-20

- Branch at execution time: `main`
- Node.js: `v24.13.1`
- npm: `11.8.0`
- Prisma validation: passed
- API typecheck: passed
- API build: blocked by Windows file lock inside `apps/api/node_modules/.prisma/client`
- API test suite: blocked by Windows file lock while writing `packages/shared/dist/*`

Notes:

- Root-level PowerShell `npm` and `npx` commands were blocked by execution policy; `npm.cmd` and direct local binaries were required instead.
- A live `node.exe` process was present during validation and may be contributing to generated-file locks.
- The current automated blockers look environmental, not TypeScript compile failures in the Phase 1 edits.

## Environment variable baseline

Local development:

- `PORT`
- `NODE_ENV`
- `DATABASE_URL`
- `DATABASE_URL_DOCKER` when validating through Docker Compose
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `CORS_ALLOWED_ORIGINS`
- `MEDIA_URL_SIGNING_SECRET`
- `MEDIA_URL_TTL_SECONDS`

Optional depending on features:

Local API scripts should resolve env from the repo-root `.env` so Prisma and Nest use the same source of truth during development.

- `DEFAULT_REGISTRATION_ORGANIZATION_ID`
- `CAPRIS_QA_PASSWORD`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `GOOGLE_CLIENT_ID`
- `POSTMARK_TOKEN`
- `SENDGRID_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `DEFAULT_FROM_EMAIL`

## Route protection baseline

Public routes currently expected:

- `GET /api/v1/system-health`
- `GET /api/v1/system-health/readiness`
- `GET /api/v1/storage/:scope/:encodedKey`
- Public auth entrypoints under `/api/v1/auth/*`

Protected route categories currently in code:

- Tasks
- Visits
- Evidence
- Notes
- Consignations
- Activities
- Exhibitions
- Client requests
- Calendar
- Reports
- Catalog management
- Access/role management
- Protected health details

Auth-only routes that should be revisited in Phase 2 RBAC:

- `GET /api/v1/tasks/bootstrap`
- `GET /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `GET /api/v1/bootstrap`
- `GET /api/v1/organizations`
- `GET /api/v1/teams`

These are not necessarily wrong today, but they should be made explicit under the next RBAC pass.

## Manual validation checklist

### Build and typecheck

Run:

- `npm.cmd --workspace apps/api run typecheck`
- `npm.cmd --workspace apps/api run build`
- `& '.\node_modules\.bin\prisma.cmd' validate --schema prisma\schema.prisma`
- `npm.cmd --workspace apps/api run test`

Expected:

- Typecheck passes
- Build passes
- Prisma schema validates
- Tests pass, including `system-health.test.ts`

### Health endpoints

Run the API locally and verify:

- `GET /api/v1/system-health` returns `status: "ok"`
- `GET /api/v1/system-health/readiness` returns:
  - `status: "ok"` when the database is reachable
  - `status: "degraded"` when the database is unavailable
- `GET /api/v1/system-health/details` requires auth plus `system_health.view`

### CORS behavior

Local development:

- Requests from `http://localhost:3000` should be allowed by default
- Requests from an arbitrary unknown browser origin should fail once `CORS_ALLOWED_ORIGINS` is explicitly set

Staging/production:

- Only configured frontend origins should be allowed

### Environment validation

Verify:

- `apps/api/.env.example` covers required local variables
- Local secrets are not committed
- Production values are provided through deployment secrets, not source control

### Current blockers to watch during manual validation

If build/test still fail, check:

- Whether a local dev server or watcher is holding locks on generated files
- Whether `packages/shared/dist` or `apps/api/node_modules/.prisma/client` are being held by another process
- Whether the validation is being run from PowerShell with `npm` instead of `npm.cmd`

## Exit criteria for Phase 1

Phase 1 is complete when:

- Backend build/test status is known
- API prefix and health endpoints are stable
- CORS is no longer fully open by default in production-like use
- Local environment expectations are documented
- Route protection gaps are identified for Phase 2
