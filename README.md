# fatcap.club

Landing page plus an invite-only members forum. Next.js on Vercel, Postgres on Neon.

## How invites work

- **Stickers:** the admin panel makes batches of one-time codes and a printable QR sheet. Each QR opens `fatcap.club/i/<code>`; the first person to use it picks a username and password, and the code is dead after that. Lost a sticker? Revoke its code on the sheet.
- **Members:** everyone who joins gets one invite of their own (link + QR on their profile). It also works once.
- **Invite tree:** the admin panel shows who brought in whom, and which sticker batch each chain started from.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | What |
| --- | --- |
| `DATABASE_URL` | Neon connection string (pooled). |
| `SETUP_TOKEN` | Any long random string. Used once to create the first admin. |
| `NEXT_PUBLIC_CITY` | The forum's city, e.g. `Toronto`. |
| `NEXT_PUBLIC_SITE_URL` | `https://fatcap.club` (QR codes point here). |

Tables are created automatically on every build (`scripts/migrate.mjs`, safe to re-run).

## First admin

After the first deploy with the variables set, open `https://fatcap.club/setup?token=<SETUP_TOKEN>` and create your account. That page only works while there are no members.

## Local development

```bash
npm install
LOCAL_DB=./.localdb SETUP_TOKEN=dev NEXT_PUBLIC_CITY=Toronto npm run migrate
LOCAL_DB=./.localdb SETUP_TOKEN=dev NEXT_PUBLIC_CITY=Toronto npm run dev
```

`LOCAL_DB` runs an in-process Postgres (PGlite) so you don't need Neon locally. Leave it unset to use `DATABASE_URL`.

## Where things are

- `public/landing.html`: the landing page (served at `/`). Its login box posts to `/api/login`.
- `app/(members)/`: forum, profiles, admin (all require a session).
- `app/i/[code]`: invite redemption. `app/setup`: first admin.
- `app/actions.ts`: every form action. `lib/`: database, auth, invites.
- Drop a `public/teaser.jpg` to replace the generated cover in the landing page's `[ 001 ]` panel.
