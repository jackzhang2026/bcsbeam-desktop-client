# BCS Beam — Phase 2 Local Verification Handoff (2026-08-27)

**For: whichever agent picks this up next — assume ZERO context from any
prior conversation. Read this file fully before running anything.**

**The one task this handoff is for:** verify, on a real machine with a real
GUI, the Phase 2 work that could only be checked in a sandbox so far
(`tsc`/`eslint`/build/compiled-output inspection — never a real
`BrowserWindow`, never real device data, never a real chat message sent).
Phase 1 (login) already got this treatment — see
`HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md` in this same repo for
that precedent and the sandbox-limitation explanation (§1 there — same
constraint applies here, re-check `echo $ELECTRON_RUN_AS_NODE` in your
environment before assuming this handoff even applies to you).

This is **three stages of increasing dependency on things that aren't
deployed yet.** Do them in order and stop honestly at whichever one you
can't complete — do not report a later stage as verified because an
earlier one passed.

---

## 0. TL;DR — do this first

1. Confirm your environment can open real GUI windows (see the check above).
2. Get the code — **two of the three repos are on GitHub now, the main
   FINOS repo still isn't** (§1 explains why).
3. Run **Stage A** (§4) — pure Electron client mechanics. Needs nothing
   deployed. Do this regardless of what else is or isn't approved.
