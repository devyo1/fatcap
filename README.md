# fatcap.club

Landing page plus an invite-only members forum. Next.js on Vercel, Postgres on Neon.

## How invites work

- **Stickers:** the admin panel makes batches of one-time codes and a printable QR sheet. Each QR opens `fatcap.club/i/<code>`; the first person to use it picks a username and password, and the code is dead after that. Lost a sticker? Revoke its code on the sheet.
- **Members:** everyone who joins gets one invite of their own (link + QR on their profile). It also works once.
- **Invite tree:** the admin panel shows who brought in whom, and which sticker batch each chain started from.
- **The sticker:** every invite (yours on the **Invite** tab, and every code on an admin sheet) is a branded sticker: the wordmark, a dotted QR with the brand dot in the middle, and the code. Pick the dot color and black or bone paper, then download a PNG or a print-ready SVG. The type is outlined (`lib/glyphs.ts`), so the files need no fonts. The QR uses the highest error correction, so it scans even when small or scuffed.

## Images and GIFs

Members can attach images and GIFs to threads, comments, DMs and chat (button or paste). Every upload is re-encoded to WebP on the server, which strips EXIF/GPS and all other metadata; nothing about the original file or the uploader's IP is kept. Images are served only to signed-in members, and links to images hosted elsewhere stay plain links so nobody's IP leaks to outside servers.

They don't pile up: pictures in a thread's opening post last as long as the thread (or until it vanishes); comment and DM images expire after `MEDIA_DAYS`; chat pictures go with the chat wipe; once the total passes `MEDIA_MAX_MB` the oldest go first (comment and DM images before thread ones); deleting a post deletes its images. The images are stored in Postgres, so there's no extra service to set up.

## Forum

- **Tree:** General, Travel, Lifestyle and Market, three sub-forums each, defined in `lib/config.ts` (rename or reorder there, no migration needed). New threads pick a sub-forum. Threads from before sub-forums existed show under their board's "All" until moved (admins: **Move** in the thread's menu; authors: **Edit**).
- **Feed:** the forum home ranks threads by engagement (comments, likes, how many people joined in, pictures) over time since the last comment, with a lift for threads you haven't opened. **Recent** and **Top** (last 30 days) are one tap away; boards sort by Recent / New / Top. Rows show the opening lines and the first picture. While a page is open, a pill appears when there are new threads (feed) or new comments (thread); tap it to load them.
- **Tags:** `#anything` in a post becomes a link to every thread using it; the forum home lists the most used ones from the last 60 days.
- **List, Cards or Grid:** the switch at the top of the forum and every board, remembered per device. Nothing about how the forum works changes, only how threads are shown.
  - **List** is the classic forum.
  - **Cards** shows each thread as a print: every post gets the same square plate (its photos cropped to the square, swipe through them, tap to see one whole; a post without photos shows its opening line as a pull quote), with a figure caption, the title, a few lines, the byline and the usual actions (like, comments, follow, save, share). Double tap a plate to like. On wide screens the plates alternate sides.
  - **Grid** is a wall of square tiles, three across: a post's first photo, or the post as a poster with its title set big.
- **Likes, follows and saves** change on the spot, without reloading the page or moving it.
- **Browsing:** the feed, boards and Market keep loading as you scroll (past 150 rows it waits for a tap). Going into a thread and coming back keeps your place, with everything that had loaded. A thread ends with more from the same sub-forum.
- **Pictures in posts** hold their space while they load (nothing jumps while you scroll), and phones get a copy sized for the screen. Animations always get the original; the full picture opens in the viewer.
- **Vanishing threads:** a thread can delete itself after 24 hours, 7 days or 30 days, taking every comment, like, alert and picture with it.
- **Follow / Save:** you follow threads you start or comment in, and get one alert per thread that updates as comments come in. Unfollow from the thread. Saved threads are private, under the avatar menu.
- **Reports:** members report a thread or comment (spam, harassment, personal info, other); admins get an alert and work through them under Admin -> Reports.
- **Block:** from a member's profile (the `...` menu). Their threads, comments and chat messages are hidden from you, they can't message you, deal with you or alert you, and you can't message them. Undo from the profile or Settings -> Blocked.
- **Profile pictures:** Settings -> Picture. Cropped square and re-encoded, with location and camera data removed. **Use generated** goes back to the pixel mark.
- Also: quote (select text first to quote part of a post), @mention suggestions while typing, collapsible reply trees, a full-screen image viewer, "new since your last visit" markers.
- **Writing:** opening posts take up to 40,000 characters (comments 10,000), the box grows as you write, and **Preview** shows the post as it will look. Formatting: `## heading`, `**bold**`, `*italic*`, `> quote`, `- list`, `1. list`, `---` section break, @mentions, links. Images land where the cursor is; text after an image on the same line becomes its caption.
- **GIFs:** a GIF button on posts, comments, DMs and chat, searching GIPHY through our server: members' devices never contact GIPHY, and a picked GIF is downloaded, re-encoded and stored like any upload. Needs `GIPHY_API_KEY`.

## Market

Members sell and trade with each other; no money moves through the site. Everything is a handshake the site keeps track of.

