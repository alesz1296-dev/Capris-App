# Phase 2 Ops Foundation

Date: August 20, 2026

This document captures the operational baseline added during the backend-first rework pass.

## What changed

### 1. Clean probe endpoints

API:

- `GET /api/v1/system-health`
- `GET /api/v1/system-health/liveness`
- `GET /api/v1/system-health/readiness`
- `GET /api/v1/system-health/details`
- `GET /api/v1/metrics`

Web:

- `GET /api/health`
- `GET /api/readiness`

Behavior:

- Liveness is lightweight and only verifies the container process/runtime.
- Readiness verifies that the API can reach the database.
- API readiness now returns HTTP `503` when the database is unavailable.
- Web readiness returns HTTP `503` when `NEXT_PUBLIC_API_BASE_URL` is not configured.

### 2. Prometheus-friendly metrics

Added an in-memory Prometheus text endpoint at `GET /api/v1/metrics`.

Current metrics:

- `capris_process_uptime_seconds`
- `capris_build_info`
- `capris_http_requests_total`
- `capris_http_request_duration_ms_sum`
- `capris_http_request_duration_ms_count`
- `capris_active_sessions_total`
- `capris_failed_uploads_total`
- `capris_pending_uploads_total`
- `capris_failed_emails_total`
- `capris_report_export_failures_total`

Notes:

- This is intentionally stateless and process-local.
- Each API container exposes its own metrics; Prometheus should scrape every replica.
- `METRICS_BEARER_TOKEN` can be set to require `Authorization: Bearer <token>` for scrapes.
- If no metrics token is configured, the endpoint remains reachable for internal/private-network scraping.

### 3. Environment and secret separation

Added/updated:

- root [.env.example](/C:/Users/alesz/Projects_Apps/Capris-App/.env.example)
- API [apps/api/.env.example](/C:/Users/alesz/Projects_Apps/Capris-App/apps/api/.env.example)
- Web [apps/web/.env.example](/C:/Users/alesz/Projects_Apps/Capris-App/apps/web/.env.example)

Separation rules:

- API secrets stay server-side only:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `MEDIA_URL_SIGNING_SECRET`
  - `METRICS_BEARER_TOKEN`
  - storage/email provider credentials
- Web variables must remain non-sensitive and use `NEXT_PUBLIC_*`.
- Client-side bundles must never receive API secrets.

### 4. Stateless container direction

Updated [docker-compose.yml](/C:/Users/alesz/Projects_Apps/Capris-App/docker-compose.yml) so the API and web services are closer to stateless runtime expectations:

- config is injected by env vars instead of hard-coded values
- API and web both have healthchecks
- web waits for a healthy API container
- state remains in Postgres, not inside the app containers

This aligns with a future Kubernetes deployment model:

- immutable container images
- externalized config/secrets
- horizontal scaling for API/web
- Prometheus scraping per replica

### 5. CI baseline

Updated [.github/workflows/ci.yml](/C:/Users/alesz/Projects_Apps/Capris-App/.github/workflows/ci.yml):

- adds concurrency cancellation
- provisions PostgreSQL in CI
- injects required backend secrets as CI env vars
- validates Prisma schema
- pushes schema to the CI database
- runs workspace typecheck and tests
- builds shared, API, and web artifacts

## Stack and tradeoff note

For metrics, this pass uses a custom lightweight Prometheus renderer instead of bringing in another dependency immediately.

Tradeoffs:

- Pros:
  - no new package install needed
  - easy to understand and test
  - keeps the API stateless
- Cons:
  - fewer built-in metrics than a dedicated instrumentation library
  - process-local aggregation only
  - no histogram buckets yet

Recommended next step:

- keep this baseline now
- later decide whether to move to a dedicated OpenTelemetry/Prometheus instrumentation layer once request volume and SRE dashboards are clearer

## Manual validation checklist

### API

1. `GET /api/v1/system-health`
2. `GET /api/v1/system-health/liveness`
3. `GET /api/v1/system-health/readiness`
4. confirm readiness returns `503` if the database is intentionally unavailable
5. `GET /api/v1/metrics`
6. if `METRICS_BEARER_TOKEN` is set, confirm unauthenticated scrapes are rejected

### Web

1. `GET /api/health`
2. `GET /api/readiness`
3. confirm readiness returns `503` when `NEXT_PUBLIC_API_BASE_URL` is missing

### Containers

1. `docker compose up --build`
2. confirm `postgres`, `api`, and `web` become healthy
3. confirm API container remains stateless across restart
4. confirm web container remains stateless across restart