4. **Before Stage B or C**: read §2 and §3 — both need things deployed or
   built that are NOT live yet, and deploys on this box need **explicit
   approval from Jack**, checked fresh each time (an earlier approval
   doesn't carry over). Don't attempt either without that approval in hand.
5. Report results back per §5 — this file's own "Verification status"
   section (append one, following the pattern in
   `HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md`'s), commit, and push
   per each repo's own policy (§1 explains which repos push freely and
   which don't).

---

## 1. Getting the code — read this before you clone anything

**Update (2026-08-27, same day as this handoff was written):** the
"commit locally, push only at deploy time" policy this section originally
described turned out not to match how `bcsbeam-desktop-client` and
`support-chat-web` had actually been operated (every commit had been
pushed immediately in both repos' real history) — that discrepancy was
reported to Jack rather than silently resolved, and **Jack approved
continuing the actual practice**: push every commit as you go. Both repos
are pushed and current as of this handoff (`bcsbeam-desktop-client`
`1a71037`, `support-chat-web` `603fccd`) — clone them from GitHub normally:

| Repo                     | Clone from                                                |
| ------------------------ | --------------------------------------------------------- |
| `bcsbeam-desktop-client` | `git@github.com:jackzhang2026/bcsbeam-desktop-client.git` |
| `support-chat-web`       | `git@github.com:jackzhang2026/Chat-Integration.git`       |

**The main FINOS repo is different — this part of the original guidance
still stands.** It has its own separate, unrelated commit discipline
(`CLAUDE.md` at its root — a large, actively shared tree with its own
rules that are not optional), and its Phase 2 commits (`e15a44718`,
`2ebba34a7`, `f483b3c86`, `9d8cf62bc`, and others) are genuinely not on its
GitHub remote yet. Get it via `git clone <ssh-alias-for-this-box>:
/home/ecs-user <local-path>` (SSH access under your own personal account —
if you don't have it, stop and ask, don't set one up yourself, CLAUDE.md
§6f). **Do not push anything to the main FINOS repo yourself** — leave
your commits there local and report back per §5 instead; that repo's push
policy is a separate decision from the one Jack just made for the other
two.

---

## 2. What's already decided / already implemented — don't re-litigate

All of this is written, committed (locally, per §1), and passed
`tsc`/`eslint`/build/`manage.py check` in a sandbox that cannot run real
Electron or hit a real deployed backend. None of it has run for real yet.

- **My Devices** (`frontend/src/pages/CustomerPortal/MyDevices.tsx`,
  `backend/it_audit/portal_customer_views.py`) — read-only device
  compliance list + "Request Support" per device. New RBAC code
  `devices:view`, seeded via migration `customers/migrations/
0109_seed_devices_portal_permission.py` to the `member` and `finance`
  portal roles (see `HARDCODED_ROLE_DEFAULTS` in `customers/
portal_permissions.py` — a test account needs one of those two roles, or
  someone grants it another role via Settings → Users and Roles → Role
  Permissions after deploy).
- **Remote-support tray entry** (`electron/main/trayManage.ts` in
  `bcsbeam-desktop-client`) — "Get Remote Support" tray item → shows the
  window → navigates to the Devices tab.
- **Local-device auto-detect, two signals** (`electron/preload/index.ts`'s
  `getHostname()` and `getRustdeskId()`, `src/pages/devices/index.tsx`
  appending `?localHost=`/`?localRustdeskId=`, `MyDevices.tsx` matching) —
  shows a "this looks like your computer" one-click banner. `getRustdeskId()`
  (added `2af0367`, one day after the original hostname-only version) is
  a REAL exact match — it shells out to `rustdesk.exe --get-id` locally,
  the same CLI flag the backend's own probe already uses server-side. It's
  the preferred signal; hostname is only the fallback for a device with no
  RustDesk id reported yet. Confirmed by direct research: MeshCentral's own
  agent has no equivalent locally-readable node id anywhere in this
  project's installer, which is why hostname shipped first and RustDesk is
  the real upgrade, not a guess — see register #5 for the full finding.
  **This `getRustdeskId()` shell-out has never run on a real Windows machine
  with RustDesk actually installed — Stage A below should specifically
  confirm it finds a real id when RustDesk is present, not just that it
  fails gracefully when it isn't.**
- **OpenIM identity bridge** (`backend/openim_bridge/services.py`'s
  `add_customer_to_support_group`, wired into `request_support`) — a
  successful request-support call now also invites this portal user's own
  OpenIM identity into the request's group, returning `openim_group_id` in
  the response only when that succeeded.
- **Support Chat page** (`frontend/src/pages/CustomerPortal/
SupportChat.tsx` + `support-chat-web`'s new "portal" mode,
  `src/portalBridge.ts`) — mints this portal user's OpenIM credentials via
  a same-origin `POST /api/openim/token/` call, hands them into an embedded
  `support-chat-web` iframe via `postMessage` once it signals readiness.
  Full design rationale (and why the OpenIM SDK deliberately stays OUT of
  the main FINOS frontend bundle) is in `backend/docs/
BCS_BEAM_OPEN_ISSUES_REGISTER.md` #5, most recent entries.

**Full narrative, every commit SHA, every explicitly-scoped "not done
yet"**: `backend/docs/BCS_BEAM_OPEN_ISSUES_REGISTER.md` #5 (read the whole
thing, not just the last paragraph — earlier Phase 1/2 entries explain
decisions this handoff assumes you already know).

---

## 3. The three stages

### 3.1 Stage A — Electron client mechanics only (no deploy needed, do this now)

This tests every line of NEW client-side code without needing anything
deployed — the webview will just show whatever `customer.centoffer.com`
currently returns for `/customer-portal/devices` (today, that's probably a
login page or a 404-ish client route, since none of Phase 2 is deployed —
that's fine, you are not testing the page content here, only the Electron
mechanics around it).

1. `cd bcsbeam-desktop-client && pnpm install && pnpm run dev` (or whatever
   this repo's real dev-launch command is — check `package.json`; this
   repo's own Phase 1 handoff already worked out the dev-launch details,
   reuse them).
2. Confirm a real window opens with the login flow from Phase 1
   (`HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md`) — if THAT doesn't
   work on your machine, stop and fix/report that first; everything below
   assumes a working login.
3. Find the system tray icon. Confirm the menu now has a **"Get Remote
   Support"** item (with a separator above it, between Show/Hide Window and
   dev-tools/quit).
4. Click it. Confirm: the main window is shown/focused, AND it navigates to
   the Devices tab (internal route `/devices`).
5. Open DevTools on that window (or inspect the `<webview>` element some
   other way) and confirm the `<webview>`'s `src` attribute carries
   `?localHost=<your real hostname>` (from `getHostname()`) and, **if this
   machine has RustDesk installed**, `&localRustdeskId=<a numeric id>`
   (from `getRustdeskId()` — see §2's note on this specific signal never
   having run against a real RustDesk install before). If RustDesk is NOT
   installed on your test machine, confirm `localRustdeskId` is simply
   absent (not present-but-empty, not a crash) — that's the correct
   graceful-failure behavior, not a bug. This whole step is the one piece
   that is IMPOSSIBLE to fake or infer from a sandbox — real hostnames and
   real RustDesk installs only exist on a real machine.
6. If you have a Windows machine with RustDesk actually installed, run
   `rustdesk.exe --get-id` yourself from a terminal first and compare it
   character-for-character against what showed up in the webview URL in
   step 5 — this is the actual proof the shell-out works, not just that it
   didn't crash.
7. Also open the Devices tab from the normal left-nav item (not the tray) —
   confirm it works the same way (auto-detect is independent of how you
   got to the page).

**Report**: for each of steps 3–7, pass/fail and what you actually saw
(screenshot or exact text), not just "worked".

### 3.2 Stage B — real My Devices data (needs a backend + frontend deploy — get approval FIRST)

This is where Phase 2 actually shows real data. It requires, in order:

1. **A backend blue-green deploy** carrying migrations
   `customers/0109_seed_devices_portal_permission` and
   `it_audit/0060_alter_meshsupportrequest_source`, plus all the Phase 2
   backend code (`it_audit/portal_customer_views.py`,
   `openim_bridge/services.py` changes). Per `CLAUDE.md` §6d:
   `./scripts/deploy-bluegreen.sh` — **never** `docker compose restart
backend`. Mandatory gate first: `manage.py check` +
   `makemigrations --check --dry-run` clean (already verified clean as of
   this handoff, but re-verify — HEAD moves on this shared tree).
2. **A frontend deploy** carrying `MyDevices.tsx`, `SupportChat.tsx`,
   `App.tsx`'s new routes, and the two i18n files. Per `CLAUDE.md` §6e:
   check `git status --short -- frontend/` for OTHER agents' uncommitted
   work first; if any exists, use `./scripts/deploy-frontend.sh` (isolated
   worktree build), not the plain `deploy.sh`.
3. **A test customer-portal account whose role is `member` or `finance`**
   (§2 above explains why — those are the two roles `devices:view` seeds
   to). If you don't have one, ask rather than creating test data yourself
   in production.

**⚠️ Both deploys need Jack's EXPLICIT approval, asked for fresh — do not
assume an approval from an earlier session or an earlier stage of this
same handoff still applies (CLAUDE.md §6c: "do not infer it from a prior
approval in the same session").** If you can't get that approval, stop
here and report Stage A's results only — do not simulate or guess at what
Stage B would show.

Once deployed, log in as that test account at `customer.centoffer.com` (or
via the Electron client) and confirm:

- The "My Devices" nav item appears (it's gated on `devices:view` — if it's
  missing, the permission didn't actually reach that account; check which
  role they hold).
- The device list loads with real `UnifiedDevice` rows for that customer.
- "Request Support" on a device with `has_remote_support` works and
  returns a real `request_id`.
- If that response includes `openim_group_id`, an "Open Chat" button
  appears (per-row and in the "this looks like your computer" banner if it
  matched) — **do not click it yet**, that's Stage C.

### 3.3 Stage C — chat

**⚠️ Correction (2026-08-27, later same day than this handoff's first
version):** the original version of this section claimed the real backend
couldn't reach OpenIM at all. That was wrong — it tested `finance_celery`,
not the container that actually runs this code. `request_support`/
`ensure_support_group`/Token Broker all run synchronously inside a web
request (no Celery task touches `openim_bridge` — confirmed by a full
repo grep), which means the container that matters is `finance_backend_blue`
(whichever color is currently live — check `.bluegreen_state`). Re-tested
directly against it: joined to `openim-test_openim`, `getent hosts
openim-server` resolves, and a real `POST /auth/get_admin_token` call
returned a valid token end-to-end. **Backend-to-OpenIM connectivity is
fine.** Only the earlier "no nginx/DNS for `support-chat-web`" part was
correct — that one's real, see below.

**What's still true — `support-chat-web` isn't reachable from your
machine.** The OpenIM API/WS ports on this box are bound to
`127.0.0.1` only (`docker port openim_test_server` → both `10001`/`10002`
map to `127.0.0.1:<port>`), and `support-chat-web` has no nginx/DNS
anywhere in this environment. That means a real machine OUTSIDE this box
(yours) genuinely cannot reach either one directly — no amount of local
setup on your end routes around that.

**What you CAN do about it, without any new infra work:** if you have SSH
access to this box (§1's access method), tunnel both ports and run
`support-chat-web`'s dev server pointed at the tunnel — this gives you a
REAL end-to-end test (real backend-minted credentials, real OpenIM login,
real message send/receive), not just handshake mechanics:

1. `ssh -L 10001:127.0.0.1:10001 -L 10002:127.0.0.1:10002 <ssh-alias-for-this-box>`
   (keep this SSH session open in a terminal for the duration of the test).
2. On your machine: `cd support-chat-web && npm install`, then set
   `VITE_OPENIM_API=http://localhost:10002` and
   `VITE_OPENIM_WS=ws://localhost:10001` (env vars read by `src/App.tsx`),
   `npm run dev`.
3. You still need real, currently-valid OpenIM credentials for a real
   `customer_portal_openim_user_id` and a real `support_<id>` group your
   test account is a member of — the cleanest way to get both is completing
   Stage B first (a real `request_support` call against the deployed
   backend returns `openim_group_id`; minting credentials is
   `POST /api/openim/token/` with that same portal session's bearer token).
4. Build a small local HTML file (throwaway, don't commit it) that iframes
   `http://localhost:5173/?mode=portal&group=<the real group id>` and, once
   it receives `{source:'bcs-beam-chat', type:'ready'}`, replies with the
   REAL credentials from step 3 as `{source:'bcs-beam-host',
type:'openim-credentials', openimUserID, token, expireTimeSeconds}`.
5. If everything above is real, this should actually connect and let you
   send/receive a real message — not just reach `sdk.login()` with fake
   values. If you can't complete Stage B yet (no deploy approval), fall
   back to fake credentials as the previous version of this section
   described — that still verifies the handshake mechanics (readiness
   announcement, origin-check, credential threading into `connect()`)
   even without a real login succeeding.

**Still out of scope for this pass, unchanged:** making `support-chat-web`
reachable from the public internet (real nginx + DNS + exposing the OpenIM
ports appropriately) — that's real production infrastructure work, not
something to squeeze into a verification pass. The SSH-tunnel approach
above is a legitimate way to fully verify the FEATURE works without
needing that infrastructure to exist yet.

**Report Stage C as "handshake mechanics verified, full E2E blocked on
[infra gap above]"** — do not report it as "chat works."

---

## 4. Report back here

Append a new dated section below this line (same pattern as
`HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md`'s own "Verification
status" section) with: which stages you completed, exact pass/fail per
step (not just "looked fine"), any bugs found and whether you fixed them,
and commit SHAs for anything you changed. Update `backend/docs/
BCS_BEAM_OPEN_ISSUES_REGISTER.md` #5 too if you find anything that changes
what it currently says — that document is the authoritative one, this
handoff is disposable once its job is done.

---

## Verification status (2026-08-27)

**Environment:** Jack's own dev machine (`DESKTOP-IBRVK3V`), same one Phase 1
was verified on — `ELECTRON_RUN_AS_NODE` unset, real GUI available. Pulled
`bcsbeam-desktop-client` from GitHub (already current per the push-policy
correction above), rebuilt (`pnpm run typecheck` + `pnpm run build`, both
clean), verified via a Playwright-Electron harness driving the real built
app (same technique as Phase 1's Stage A/B), not a human clicking through —
noted per-step below where that matters.

**Stage A — pass, with one honestly-scoped gap:**

1. App launches, login screen present (Phase 1 mechanism unchanged) — pass.
2. **Pre-existing side effect found, not a bug**: the Phase 2 rebrand
   renamed `localForage`'s db (`src/utils/storage.ts`) from
   `"OpenCorp-Config"` to `"BCSBeam-Config"`. That's the _correct_ fix (the
   old name was upstream-demo leftover) but it orphans any session stored
   under the old name — yesterday's real Stage B login (Phase 1) no longer
   auto-restores. Expected, not something to revert.
3. To test the Phase 2 UI mechanics without a real login (same
   no-real-credentials class of technique as Phase 1 Stage A's mock
   server): injected a placeholder string into `IM_TOKEN`/`IM_USERID` via
   IndexedDB directly. `MainContentWrap`'s route guard only checks
   presence, not validity, so this gets past it — but the placeholder then
   fails real `IMSDK.login()` (`errCode 1503 TokenMalformedError`), which
   triggers the **same pre-existing bounce-back-to-`/login` behavior
   already documented** in `HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md`
   (an unrelated, already-known effect of a failed real login — not
   something Phase 2 introduced). This made the verification window a few
   seconds wide per app launch; results below were captured within that
   window. Test artifact (the placeholder token) has been deleted from the
   profile afterward — a real login will start clean.
4. **"My Devices" left-nav entry**: visible — pass.
5. **Devices route + `<webview>` src** (the one thing "IMPOSSIBLE to fake
   or infer from a sandbox" per this handoff): confirmed exactly
   `https://customer.centoffer.com/customer-portal/devices?localHost=DESKTOP-IBRVK3V`
   — real `os.hostname()` value genuinely appended. Confirmed **repeatedly,
   reproducibly**, both via a direct route change and via the equivalent of
   the left-nav click — pass every time.
6. **Tray "Get Remote Support" item**: the native OS system-tray context
   menu itself isn't part of any `BrowserWindow`'s DOM, so
   Chromium/Playwright automation has no way to physically click it (a hard
   tooling limit, not worth working around by guessing pixel coordinates on
   a real screen) — that one visual/click confirmation (does the label +
   separator actually render, does a real click register) still needs a
   human's 30-second glance and hasn't happened. Everything downstream of
   the click **has** been verified: `electron/main/trayManage.ts`'s handler
   is exactly `showWindow(); sendEvent(IpcMainToRender.navigateTo,
"/devices")` (source review), and invoking that exact `sendEvent` call
   directly from the main process (the real compiled function) produced a
   genuine, observed navigation to `/devices` in the renderer — confirming
   the IPC round-trip works, not just that the code reads correctly.
7. **(Landed mid-verification, re-tested against it)** A later commit
   (`2af0367`) upgraded local-device detection from hostname-only to
   preferring an exact RustDesk connection id (`getRustdeskId()`, shells out
   to `rustdesk.exe --get-id`), falling back to hostname when RustDesk isn't
   found. This dev machine has no RustDesk install, which is exactly the
   fallback path — re-ran the same webview-src check against the rebuilt
   app and got `?localHost=DESKTOP-IBRVK3V` with no `localRustdeskId`
   param, confirming the graceful-fallback path (the positive
   RustDesk-present path is unverified here — would need a machine with
   RustDesk actually installed).

**No bugs found or fixed in this stage** — Phase 2's client-side mechanics
work as designed.

**Stage B and Stage C: not attempted.** Both require Jack's fresh, explicit
approval per this handoff's own §3.2/§3.3 (an earlier approval doesn't
carry over, and none has been given for this session) — that approval is
being asked for separately rather than assumed. `backend/docs/
BCS_BEAM_OPEN_ISSUES_REGISTER.md` #5 has not been touched by this session
yet; will update once Stage B/C status is known.

---

_This handoff assumes you have already read
`HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md` for the sandbox-limitation
background and Stage A/B naming convention it established — this file
reuses that convention rather than re-explaining it._
