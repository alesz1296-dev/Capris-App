# Local-first validation

Use this before any cloud deployment work. The goal is to prove the full app stack locally with PostgreSQL, the API, the web app, and S3-compatible object storage.

## Local services

Docker Compose provides:

- PostgreSQL on `localhost:5432` by default.
- MinIO S3-compatible object storage on `localhost:9000`.
- MinIO console on `localhost:9001`.
- API on `localhost:4000` when running the API container.
- Web/PWA on `localhost:3000` when running the web container.

## Local S3-compatible storage

MinIO is used locally so evidence uploads exercise the same S3 code path that will be used in AWS.

Default local values:

```env
OBJECT_STORAGE_DRIVER_DOCKER=s3
S3_BUCKET=capris-local
S3_REGION=us-east-1
S3_ENDPOINT_DOCKER=http://minio:9000
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=capris_local_minio
S3_SECRET_ACCESS_KEY=<set in local .env>
MINIO_ROOT_USER=capris_local_minio
MINIO_ROOT_PASSWORD=<set in local .env>
```

The `minio-create-bucket` Compose service creates the bucket automatically.

## Start local dependencies only

For normal host-local development:

```bash
docker compose up -d postgres minio minio-create-bucket
npm run dev:api
npm run dev:web
```

Useful URLs:

```text
Web: http://localhost:3000
API readiness: http://localhost:4000/api/v1/system-health/readiness
MinIO console: http://localhost:9001
```

## Start the full container stack

For container sanity testing:

```bash
docker compose up --build
```

## Validation checklist

1. Confirm services:

   ```bash
   docker compose ps
   ```

2. Confirm API readiness:

   ```bash
   curl http://localhost:4000/api/v1/system-health/readiness
   ```

3. Confirm web readiness:

   ```bash
   curl http://localhost:3000/api/readiness
   ```

4. Log in as an admin or supervisor/auditor.

5. Create or open a field task.

6. Upload evidence.

7. Confirm the stored evidence path uses the API storage route:

   ```text
   /api/v1/storage/s3/<encoded-key>
   ```

8. Open MinIO console and confirm objects exist under the `capris-local` bucket.

9. Open the Performance page and confirm evidence counts update for the relevant field user/date filters.

10. Open Observability as admin or developer/SRE and confirm failed upload counters remain healthy.

## Notes

- For local host-only development, `OBJECT_STORAGE_DRIVER=local` remains a valid fallback.
- For Docker Compose validation, the API container defaults to `OBJECT_STORAGE_DRIVER_DOCKER=s3`.
- AWS production should use `OBJECT_STORAGE_DRIVER=s3` with IAM role credentials when possible.
