# LOVE.exe — two-player couples game

A mobile-first, real-time couples game. Each player opens the same website on their own phone, joins with a private 6-character room code, answers the same questions, and unlocks the next question/level together. Room progress and answers are saved in Supabase.

## What is included

- `index.html` — app layout
- `style.css` — responsive dark pink/purple design
- `app.js` — game logic and Supabase client integration
- `supabase.sql` — database, room RPC functions, access rules, and realtime setup

## Free setup (about 15–25 minutes)

### 1. Create the backend

1. Open [Supabase](https://supabase.com/) and create a free project.
2. In the project dashboard, open **SQL Editor** → **New query**.
3. Paste all of `supabase.sql` and run it.
4. Open **Authentication → Sign In / Providers** (the exact menu wording may vary) and enable **Anonymous Sign-Ins**. LOVE.exe uses anonymous accounts so players do not need to register with email.
5. Open **Project Settings → API** (or **Data API**) and copy the **Project URL** and the **publishable/anon key**. Use only the public anon/publishable key in this browser app. **Never put a `service_role` or secret key in frontend code.**

### 2. Connect the website to Supabase

Open `app.js` and replace the first two values:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Use your own project URL and public anon/publishable key. Save the file.

### 3. Test it locally

The page uses a CDN script and Google Fonts, so internet access is needed. Open `index.html` in a browser. If your browser blocks local file scripts, use VS Code's **Live Server** extension and choose **Open with Live Server**.

Test with two browsers or two phones:

1. On Phone A, enter a name and tap **Create a room**.
2. Send the 6-character code to Phone B.
3. On Phone B, enter a name and that code, then tap **Join**.
4. Both players answer. Player 1 advances after both answers are in.

### 4. Free hosting with Netlify (recommended)

1. Create/sign in at [GitHub](https://github.com/) and make a new repository, e.g. `love-exe`.
2. Upload `index.html`, `style.css`, and `app.js` to the repository root. (Keep `supabase.sql` and `README.md` there too if you want them with the source.)
3. Create/sign in at [Netlify](https://www.netlify.com/), choose **Add new site → Import an existing project**, connect GitHub, and select the repository.
4. Build command: leave blank. Publish directory: `.` (the repository root).
5. Deploy. Netlify gives you a public `https://...netlify.app` address to share.

Alternative: use GitHub Pages by enabling Pages for the repository and selecting the branch/root. Netlify is usually the easiest option for this static app.

## Security and privacy notes

- The browser only contains Supabase's public anon/publishable key; the SQL functions validate room membership before changing state.
- Row-level security limits direct room reads to the two room members. The room code is a join code, so share it only with the intended player.
- Both players in a room can read the saved answers for that room. Do not use this app for highly sensitive information.
- Anonymous accounts are browser/device-specific. If a player clears browser data or switches browsers, they may lose access to that anonymous identity and therefore their room. This first version does not include account recovery.
- Free-tier limits and provider dashboard labels can change. Review the current Supabase and Netlify free-plan terms before publishing widely.

## Troubleshooting

- **“Add your Supabase URL…”**: edit the two constants in `app.js` and redeploy.
- **Anonymous sign-in fails**: enable Anonymous Sign-Ins in Supabase Auth.
- **Room updates do not sync**: check that `love_rooms` was added to `supabase_realtime` by running the SQL setup, and confirm Realtime is available/enabled for the project.
- **“Room already has two players”**: each room is designed for exactly two players. Create another room for a new session.
- **Room code is not found**: check the 6-character code; codes use letters/numbers and omit confusing characters such as I, O, 0, and 1 in newly created rooms.

## Known v1.0 behavior

- Five levels, ten questions per level.
- Player 1 controls advancing the shared question after both players answer.
- Answers are stored permanently in the room row until the project owner removes the room/database data.
- The “Home” button returns to the start screen but does not delete the room.
