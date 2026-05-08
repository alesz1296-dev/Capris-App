# Capris App

Bilingual field operations platform for Costa Rica.

This repository is structured as a TypeScript monorepo with:

- `apps/api`: NestJS backend/API scaffold
- `apps/web`: Next.js admin/supervisor web app scaffold
- `apps/mobile`: Expo React Native field app scaffold
- `packages/shared`: shared domain types, enums, permissions, workflow rules, sync states, and i18n resources

Private architecture notes and role guides live in `docs/` and `guides/`. Those folders are intentionally ignored by Git.

The private docs are the source of truth for implementation decisions. Feature work should follow the documented session plan, architecture notes, testing strategy, and security guidance.

Implementation is tracked in two layers:

- `docs/implementation-roadmap.md`: phase-level delivery plan
- `docs/implementation-sessions.md`: session-by-session execution plan for building the product incrementally
- `docs/log.md`: private implementation logbook by day and session
- `docs/production-readiness.md`: private rollout and pilot-readiness checklist
- `docs/priorities.md`: adversarial review priorities and risk backlog

## Planned Stack

- Mobile: React Native + Expo
- Web: Next.js
- API: NestJS
- Database: PostgreSQL
- Mobile offline store: SQLite
- Storage: S3-compatible object storage
- Maps: Mapbox
- Notifications: Firebase Cloud Messaging
- Email: Postmark or SendGrid

## Local Development

Install dependencies from the repository root once package installation is available:

```bash
npm install
```

Run individual apps:

```bash
npm run dev:web
npm run dev:api
npm run dev:mobile
```

## Working Style

The project is intentionally organized so we can implement it in visible sessions. Each session should produce a small, testable slice of the platform instead of a large opaque batch of changes.

## Validation Rule

The working local validation rule is:

- Every meaningful code slice: run `npm.cmd run typecheck` and `npm.cmd test`.
- Every frontend or shared-contract change: run `npm.cmd --workspace apps/web run build`.
- Every schema change: run `npm.cmd --workspace apps/api run db:push`.
- Every workflow milestone: run the relevant app in `dev` mode for manual validation of the affected flow.
- Before commits: run the full local verification set for the slices touched by the change.

## Spec-Driven Rule

This project follows spec-driven development.

- The private markdown docs in `docs/` and `guides/` are the implementation source of truth.
- Features should move in this order whenever practical:
  spec, shared contract, validation, API/UI implementation, tests, doc update.
- Behavior should not be invented ad hoc in app code when the relevant private spec is missing or unclear.
- When implementation intentionally changes behavior, the relevant private docs should be updated in the same work session.
