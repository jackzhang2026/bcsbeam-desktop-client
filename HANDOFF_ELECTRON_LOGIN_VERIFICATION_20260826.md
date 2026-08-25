# BCS Beam Desktop Client — Electron Login Verification Handoff (2026-08-26)

**For: whichever agent picks this up next — assume ZERO context from any
prior conversation. Read this file fully before running anything.**

**The one task this handoff is for:** run the login flow implemented in
this repo in a _real_ Electron window (this repo's own dev sandbox cannot
do that — see §1) and confirm, or diagnose, whether it actually works.
Nothing else needs deciding — the design/scope questions are already
resolved (§2). This is a verification task, not a design task.

---

## 0. TL;DR — do this first

1. Make sure you're on a machine that can actually open GUI windows (a
   normal desktop OS — Windows/macOS/Linux-with-a-display — not a headless
   CI container and not a sandbox with `ELECTRON_RUN_AS_NODE` set — see §1
   for why that matters and how to check).
2. Clone the repo and install (§3).
3. Run **Stage A** first (§4.1) — a mock login server, no real credentials,
   no risk to production. This isolates "does our Electron code work at
   all" from "does the real backend/portal cooperate." Confirm it passes
   before moving on.
4. Run **Stage B** (§4.2) — the real thing, against
   `https://customer.centoffer.com`. This needs a real customer-portal
   account to log in with (§4.2 explains — you likely should NOT try to
   obtain/guess credentials yourself; ask whoever gave you this handoff).
5. Report results back per §6 — update this repo's `NOTICE.md`
   "Verification status" section with what you found, commit, and push
   (this repo's push policy is permissive — see §5).

---

## 1. Why this handoff exists — read this or you'll waste time

This repo (`bcsbeam-desktop-client`, forked from OpenIM's official
`openim-electron-demo`) got its Phase 1 login implemented in a **different**
sandboxed dev environment (a shared Linux server used for a much larger,
unrelated FINOS project) that turned out to have `ELECTRON_RUN_AS_NODE=1`
set globally — almost certainly a deliberate guardrail there against
spawning real Electron/Chromium GUI processes in that sandbox. That means:
every `electron` invocation in that environment silently runs as plain
Node.js instead of a real app — no window ever opens, with or without a
virtual display (Xvfb was present there and made no difference). So the
person/agent who built the login flow could verify it **compiles and
type-checks**, and could unit-test the core token-exchange script's logic
in isolation (`scripts/verify-token-exchange-script.mjs` — already
passing), but could not verify the actual `BrowserWindow` ever opens, that
the localStorage-polling detects a real login, or that the whole thing
navigates correctly. That's the gap this handoff is for.

**Check whether YOUR environment has the same limitation before you start:**

```
echo $ELECTRON_RUN_AS_NODE
```

If that prints `1`, you're in the same kind of sandbox and can't do this
task either — say so rather than quietly repeating the same
partial-verification and reporting it as done.

---

## 2. What's already decided — don't re-litigate

- **Direction**: this app extends OpenIM's own official Electron reference
  client (`openimsdk/openim-electron-demo`), not a from-scratch app. Already
  forked in; see `NOTICE.md` for the full provenance/rebrand/licensing
  record.
- **Login architecture**: login does NOT use a native form. It opens the
  REAL customer-portal login page
  (`https://customer.centoffer.com/customer-portal/login`) in its own
  Electron window, because the backend's `/api/openim/token/` endpoint
  requires the request's `Origin` header to genuinely be the customer
  portal (a security check in the main FINOS backend,
  `api/portal_authentication.py`) — a native HTTP call can't produce that,
  a real browser page loaded from that origin does, automatically. Full
  reasoning: `NOTICE.md` → "Login architecture finding".
- **Implementation** (already written, already committed, already pushed —
  commits `27650b3` and `c642f77` on `main`):
  - `electron/main/portalLoginWindow.ts` — opens the login window, polls its
    `localStorage` every 800ms for `portal_token`/`portal_type` (written by
    the real portal's own web app on successful login — see
    `frontend/src/utils/portalAuth.ts` `savePortalUser` in the _main_ FINOS
    repo, not this one), and when found, runs the token-broker exchange
    (`POST /api/openim/token/`) via `executeJavaScript` **inside that
    window's own page context** (so the Origin header is correct).
  - `electron/main/ipcHandlerManage.ts` / `electron/preload/index.ts` /
    `electron/constants/index.ts` — wire a `portalLogin` IPC channel
    exposing `window.electronAPI.portalLogin()` to the renderer.
  - `src/pages/login/index.tsx` — a single "Sign in with BCS Beam Portal"
    button that calls `portalLogin()`, stores the result via the existing
    `setIMProfile()`, and navigates to `/chat` (which re-triggers the
    app's own pre-existing `loginCheck()`/`tryLogin()` effect in
    `src/layout/useGlobalEvents.tsx` — untouched, already existed in the
    upstream demo, just now fed real credentials instead of demo ones).
- **What this task is NOT**: not a redesign, not a "should we do it
  differently" review, not scope for new features (Fleet data, tickets,
  WebView, tray icon polish — all separate, later work per the wider
  project plan). Just: does the thing that's already built actually work.

