# MVP Happy Path QA

This document tracks the current end-to-end MVP smoke validation for the Capris field operations workflow.

## Automated smoke command

Run against the default local API:

```bash
npm run qa:mvp:happy-path
```

Run against a specific API instance:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:4100/api/v1"
npm run qa:mvp:happy-path
```

## Covered workflow

The smoke test validates:

1. API readiness is healthy.
2. Admin, supervisor/auditor, developer/SRE, and field-user QA accounts can log in.
3. Developer/SRE can access operational health details.
4. Admin task bootstrap includes MVP catalog data:
   - users
   - all 7 Costa Rica provinces
   - cantons
   - districts
   - clients
   - points of sale
   - activity types
   - task types
5. Admin creates an assignment with:
   - field user
   - client/store
   - province/canton/district
   - activity
   - objective
   - date
6. Field user can see the assigned task.
7. Field user uploads evidence.
8. Field user marks the task `in_progress`.
9. Admin sees the updated status.
10. Supervisor/auditor can access the business performance dashboard.
11. Admin can export the task report CSV.

## Latest local QA result

Passed against:

```text
http://localhost:4100/api/v1
```

That instance used:

- current source build
- separate non-destructive database: `capris_mvp_qa`
- MVP seed data with 7 provinces, 15 representative cantons, and 113 representative districts

## Important caveat

The existing Docker API on `http://localhost:4000/api/v1` may still reflect an older container/database state until the API image is rebuilt and the primary local database is migrated.

If `npm run qa:mvp:happy-path` fails on port `4000` with missing `cantons` or `districts`, rebuild/restart the API and apply the current Prisma schema.

The primary local DB still has legacy GPS columns. Dropping them requires an explicit local migration decision because Prisma treats that as data loss.

## Manual browser checks still required

After the API smoke test passes, validate in the browser:

1. Login page styling loads correctly.
2. Navigation between pages works.
3. Admin/supervisor can create a task from the simplified assignment UI.
4. Province → canton → district selectors are understandable.
5. Field user can find the task without training.
6. Field user can upload both image and document evidence.
7. Status options are visible:
   - `pending`
   - `in_progress`
   - `completed`
   - `cancelled`
   - `rescheduled`
8. Dashboard/report numbers update after the task change.
9. English/Spanish copy is clean on the main flow.
