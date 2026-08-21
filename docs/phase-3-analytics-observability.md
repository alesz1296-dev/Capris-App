# Phase 3 Analytics And Observability Split

Date: August 21, 2026

Phase 3 separates business performance tracking from developer/SRE observability.

## Goals

- Give admins and supervisor/auditors two ways to track field-user work:
  - live performance dashboard
  - historical scorecards using date/filter windows
- Keep field-user performance analytics hidden from field users.
- Keep application/runtime observability separated from business dashboards.
- Give developer/SRE users a protected app-observability surface without granting business-planning access.

## First implementation pass

Added business performance contracts:

- `PerformanceDashboardResponse`
- `FieldUserPerformanceScorecard`
- `TaskStatusCount`

Added developer/SRE observability contract:

- `AppObservabilityResponse`

Added explicit permissions:

- `performance.view`
- `performance.export`
- `observability.view`

Role split:

- `admin`: business performance and app observability
- `supervisor_auditor`: business performance only
- `developer_sre`: app observability only
- `field_user`: neither cross-user performance analytics nor app observability

Backend endpoints:

- `GET /api/v1/performance/dashboard`
- `GET /api/v1/performance/scorecards`
- `GET /api/v1/system-health/observability`

Task status alignment:

- added `cancelled`
- added `rescheduled`

## Remaining Phase 3 work

- Add frontend pages for business performance analytics.
- Add frontend page for developer/SRE app observability.
- Add CSV export for performance scorecards if separate from existing reports.
- Add richer scorecard windows:
  - week
  - month
  - custom range
- Add trend comparisons once enough historical task data exists.
- Decide whether admin app-observability access should remain always-on or become an explicit break-glass permission path.

