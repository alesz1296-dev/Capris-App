# Frontend Phase 1 Impact

Last updated: 2026-08-20

## Purpose

This document identifies the frontend areas that will need rework as the backend moves from the current Capris model to the new product specification.

This is not the full frontend implementation plan. It is the Phase 1 impact map so we know what will break, what will need translation updates, and which UI surfaces depend on backend contracts that are about to change.

## New specification impact areas

The new specification changes these backend-facing concepts:

- Geography expands from province and zone to:
  - Province
  - Canton
  - District
  - Zone
- Tasks must support:
  - Client
  - Area/location hierarchy
  - Activity
  - Objective
  - Date
- Task statuses change to:
  - `pending`
  - `completed`
  - `cancelled`
  - `rescheduled`
- Evidence expands from photo-first behavior to photo and document support
- Reports and dashboards need weekly/monthly filtering and agent-based reporting
- Role names and permission labels will change in the RBAC pass
- Bilingual support must remain complete in both English and Spanish

## Frontend screens with direct contract impact

### High impact

- [apps/web/app/task-admin.tsx](C:/Users/alesz/Projects_Apps/Capris-App/apps/web/app/task-admin.tsx:26)
  - Assumes task scope is primarily `provinceId` and `zoneId`
  - Assumes current task status flow from the old shared enum
  - Does not support `objective`
  - Does not support canton/district selectors
  - Status actions are built around the old transition model

- [apps/web/app/agenda-admin.tsx](C:/Users/alesz/Projects_Apps/Capris-App/apps/web/app/agenda-admin.tsx:108)
  - Quick task creation depends on province/zone filters
  - Calendar summaries and request forms reference the old location scope
  - Task and evidence grouping logic will need updated labels and filters

- [apps/web/app/catalog-admin.tsx](C:/Users/alesz/Projects_Apps/Capris-App/apps/web/app/catalog-admin.tsx:81)
  - Current catalog UI supports provinces and zones
  - Needs expansion for canton and district management
  - Point-of-sale creation currently depends on the old geography shape

- [apps/web/app/visit-admin.tsx](C:/Users/alesz/Projects_Apps/Capris-App/apps/web/app/visit-admin.tsx:133)
  - Visit display inherits task province/zone assumptions
  - Task-linked location display will need canton/district support

### Medium impact

- [apps/web/app/activities-admin.tsx](C:/Users/alesz/Projects_Apps/Capris-App/apps/web/app/activities-admin.tsx:74)
  - Evidence and activity views depend on current task/evidence bootstrap payloads
  - Any `TaskEvidence` contract change will affect this screen

- [apps/web/app/supervisor-route-workspace.tsx](C:/Users/alesz/Projects_Apps/Capris-App/apps/web/app/supervisor-route-workspace.tsx:52)
  - Uses province/zone routing assumptions
  - Will need updated naming once `supervisor_auditor` replaces the old role model

- [apps/web/app/app-shell.tsx](C:/Users/alesz/Projects_Apps/Capris-App/apps/web/app/app-shell.tsx:35)
  - Navigation and role display text will need updates for the new role model and bilingual labels

## Shared frontend contract risks

The frontend currently depends on shared enums and types for:

- Task statuses
- Role labels
- Catalog entities
- Evidence types
- Report filters

Expected contract changes:

- Task status enum will change
- Role enum will change
- Geography entities will expand
- Task shape will expand with `objective`, and likely new lifecycle fields
- Evidence contracts will likely move from `EvidencePhoto` language toward a more generic task evidence model

## Bilingual rework areas

The frontend must be rechecked for bilingual support after backend contract changes.

At minimum, update and verify:

- Task status labels
- Role labels
- Geography labels:
  - Province
  - Canton
  - District
  - Zone
- Dashboard headings
- Report filter labels
- Evidence upload labels
- Validation and error messages
- New workflow actions:
  - Cancel
  - Reschedule
  - Add objective
  - Upload document

## Recommended frontend sequence after backend Phase 2 and Phase 3

1. Update shared contracts and translation keys.
2. Update task creation and task list flows.
3. Update catalog management for new geography entities.
4. Update visit and evidence flows.
5. Update dashboard and reports UI.
6. Recheck role-based navigation and visibility.
7. Run bilingual QA in English and Spanish.

## Manual validation targets once frontend rework begins

- Create task with client, province, canton, district, zone, activity, objective, and date
- Change task state to:
  - Completed
  - Cancelled
  - Rescheduled
- Upload:
  - Photo evidence
  - Document evidence
- Filter reports by:
  - Agent
  - Province
  - Canton
  - District
  - Zone
  - Date range
- Switch locale between English and Spanish on every updated screen
