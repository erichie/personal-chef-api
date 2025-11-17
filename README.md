## Personal Chef Web

This Next.js app mirrors the BetterAuth-powered mobile experience so cooks can:

- Sign in with the same BetterAuth credentials (including anonymous-to-email migrations).
- Author recipes from the browser and optionally publish them.
- Share public recipe URLs that render SEO-friendly pages.

## Environment

Create a `.env` if you have not already and add:

```
DATABASE_URL="postgres://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000/api/auth"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000/api/auth"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`NEXT_PUBLIC_APP_URL` is used for server-side fetches when constructing share URLs.

## Database

Run migrations whenever the Prisma schema changes:

```
npm install
npm run db:generate
# or
pnpm install
pnpm db:generate
```

Migrations live in `prisma/migrations`. Apply them to your dev database with `npx prisma migrate dev`.

## Development

```
npm run dev
```

Key routes:

- `/login` – BetterAuth email/password sign-up & sign-in UI.
- `/` – Authenticated dashboard with discovery feed.
- `/recipes` – Manage personal recipes, publish/unpublish, copy share links.
- `/recipes/new` – Create recipes directly from the browser.
- `/cookbook` – Manage your public cookbook profile and drafts.
- `/cookbook/[slug]` – Public cookbook page (mini food blog).
- `/recipes/[slug]` – Public recipe page.

API additions:

- `POST /api/recipes` now accepts `publish`, `slug`, `excerpt`, `shareImageUrl`, `seoTitle`, `seoDescription`.
- `GET /api/recipes/mine`
- `POST/DELETE /api/recipes/[id]/publish`
- `GET /api/public/recipes/[slug]`
- `GET/PATCH /api/me/cookbook`
- `GET /api/public/cookbooks/[slug]`

After logging in via the web, cookies are set by BetterAuth so API requests from the browser automatically include the correct session.