- **Listings** sell at a **fixed price** (optionally taking offers too), by **offers**, or by **auction**, with stock for things like a zine run, shipping and/or meetup (an area, never an address), and "open to trades". **Wanted** posts carry a budget instead.
- **Deals:** buying, an accepted offer, or winning an auction opens a deal. Shipped: buyer marks paid, seller confirms, seller marks shipped, buyer marks received. Meetup: buyer marks paid, seller confirms. Either side can cancel early (the seller with a reason). Both leave feedback at the end.
- **Browsing the Market:** categories as chips (with counts), listings photo-first with the price up top, **Sell** always at hand. A listing opens on its photos (swipe through, tap to enlarge; zines open in the page-turner), with the buy box (price, Buy / Offer / Bid, Message) right next to them.
- **Your market** (avatar menu -> Market, or Your market on any Market page): **Buying** (deals on their way to you, your offers and bids), **Selling** (offers to answer, deals to send, your listings and stock) and **History**. Whatever needs you sits at the top of its tab, with a count on the tab. Each profile shows the member's record (deals, good/bad feedback, unpaid wins), what they're selling, and recent feedback.
- When something needs you (your step in a deal, or an offer to answer), one line at the top of the Market says so and takes you there.
- **Auctions** can't check anyone's funds, so they run on track record: bids are binding, a bid in the last 2 minutes adds 2 minutes, sellers can require bidders to have 1+, 3+ or 5+ completed deals, a winner who doesn't pay gets an "unpaid" mark, and the seller can offer the item to the next bidder. Bidders stay anonymous to each other; the seller sees names.
- **Zines** with sample pages (listed in Market / Zines with two or more pictures) open in a page-turning viewer: spreads on wide screens, single pages on phones, swipe, keys, full screen.

## Admins

Admin tools (pin, lock, move, delete anything, the Admin pages) show only for admins. **Admin view** in the avatar menu switches them off on that device, to browse like any member; switch it back on there.

## Privacy and safety

- Every page is marked noindex/noarchive, can't be embedded in another site, and doesn't pass the thread URL to outside sites you click through to. Location, camera and microphone are switched off for the site.
- After 8 wrong passwords for one username in 15 minutes, that username is paused for 15 minutes. Only the username is recorded, never an IP.
- Unsent posts are kept as drafts on the device (so an error or a misclick doesn't eat your text) and wiped on log out.

## Home-screen app

The site ships a web app manifest, so "Add to Home Screen" on iPhone/Android gives a full-screen app that stays inside the site and opens on the forum. Pull down from the top of any page to refresh. If you added the shortcut before this existed, delete it and add it again.

On phones a tab bar sits at the bottom: Forum, Chat, **+** (new thread or listing where you are, or jumps to the reply box in a thread or chat), Market (dot when something's waiting on you) and your profile. It tucks away while you type, and tapping the tab you're on goes back to the top. The header slides away while you scroll down and comes back when you scroll up; below the top level it has a back arrow. "⋯" menus open as sheets from the bottom, a conversation gets the whole screen with the message box docked at the bottom, and a thin line along the top shows a page or an action is on its way (the page you're on stays put until the next one is ready).

## Environment variables (Vercel → Settings → Environment Variables)

| Name | What |
| --- | --- |
| `DATABASE_URL` | Neon connection string (pooled). The only one you need. |
| `SETUP_TOKEN` | Optional. Any long random string, used once at `/setup` to create the first admin. |
| `NEXT_PUBLIC_CITY` | Optional tag stored on new threads (default `global`), kept for future city categories. |
| `CHAT_WIPE_HOURS` | Optional. How often the live chat wipes itself (default `24`, resets around 1am Montreal time). |
| `NEXT_PUBLIC_SITE_URL` | Optional. Defaults to `https://fatcap.club` (QR codes point here). |
| `MEDIA_DAYS` | Optional. How long comment and DM images last (default `30`). Opening-post images last as long as their thread; chat images go with the chat wipe. |
| `MEDIA_MAX_MB` | Optional. Total image storage cap (default `200`); past it, the oldest images are dropped. |
| `GIPHY_API_KEY` | Optional. Turns on GIF search. Free key at developers.giphy.com (create an API app; the starter key is rate-limited, apply for a production key when you outgrow it). |
| `GIPHY_RATING` | Optional. GIF content rating: `g`, `pg`, `pg-13` (default) or `r`. |

Tables are created automatically on every build (`scripts/migrate.mjs`, safe to re-run).

## First admin

After the first deploy with the variables set, open `https://fatcap.club/setup?token=<SETUP_TOKEN>` and create your account. That page only works while there are no members.

## Making an account by hand

```bash
node scripts/create-user.mjs <username> <password> [--admin]
```

Uses `DATABASE_URL` (or `LOCAL_DB`). If the username exists, it resets the password.

## Mock content

Admin -> Overview -> **Add mock content** (or `node scripts/seed-mock.mjs` locally) adds flagged mock members (some with profile pictures) with threads in every sub-forum, comments, likes, and Market listings with generated covers and zine sample pages, offers, an auction and finished deals, so the forum doesn't look empty. Running it again only fills in what's missing. Mock members can't log in. Remove it all from Admin -> Overview -> Remove all mock content.

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
- `app/i/[code]`: invite redemption. `app/setup`: first admin. `app/(members)/invite`: your sticker.
- `lib/sticker.ts`: the sticker SVG. `lib/media.ts` + `lib/media-store.ts`: image storage and processing.
- `app/actions.ts`: every form action. `lib/`: database, auth, invites.
- Drop a `public/teaser.jpg` to replace the generated cover in the landing page's `[ 001 ]` panel.