---

## 3. Setup

```
git clone git@github.com:jackzhang2026/bcsbeam-desktop-client.git
# or: git clone https://github.com/jackzhang2026/bcsbeam-desktop-client.git
cd bcsbeam-desktop-client
git log --oneline -3   # expect c642f77 at the top; if not, you're on stale code
corepack enable        # or: npm install -g pnpm@10.28.0
pnpm install
pnpm run typecheck     # should be clean
pnpm run build         # should succeed (confirms nothing broke in transit)
```

Requirements: Node ≥18.12.0, pnpm 10.x (both pinned in `package.json`
`engines`/`packageManager`). No native toolchain setup should be needed for
`pnpm install` on a normal desktop OS — Electron's own prebuilt binary and
`koffi`'s prebuilt native bindings both ship for common platforms.

---

## 4. The actual verification

### 4.1 Stage A — mock server dry run (do this first, no real credentials needed)

This validates the Electron mechanics in isolation: does the login window
open, does it detect a written `localStorage` token, does the
`executeJavaScript` fetch fire with the right request, does the window
close and the app navigate — all without touching production or needing a
real account.

```
node scripts/mock-portal-login-server.mjs
# leave that running in one terminal; it prints the URL it's serving on
```

In a second terminal:

```
# Windows (PowerShell):
$env:VITE_PORTAL_LOGIN_URL="http://127.0.0.1:4173/customer-portal/login"; pnpm dev
# macOS/Linux:
VITE_PORTAL_LOGIN_URL=http://127.0.0.1:4173/customer-portal/login pnpm dev
```

`pnpm dev` starts the Vite dev server AND automatically launches the
Electron app pointed at it (via `vite-electron-plugin` — no separate
"launch electron" step needed). You should see:

1. A splash window, then a main "BCS Beam" window showing the login screen
   with a "Sign in with BCS Beam Portal" button.
2. Click it → a second window titled "BCS Beam — Sign in" opens, loading
   the mock login page (plain HTML, obviously not the real portal — that's
   expected in Stage A).
