# Capris App

Bilingual field operations platform for Costa Rica.

This repository is structured as a TypeScript monorepo with:

- `apps/api`: NestJS backend/API scaffold
- `apps/web`: Next.js admin/supervisor web app scaffold
- `apps/mobile`: Expo React Native field app scaffold
- `packages/shared`: shared domain types, enums, permissions, workflow rules, sync states, and i18n resources

Private architecture notes and role guides live in `docs/` and `guides/`. Those folders are intentionally ignored by Git.

Implementation is tracked in two layers:

- `docs/implementation-roadmap.md`: phase-level delivery plan
- `docs/implementation-sessions.md`: session-by-session execution plan for building the product incrementally

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
