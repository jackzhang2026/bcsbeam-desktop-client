# BCS Beam Desktop Client — Windows Validation Handoff, Round 2 (Triple-Portal)

Round 1 (`HANDOFF_WINDOWS_BUILD_20260828.md`) got the FIRST Windows build ever produced
for this repo working — three real packaging bugs found and fixed (`.cmd` spawn,
`node-linker=hoisted`, win32 executable naming), smoke test passing, pre-login UI verified.
**Read that doc's §1/§4/§5 first if you haven't built this repo on Windows before** — the
toolchain/build recipe there is unchanged and not repeated here. This doc is scoped to
**what's new since that build** and needs validating.

## 0. TL;DR

- `pnpm install && pnpm build && pnpm build:win` — same as round 1, nothing to change.
- The app went from "customer accounts only" to **three account types: Customer, Staff
  (main internal system), Vendor** — new picker on the login screen, new per-type login/
  session logic, new per-type nav. This is the actual thing to validate.
- Round 1 explicitly did NOT test any post-login functionality (OAuth, MFA, the portal
  pages themselves) — that's now the bulk of what's left to verify, PLUS it's all new
  code for staff/vendor that has never run on a real machine at all.
- The frontend (web) side of this is **already deployed to production** — you don't need
  to build or touch `frontend/`, just this Electron client, and log in against the real
  `customer.centoffer.com` / `fin.centoffer.com` / `resource.centoffer.com`.

## 1. What changed (commits since round 1's `c39f3be`)

- `b023c71` — the main feature: `PortalType = 'customer' | 'staff' | 'vendor'` introduced
  end-to-end. Login window now takes a type and picks the right login URL + auth
  detection method per type (customer/vendor: localStorage token poll; staff: session-
  cookie poll against `/auth/user/`, since staff has no bearer token at all). **Each
  portal type gets its own persistent Electron session partition**
  (`persist:portal-customer/staff/vendor`) — this is the one genuinely new architectural
  risk, see §3.5 below.
- `9a0dafe` — merge with your round-1 build-tooling fixes (no conflicts, disjoint files).
- `5d87a9d` — scope correction: Vendor's nav is **Attendance + Tickets only** (Jack's
  explicit call — FSM tickets are already a tab inside Tickets, so no separate FSM page
  was needed). An earlier "Contract Rates" page for Vendor was built and then removed in
  this same commit — if you see any stale reference to it anywhere, that's leftover from
  a local cache, not something to chase.

## 2. Build recipe — unchanged from round 1

