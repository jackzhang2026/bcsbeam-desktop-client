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
2. Get the code — **three repos, and two of them must come from THIS
   server, not GitHub** (§1 explains why).
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

Three repos are involved. **Do not `git clone` two of them from their
public GitHub remotes** — their latest commits are intentionally sitting
**local-only** on this server (`ecs-user@<this box>`), per the push
discipline in `CLAUDE.md` §6j: "日常开发只提交本地，部署上生产的同时才推
公共 GitHub 仓库并打 tag" (commit locally during development; push to the
public remote only at actual deploy time). Pushing them now, just to make
this handoff easier, would itself be the violation that rule exists to
prevent — don't do it, and don't ask this session to do it either.

| Repo                                                           | Where the LATEST code actually is                                                                                                                                                                                                                                                                  | How to get it onto your machine                                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bcsbeam-desktop-client`                                       | `/home/ecs-user/bcsbeam-desktop-client` on this box, HEAD `babfd5d` at handoff time — GitHub's `main` is behind (last pushed: `c66a66f`)                                                                                                                                                           | `git clone <your-ssh-alias-for-this-box>:/home/ecs-user/bcsbeam-desktop-client` (same SSH access you already use to reach this box under your personal account — do not use `git@github.com:jackzhang2026/bcsbeam-desktop-client.git`)                                   |
| `support-chat-web`                                             | `/home/ecs-user/support-chat-web` on this box, HEAD `603fccd` — GitHub's `main` is behind                                                                                                                                                                                                          | same pattern: `git clone <ssh-alias>:/home/ecs-user/support-chat-web`                                                                                                                                                                                                    |
| The main FINOS repo (`/home/ecs-user`, branch `feature/logon`) | This one's `origin` (`git@github.com:jackzhang2026/Finance2026.git`) is a private repo already used for normal push/pull — but the Phase 2 commits (`e15a44718`, `2ebba34a7`, `f483b3c86`, `9d8cf62bc`, and others) are **not pushed there yet either** — same clone-from-the-box approach applies | `git clone <ssh-alias>:/home/ecs-user <local-path>` — **this is a large, shared, actively-worked-on repo** (read `CLAUDE.md` at its root in full before touching it — commit/branch discipline there is not optional and differs from the other two repos' looser rules) |

If you don't already have SSH access to this box from your machine, stop
and ask — don't set up new access yourself (CLAUDE.md §6f: personal
accounts, scoped sudo, no shortcuts).

**Once you're done and have real results:** `bcsbeam-desktop-client` and
`support-chat-web` push freely to their own GitHub remotes at any time —
they're small, purpose-built public repos, verification/dev commits from a
real-machine session are exactly what belongs there (unlike deploy-time-only
pushes, which are about not exposing security-relevant changes early —
verification results carry no such risk). The main FINOS repo does NOT get
pushed by you — leave your commits local on this box (or push only if the
person who gave you this handoff explicitly says to) and report back per §5
instead.

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
- **Local-device auto-detect** (`electron/preload/index.ts`'s
  `getHostname()`, `src/pages/devices/index.tsx` appending `?localHost=`,
  `MyDevices.tsx` matching it) — shows a "this looks like your computer"
  one-click banner when exactly one device matches by hostname.
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
   other way) and confirm the `<webview>`'s `src` attribute is
   `https://customer.centoffer.com/customer-portal/devices?localHost=<your
real machine's hostname>` — i.e., `getHostname()` actually returned your
   real OS hostname and it actually got appended. This is the one piece
   that is IMPOSSIBLE to fake or infer from a sandbox — `os.hostname()`
   only means something on a real machine.
6. Also open the Devices tab from the normal left-nav item (not the tray) —
   confirm it works the same way (the hostname auto-detect is independent
   of how you got to the page).

**Report**: for each of steps 3–6, pass/fail and what you actually saw
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

### 3.3 Stage C — chat (needs MORE than a deploy — a real infra gap, verified not assumed)

**Read this before attempting Stage C — it is not "just also deploy
this."** Two things were checked directly (not assumed) while writing this
handoff, on this box, right now:

1. `OPENIM_ENABLED=true` **is** already set in this box's `.env`, and the
   currently-running `finance_celery`/`finance_backend` containers already
   read it as `True`.
2. **But** `OPENIM_API_URL=http://openim-server:10002` does **not**
   resolve from those containers — `openim-server` only exists as a
   network alias on the `openim-test_openim` Docker network (the TASK-059
   trial OpenIM stack, `/home/ecs-user/openim-test/`), which the real
   `finance_backend`/`finance_celery` containers are **not** joined to.
   Confirmed with a live DNS lookup from inside `finance_celery` — it
   fails. This means **every OpenIM call the real backend makes today
   silently fails** (caught by the various best-effort `try/except`
   blocks throughout this feature — nothing crashes, but nothing reaches
   OpenIM either).
3. On top of that, `support-chat-web` has **no nginx/DNS wiring anywhere in
   this environment** — there is no URL to point `VITE_SUPPORT_CHAT_URL`
   at, and the OpenIM API/WS ports are internal-Docker-network-only, not
   exposed to the internet at all — so even a machine outside this box
   (like yours) could not reach them regardless of DNS.

**None of this is something Stage C can route around by trying harder.**
Getting real end-to-end chat working needs actual infrastructure work
(join the two Docker networks or repoint `OPENIM_API_URL` at something
reachable; stand up nginx + DNS for `support-chat-web`; expose the OpenIM
API/WS ports appropriately) that is **out of scope for a "verify Phase 2"
pass** — it's its own task, and should be scoped and approved separately,
not squeezed in here.

**What you CAN still usefully verify without any of that** — the
`postMessage` handshake mechanics themselves, which are 100% new code and
have never run in a real browser:

1. Run `support-chat-web`'s own dev server locally: `cd support-chat-web
&& npm install && npm run dev` (this alone does not need the FINOS
   backend at all).
2. Open it directly at `http://localhost:5173/?mode=portal&group=test`
   (or whatever port Vite picks). Expect it to sit on the "connecting"
   spinner forever and eventually show `connectFailed` — it's waiting for
   a `postMessage` from a parent frame it doesn't have, since you opened it
   directly rather than through an iframe. That's expected, not a bug.
3. Build a **tiny local HTML file** (throwaway, don't commit it) that
   iframes that same dev-server URL and, in a script tag, listens for the
   `{source:'bcs-beam-chat', type:'ready'}` message and replies with a
   FAKE credentials message: `{source:'bcs-beam-host',
type:'openim-credentials', openimUserID:'test', token:'fake',
expireTimeSeconds:3600}`. Confirm `support-chat-web` receives it (add a
   temporary `console.log` in `src/portalBridge.ts` if needed, remove
   before committing) and moves off the "boot" phase into actually calling
   `sdk.login()` with those fake values (which will then fail against the
   real OpenIM SDK, since the credentials are fake — that failure is fine
   and expected; you're verifying the HANDSHAKE reached that point, not
   that fake credentials produce a real login).
4. This confirms: `portalBridge.ts`'s readiness announcement fires, the
   origin-check logic doesn't accidentally reject a legitimate parent, and
   the credentials get threaded into `connect()` correctly. It does NOT
   confirm a real message can be sent/received over real OpenIM — that
   needs the infra work above, separately scoped.

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

_This handoff assumes you have already read
`HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md` for the sandbox-limitation
background and Stage A/B naming convention it established — this file
reuses that convention rather than re-explaining it._
