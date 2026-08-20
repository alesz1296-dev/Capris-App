# Grafana and Prometheus Operations Notes

Date: August 20, 2026

This document describes the Phase 2 observability baseline for Capris.

## Endpoints

API:

- health: `/api/v1/system-health`
- liveness: `/api/v1/system-health/liveness`
- readiness: `/api/v1/system-health/readiness`
- metrics: `/api/v1/metrics`

Web:

- health: `/api/health`
- readiness: `/api/readiness`

## Prometheus scrape guidance

Recommended scrape target:

- scrape the API service, not the web service
- scrape every API replica independently
- keep scraping inside the cluster/private network

If `METRICS_BEARER_TOKEN` is enabled, inject it in the scrape config.

Example scrape job:

```yaml
scrape_configs:
  - job_name: capris-api
    metrics_path: /api/v1/metrics
    scheme: http
    static_configs:
      - targets:
          - capris-api.capris.svc.cluster.local:4000
    authorization:
      type: Bearer
      credentials: ${CAPRIS_METRICS_BEARER_TOKEN}
```

## Current metrics

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

## Grafana dashboard recommendations

### Row 1: Service health

- readiness status
- process uptime
- active sessions

### Row 2: Request health

- request rate from `capris_http_requests_total`
- error rate by status code
- average latency from:
  - `capris_http_request_duration_ms_sum`
  - `capris_http_request_duration_ms_count`

### Row 3: Workflow reliability

- failed uploads
- pending uploads
- failed emails
- report export failures

## Suggested PromQL

Request rate:

```promql
sum(rate(capris_http_requests_total[5m]))
```

5xx rate:

```promql
sum(rate(capris_http_requests_total{status_code=~"5.."}[5m]))
```

Average request latency in milliseconds:

```promql
sum(rate(capris_http_request_duration_ms_sum[5m]))
/
sum(rate(capris_http_request_duration_ms_count[5m]))
```

Failed uploads:

```promql
capris_failed_uploads_total
```

Pending uploads:

```promql
capris_pending_uploads_total
```

## Alert suggestions

- readiness failing for 5 minutes
- sustained 5xx traffic
- average latency above threshold
- failed uploads above threshold
- pending uploads growing over time
- failed emails above threshold
- metrics endpoint unavailable

## Security notes

- do not expose `/api/v1/metrics` publicly on the internet
- prefer cluster-internal scraping
- if external scraping is unavoidable, require `METRICS_BEARER_TOKEN`
- never include client names, emails, IDs, or file keys as metric labels
