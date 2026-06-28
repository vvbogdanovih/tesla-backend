# CLAUDE.md

Guidance for Claude Code when working in **tesla-backend** — спільний API для tesla-frontend і tesla-admin.

## Commands

```bash
yarn start:dev            # dev із hot-reload (порт із .env, локально 4040)
yarn build               # nest build
yarn lint / yarn format  # ESLint --fix / Prettier
yarn test                # unit (jest)
yarn test:e2e            # e2e — піднімає Postgres у Docker (Testcontainers); потрібен Docker
yarn prisma:generate     # згенерувати Prisma Client
yarn prisma migrate dev --name <n>   # створити+застосувати міграцію
yarn prisma db seed      # сид (довідник авто + категорії)
# Створити користувача з роллю:
npx ts-node -r tsconfig-paths/register scripts/create-user.ts <email> <password> [user|admin|superadmin]
```

## Architecture

NestJS · **Prisma 7** (driver adapter `@prisma/adapter-pg`) · PostgreSQL · S3/R2.
Глобальний префікс **`/api`**, Swagger на **`/swagger`**, pino-логи, `ValidationPipe` (whitelist), `BigInt→JSON` поліфіл у `main.ts`.

```
prisma.config.ts                 # Prisma 7 config (schema/migrations/seed paths)
src/
├── main.ts · app.module.ts
├── common/
│   ├── constants/   env.constant.ts (zod) · endpoints.constant.ts · index.ts
│   ├── decorators/  roles · current-user
│   ├── guards/      jwt-auth · roles · optional-jwt-auth
│   ├── strategies/  jwt.strategy.ts (cookie ACCESS_TOKEN_NAME)
│   ├── types/       jwt-payload
│   └── rich-text/   richTextToHtml (TipTap JSON → санітизований HTML)
├── database/prisma/ schemas/schema.prisma · migrations/ · prisma.service(+adapter) · prisma.module · prisma.filter · seed
└── modules/         health · auth · s3 · (далі: catalog, cars, categories, orders, leads, …)
```

Потік: `Controller → Service → Prisma`. Канонічні доки — у `tesla-meta/docs` (db-schema, backend-architecture, ADR).

## Key patterns

- **ENV — zod** у `src/common/constants/env.constant.ts` (усі змінні декларувати там; порожні `KEY=` → undefined). Required: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRATION`(сек), `ACCESS_TOKEN_NAME`, `REFRESH_JWT_SECRET`, `REFRESH_JWT_EXPIRATION`, `REFRESH_TOKEN_NAME`, `PASSWORD_PEPPER`(16+), `PAYMENT_ENC_KEY`(16+, шифрування секретів реквізитів), `FRONTEND_URL`, `ADMIN_URL`, `PORT`(4040). S3/R2 — опційні `AWS_*`.
- **Auth** — JWT access+refresh у **httpOnly cookie**, argon2 + `PASSWORD_PEPPER`, ролі **user/admin/superadmin**. Захист: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin','superadmin')`. Refresh — stateless (верифікація підпису).
- **S3/R2** — `S3Service` (один клієнт; R2 = `AWS_S3_ENDPOINT` + `AWS_S3_FORCE_PATH_STYLE=true`; AWS = лишити порожніми). Presign — лише admin.
- **Rich text (ADR-0006)** — зберігаємо `*_json` (TipTap, джерело правди) + `*_html` (згенерований `richTextToHtml`, санітизований). Набір extensions (StarterKit) має збігатися з адмінкою. Для Node — `@tiptap/html/server` (+ happy-dom).
- **Сумісність товарів (ADR-0002)** — товар ↔ авто через `ProductFitment` (M2M); `Category` — глобальна таксономія.

## Conventions

Prettier: **tabs, без `;`, одинарні лапки, printWidth 100**. Типи в декорованих сигнатурах — через `import type` (isolatedModules). Міграції комітити. `.env`/`.env.*` — поза git (крім `.env.example`).
