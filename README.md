## Personal Chef Web

This Next.js app mirrors the BetterAuth-powered mobile experience so cooks can:

- Sign in with the same BetterAuth credentials (including anonymous-to-email migrations).
- Author recipes from the browser and optionally publish them.
- Share public recipe URLs that render SEO-friendly pages.
- Organize cookbook sections (mini collections inside a cookbook) and share a searchable public cookbook page.

## Environment

Create a `.env` if you have not already and add:

```
DATABASE_URL="postgres://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000/api/auth"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000/api/auth"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
EXPO_ACCESS_TOKEN="" # Optional Expo push service access token
```

`NEXT_PUBLIC_APP_URL` is used for server-side fetches when constructing share URLs.
`BLOB_READ_WRITE_TOKEN` powers Vercel Blob client uploads for feed and recipe posts.
`EXPO_ACCESS_TOKEN` lets the backend send Expo push notifications using your project access token (leave blank to use the default unauthenticated client, which has lower throughput).

### Account deletion

Send an authenticated `DELETE` request to `/api/me` (BetterAuth bearer token or web session cookie). The backend removes the `User` row and cascades through every related record (posts, comments, likes, sessions, tokens, AI usage logs, etc.), so the action is irreversible.

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
- `/cookbook` – Manage your public cookbook profile, sections, and drafts.
- `/cookbook/[slug]` – Public cookbook page (searchable, sectioned view).
- `/recipes/[slug]` – Public recipe page.

API additions:

- `POST /api/recipes` now accepts `publish`, `slug`, `excerpt`, `shareImageUrl`, `seoTitle`, `seoDescription`.
- `GET /api/recipes/mine`
- `POST/DELETE /api/recipes/[id]/publish`
- `GET /api/public/recipes/[slug]`
- `GET/PATCH /api/me/cookbook`
- `DELETE /api/me` – authenticated users can permanently delete their account and all associated data
- `GET /api/public/cookbooks/[slug]`
- `GET/POST /api/cookbook/sections`
- `PATCH/DELETE /api/cookbook/sections/[sectionId]`
- `POST /api/cookbook/sections/[sectionId]/recipes` (add/remove assignments)

After logging in via the web, cookies are set by BetterAuth so API requests from the browser automatically include the correct session.

## Cookbook sections

- Create, rename, or delete sections from the `/cookbook` dashboard. Each section can hold any number of recipes.
- Assign/unassign recipes either from the cookbook sections panel or directly from `/recipes` via the section checkbox list.
- The shareable cookbook page automatically groups recipes by section and exposes a search box that scans section names, recipe titles, and descriptions.

## Testing

Run unit tests (currently covering cookbook section formatting logic):

```
npm run test
```
