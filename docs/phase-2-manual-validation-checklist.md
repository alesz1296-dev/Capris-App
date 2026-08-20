# Phase 2 Manual Validation Checklist

Date: August 20, 2026

Use this checklist before calling Phase 2 ready for merge or staging deployment.

## 1. RBAC and scoped-access validation

### Admin

1. Sign in as admin.
2. Confirm access to:
   - identity/access management
   - catalogs/configuration
   - reports/dashboard
   - system health details
3. Confirm admin can:
   - assign tasks
   - review consignations
   - view exceptions
   - revoke device sessions

### Supervisor/Auditor

1. Sign in as supervisor/auditor.
2. Confirm access to:
   - agenda
   - rutas/route workspace
   - reports
   - evidence review
   - audit-facing operational screens
3. Confirm no access to:
   - full identity admin actions
   - system metrics endpoint unless explicitly exposed through infrastructure
4. Validate scoped visibility:
   - records inside assigned province/team are visible
   - records outside assigned province/team are hidden
   - calendar bootstrap only shows scoped agenda/tasks/visits/requests

### Field user

1. Sign in as field user.
2. Confirm only assigned tasks/visits are visible.
3. Confirm field user can:
   - complete own tasks
   - upload evidence
   - manage own notes
4. Confirm field user cannot:
   - assign tasks
   - review consignations
   - access admin/config screens

### Developer/SRE

1. Sign in as developer/SRE.
2. Confirm access is limited to operational tooling.
3. Confirm no business mutation actions are available.
4. Confirm direct business-record actions are rejected with the developer/SRE restriction message.

## 2. API health/readiness/metrics

### Public probes

1. `GET /api/v1/system-health`
2. `GET /api/v1/system-health/liveness`
3. `GET /api/v1/system-health/readiness`

Expected:

- liveness returns `200`
- readiness returns `200` when database is healthy
- readiness returns `503` when database is unavailable

### Protected/system ops

1. `GET /api/v1/system-health/details` with admin token
2. `GET /api/v1/metrics`

Expected:

- details returns operational summary
- metrics returns Prometheus text format
- if `METRICS_BEARER_TOKEN` is set, unauthenticated or wrong-token requests fail

### Metrics expectations

Confirm presence of:

- `capris_process_uptime_seconds`
- `capris_http_requests_total`
- `capris_http_request_duration_ms_sum`
- `capris_active_sessions_total`
- `capris_failed_uploads_total`
- `capris_pending_uploads_total`
- `capris_failed_emails_total`
- `capris_report_export_failures_total`

## 3. Web probes

1. `GET /api/health`
2. `GET /api/readiness`

Expected:

- health returns `200`
- readiness returns `200` when `NEXT_PUBLIC_API_BASE_URL` is set
- readiness returns `503` when `NEXT_PUBLIC_API_BASE_URL` is missing

## 4. Container validation

1. Run `docker compose up --build`
2. Confirm:
   - `postgres` is healthy
   - `api` is healthy
   - `web` is healthy
3. Restart only `api` and confirm no data loss in business state.
4. Restart only `web` and confirm no data loss in business state.
5. Confirm metrics endpoint is still reachable after API restart.

## 5. CI validation

1. Push branch.
2. Confirm GitHub Actions CI runs.
3. Confirm:
   - workspace typecheck
   - Prisma validation
   - schema sync
   - tests
   - shared/api/web builds

## 6. Cleanup before commit

Review and exclude unrelated local changes such as:

- user-owned UI polish not part of Phase 2
- generated cache/build files
- local-only `.env` files

Recommended checks:

1. `git status --short`
2. verify only intended files are staged
3. confirm no real secrets are staged

## 7. Exit criteria

Phase 2 can be called ready only when:

- manual RBAC checks pass
- scoped calendar visibility is correct
- health/readiness/metrics behave correctly
- containers are healthy and stateless
- CI passes on the branch
