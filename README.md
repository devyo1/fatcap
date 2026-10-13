# fatcap.club

Landing page plus an invite-only members forum. Next.js on Vercel, Postgres on Neon.

## How invites work

- **Stickers:** the admin panel makes batches of one-time codes and a printable QR sheet. Each QR opens `fatcap.club/i/<code>`; the first person to use it picks a username and password, and the code is dead after that. Lost a sticker? Revoke its code on the sheet.
- **Members:** everyone who joins gets one invite of their own (link + QR on their profile). It also works once.
- **Invite tree:** the admin panel shows who brought in whom, and which sticker batch each chain started from.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | What |
| --- | --- |
| `DATABASE_URL` | Neon connection string (pooled). The only one you need. |
| `SETUP_TOKEN` | Optional. Any long random string, used once at `/setup` to create the first admin. |
| `NEXT_PUBLIC_CITY` | Optional tag stored on new threads (default `global`), kept for future city categories. |
| `CHAT_WIPE_HOURS` | Optional. How often the live chat wipes itself (default `24`, resets around 1am Montreal time). |
| `NEXT_PUBLIC_SITE_URL` | Optional. Defaults to `https://fatcap.club` (QR codes point here). |

Tables are created automatically on every build (`scripts/migrate.mjs`, safe to re-run).

## First admin

After the first deploy with the variables set, open `https://fatcap.club/setup?token=<SETUP_TOKEN>` and create your account. That page only works while there are no members.

## Making an account by hand

```bash
node scripts/create-user.mjs <username> <password> [--admin]
```

Uses `DATABASE_URL` (or `LOCAL_DB`). If the username exists, it resets the password.

## Mock content

```bash
node scripts/seed-mock.mjs
```

Adds six flagged mock members with threads, comments and likes so the forum doesn't look empty. Remove it all from Admin -> Overview -> Remove all mock content.

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
