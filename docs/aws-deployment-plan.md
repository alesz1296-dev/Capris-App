# AWS deployment plan

This replaces the previous PaaS deployment path.

## Recommended MVP AWS shape

- Web/PWA: containerized Next.js app on AWS App Runner or ECS Fargate.
- API: containerized NestJS API on AWS App Runner or ECS Fargate.
- Database: Amazon RDS for PostgreSQL.
- Evidence storage: Amazon S3 for uploaded photos and documents.
- Secrets: AWS Secrets Manager or SSM Parameter Store.
- Metrics: Prometheus-compatible `/api/v1/metrics` endpoint scraped by the chosen runtime or collector.
- Logs: CloudWatch Logs.
- DNS/TLS: Route 53 plus ACM-managed certificates.

## Why S3 is part of the plan

S3 is the right place for field evidence:

- photos
- documents
- thumbnails
- exported reports, if needed later

The API already has an S3-compatible object storage service. When S3 credentials are configured, uploaded evidence can be stored in S3 instead of the local filesystem.

S3 should not run the API. S3 can host static files, but the current web app is a Next.js app with server-side health/readiness routes and runtime API configuration. For the clean MVP, keep the web app as a container.

## S3 configuration

Required API environment variables:

```env
S3_BUCKET=<bucket-name>
S3_REGION=<aws-region>
OBJECT_STORAGE_DRIVER=s3
MEDIA_URL_SIGNING_SECRET=<long-random-secret>
```

Optional for S3-compatible local/dev providers or deployments without IAM role credentials:

```env
S3_ENDPOINT=<custom-s3-compatible-endpoint>
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-access-key>
```

For AWS production, prefer an IAM role attached to the runtime instead of long-lived access keys. With `OBJECT_STORAGE_DRIVER=s3`, the API uses the AWS SDK default credential chain when explicit access keys are not provided.

## Runtime environment variables

API:

```env
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<rds-host>:5432/capris_app?schema=public
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
MEDIA_URL_SIGNING_SECRET=<secret>
METRICS_BEARER_TOKEN=<optional-secret>
S3_BUCKET=<bucket-name>
S3_REGION=<aws-region>
OBJECT_STORAGE_DRIVER=s3
```

Web:

```env
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://<api-domain>/api/v1
CAPRIS_DEPLOYMENT_ID=<git-sha-or-release-id>
```

## Recommended AWS phases

### Phase AWS-1: storage and provider cleanup

- Remove previous provider-specific deployment files and runtime messages.
- Keep Docker images provider-neutral.
- Confirm S3 object storage works in staging.
- Document AWS environment variables.

### Phase AWS-2: AWS infrastructure baseline

- Create S3 bucket for evidence.
- Create RDS PostgreSQL database.
- Create Secrets Manager or SSM parameters for API secrets.
- Create IAM permissions for the API runtime to read/write S3 objects.
- Create CloudWatch log groups.

### Phase AWS-3: container runtime

- Deploy API container to App Runner or ECS Fargate.
- Deploy web container to App Runner or ECS Fargate.
- Configure health/readiness probes.
- Configure `NEXT_PUBLIC_API_BASE_URL` to the API domain.

### Phase AWS-4: observability

- Scrape `/api/v1/metrics`.
- Add Grafana dashboards for API health, request volume, request latency, failed uploads, failed emails, and report failures.
- Alert on readiness failures and failed evidence uploads.

## Tradeoff: App Runner vs ECS Fargate

App Runner is simpler for the MVP. It is a good fit if we want fast deployment and fewer moving parts.

ECS Fargate is more flexible. It is better if we expect private networking, custom load balancer behavior, sidecars, advanced scaling, or deeper Prometheus integration.

Recommendation: start with App Runner for web/API containers unless we already know we need ECS-level control.