`pnpm build:win`, output at `release\BcsBeam\<version>\`. If you're on a fresh clone,
follow round 1's doc §4/§5 verbatim first.

## 3. What to validate — this is the actual point of this round

You'll need three real accounts to test with: one customer-portal login, one main-system
(staff) login, one vendor-portal login. Ask Jack for test credentials for whichever you
don't already have. For OAuth (§3.2/§3.4), you need a real Google (or Microsoft, for
staff) account that's actually linked to one of these test accounts — same as round 1,
if you don't have one, do the password-login parts and let Jack run the OAuth parts
himself like he did last time.

### 3.1 Login screen picker

Open the app fresh (or clear its session — see §3.5). You should see a 3-way segmented
control (Customer / Staff / Vendor) above the existing "Sign in" button, each with an
icon. **The selected pill should be filled solid blue** (`colorPrimary`, `#0089FF`), not
antd's default light-grey highlight — this needed an explicit `components: { Segmented:
{...} }` token override in `App.tsx` (AntD's Segmented doesn't pick up `colorPrimary` on
its own, a known gotcha — if it's rendering grey instead of blue, that override broke
somehow and is worth flagging). It should default to whichever type you signed in as last
time (persisted via electron-store) — first run defaults to Customer.

### 3.2 Customer flow (regression check — should behave exactly like round 1 already

verified, PLUS the new embed-mode fix on Tickets/Devices/Security)

1. Pick "Customer", sign in with password. Should land on `/chat` same as before.
2. Open Tickets, My Devices, Security from the left nav. **Each should show ONLY the
   page's own content — no second sidebar/header from the portal page itself.** This is
   the actual bug Jack originally reported (nav-inside-nav) and the frontend-side fix for
   it is now live in production — this is the first real validation of it. If you still
   see a duplicate sidebar inside any of these three pages, that's a real regression to
   report, not expected.
3. If you have a Google-linked customer test account: try Google sign-in from the picker
   too (should open your OS default browser, complete there, then hand control back to
   the app) — round 1 didn't get to this.

### 3.3 Staff flow — entirely new, never run before

1. Pick "Staff", sign in with the staff account's username/password (this is a normal
   FINOS main-system login — Django session, not a portal token).
2. Should land on `/tickets`. Left nav should show **Tickets only** — no Chat, no
   Contact, no Devices, no Security (all deliberately absent for staff in v1).
3. Open Tickets — should show the real main-system ticket list (`fin.centoffer.com/
tickets`), no duplicate sidebar (same embed-mode check as §3.2).
4. If the staff account has Microsoft SSO configured, try it — this login type's
   Microsoft OAuth was implemented as "should just work, it's a same-window redirect
   unlike Google" but was NEVER actually verified on a real browser/machine. If it fails,
   that's a real, useful finding, not something to silently work around.

### 3.4 Vendor flow — entirely new, never run before

1. Pick "Vendor", sign in with the vendor account's password.
2. Should land on `/tickets`. Left nav should show **Tickets + Attendance** — no Chat,
   no Devices/Security, no Contract Rates (that was built then explicitly removed, see §1).
3. Open Tickets — real vendor-portal ticket list (`resource.centoffer.com/vendor-portal/
tickets`), no duplicate sidebar.
4. Open Attendance — should land on the vendor's check-in page. **Its own internal tab
   bar (Check In / My Attendance / Apply / Profile) should still be visible and usable**
   — this one is deliberately NOT hidden by embed mode (unlike the outer sidebar), since
   it's the actual in-page navigation for using attendance, not duplicate app chrome. If
   you can only reach Check-In and the other three tabs are gone, that's a real bug.
5. If the vendor account has Google-linked login: try it. This is the most novel path —
   Vendor never had a desktop-OAuth handoff before this round (it existed for Customer
   only). Should open the OS browser, complete there, and hand back to the app the same
   way Customer's does.

### 3.5 Session partition isolation — the one thing round 1 couldn't test at all

This is new infrastructure with no prior real-world run. Do this sequence and watch for
anything wrong:

1. Sign in as Customer. Confirm it works, log out (or just close and reopen the app).
2. Sign in as Staff on the SAME app install. Confirm you land in a genuinely fresh staff
   session — NOT still showing customer data, NOT auto-logged-in as customer, no stray
   customer nav items.
3. Sign in as Vendor, same check.
4. Go back and sign in as Customer again — confirm it's a clean customer session again,
   not polluted by whatever staff/vendor cookies got set in between.
   The concern this is testing: staff (Django session cookie) and vendor (bearer token in
   localStorage) can both be served from hosts that historically shared one browser-style
   session in this app — each portal type now gets its own Electron session partition
   specifically to prevent this, but it's never been exercised on a real OS before.

## 4. What NOT to do

- Don't build or touch `frontend/` — it's a separate repo/deploy already live in
  production; this handoff is Electron-client-only.
- Same fence as round 1: if you find and fix a genuine build/packaging bug while doing
  this (like round 1's three), that's useful and fine to commit + push, same as last
  time. Anything bigger than that — UI/behavior changes, new features — check with Jack
  first rather than deciding scope yourself.

## 5. What to hand back to Jack

For each of §3.1–§3.5: pass/fail, and for any fail, exactly what you saw (screenshot if
it's visual). Particularly want to know: did the Segmented picker render blue-filled, did
the nav-inside-nav bug actually go away on Customer's Tickets/Devices/Security, did
Staff's Microsoft OAuth work, did Vendor's Google OAuth handoff work, did the Attendance
tab bar stay usable, and did the three-account session-switch sequence in §3.5 come out
clean. Same report-back style as round 1's own §10 works well — a dated section in this
file or a NOTICE.md entry, whichever you did last time.