3. Click "Simulate successful customer login" on that mock page.
4. **Within ~1-2 seconds**, the login window should close by itself, and
   the main window should navigate away from the login screen (it will
   then almost certainly show a real error/loading-forever state trying to
   actually connect to OpenIM with the mock's fake token — **that part
   failing is expected and fine**, the mock token isn't a real OpenIM
   token. What matters for Stage A is only: _did the window close itself
   and did navigation away from `/login` happen_ — that's the part unique
   to this repo's new code. If it hangs and the window never closes, that's
   a real bug in `portalLoginWindow.ts`'s polling logic — see §4.3.

### 4.2 Stage B — the real thing

Same as Stage A but without the mock server and without the env override
(the `.env` file already points at production):

```
pnpm dev
```

Click "Sign in with BCS Beam Portal" → the window that opens should load
the **actual** `https://customer.centoffer.com/customer-portal/login` page
— full real UI, same as visiting it in a browser.

**You need a real customer-portal account to log in with here.** Do not
try to guess, brute-force, or otherwise obtain one yourself — ask whoever
handed you this task for either (a) a designated test account's
credentials, or (b) to sit at the keyboard and do the actual login
themselves while you observe/verify the outcome. This is a real production
system with real customers' data behind it.

**What "it worked" looks like:** after a real successful login on that
page, within ~1-2 seconds the login window closes itself and the main app
window proceeds into the chat UI (or fails at the _IMSDK_ layer for an
IM-specific reason — e.g. self-hosted OpenIM server unreachable, which is a
separate, real thing worth reporting but is NOT this task's login-window
mechanism failing). If the window just sits there after a real login and
never closes, that's the bug to chase (§4.3).

### 4.3 If it doesn't work — where to look

- Add `win.webContents.openDevTools()` right after `win.loadURL(...)` in
  `electron/main/portalLoginWindow.ts` (temporarily, revert before
  committing) to get a real DevTools console + Network tab on the login
  window itself — you can inspect the actual `fetch('/api/openim/token/',
...)` call, its response, and any console errors from the injected
  script.
- The polling in `checkForLogin()` deliberately swallows all errors and
  returns `null` (so a mid-navigation `executeJavaScript` throw doesn't
  kill the whole flow) — this means silent failures look identical to "not
  logged in yet." Temporarily add a `console.log` inside the `catch` block
  if you need to see what's actually throwing.
- If Stage A fails: the bug is in this repo's own Electron code
  (window/polling/IPC), independent of any backend. Fix it here.
- If Stage A passes but Stage B fails at the network-request level (e.g.
  the fetch to `/api/openim/token/` returns 401/403): check the response
  body/status in DevTools. A 403 here most likely means the Origin check
  (`api/portal_authentication.py` in the **main FINOS repo**, not this one)
  is rejecting the request for some reason not yet anticipated — that
  would need a report back to the FINOS side (§6), not a fix in this repo.
- If the login window loads the real portal fine but login itself fails —
  that's a real customer-portal account/credentials problem, not related
  to this task.

---

## 5. Repo conventions (brief — see `NOTICE.md` for the full record)

- AGPL-3.0-only (this embeds `@openim/electron-client-sdk`, itself
  AGPL-3.0/commercial dual-licensed). Copyright © Brocent on new files.
- Push policy: commit + push as each milestone/finding is done. No need to
  hold back for a "deploy" event — just never commit secrets, real customer
  data, or internal-only endpoint maps. (This is looser than the sibling
  `support-chat-web`/`rustdesk-dedicated-repo` repos' "push only at deploy"
  rule — Jack confirmed 2026-08-26 that for _this_ repo, push-per-milestone
  is fine as long as nothing sensitive goes in.)
- Don't touch the main FINOS backend repo from here — you likely don't have
  access to it anyway (it's a separate, shared, access-controlled server).
  If you find something that looks like a backend bug, report it (§6)
  rather than trying to fix it blind.

---

## 6. Report back

Update this repo's `NOTICE.md` → "Verification status" section with:

- Whether Stage A passed (window opened, mock login detected, window
  closed, navigation happened).
- Whether Stage B passed (real login, real token minted, window closed,
  navigation happened) — or exactly where it failed if not (which stage,
  what error/response, screenshots/console output if you can capture them).
- Any bug you found and fixed in this repo's own code (commit it, mention
  the commit hash here).
- Anything that looks like a _backend_ (main FINOS repo) issue — describe
  it precisely (request/response, headers, status codes) so whoever has
  access to that repo can pick it up; don't guess at a fix there.

Commit and push (§5). Whoever asked you to do this will follow up in the
main FINOS repo's tracking docs
(`backend/docs/BCS_BEAM_OPEN_ISSUES_REGISTER.md` #5) with your findings —
you don't need access to that repo to complete this task.
