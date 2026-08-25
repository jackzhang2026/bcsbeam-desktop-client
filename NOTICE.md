# Modifications from upstream OpenIM Electron Demo

This file lists every substantive change made in this fork, per good-practice
disclosure for a copyleft (AGPL-3.0) derivative work. Based on
[openimsdk/openim-electron-demo](https://github.com/openimsdk/openim-electron-demo)
`main` branch, commit `62d7ca7b12e91144b315f36c8ebd1d9e0457a352` (2026-08-26
clone — full upstream history preserved, not squashed, so this repo can be
rebased onto later upstream security/feature releases the same way
`rustdesk-dedicated-repo` tracks upstream RustDesk).

This is the OpenIM project's own official desktop reference client — not a
from-scratch Electron/Flutter app. Its `package.json` name was already the
generic placeholder `OpenCorp-Base` upstream (description: "OpenIM PC
Client."), i.e. upstream already designs this repo to be white-labeled by
downstream adopters; renaming it is the intended customization path, not a
deviation from how the project expects to be used.

## Why this exists (BCS Beam project context)

TASK-062 — the BCS Beam unified desktop client. Endgame: a single customer-
facing app hosting chat + tickets + My-Device/self-service (Fleet-derived
data via the FINOS backend) + remote-support entry (bridging the already-
installed Mesh/RustDesk agents, tool names not shown to the customer), with
exactly one tray icon (this app's). Full design/decision record:
`backend/docs/BCS_BEAM_UNIFIED_CLIENT_HANDOFF_20260825.md` and
`backend/docs/BCS_BEAM_OPEN_ISSUES_REGISTER.md` #5, in the main FINOS repo
(this fork is deliberately a separate repo — see "Licensing boundary" below).

## Changes so far (2026-08-26, rebrand-only scaffold — no functional changes yet)

- `package.json`: `name` → `bcsbeam-desktop-client`, `version` reset to
  `0.1.0` (this is a new product line, not a continuation of the demo's own
  versioning), `description`/`author` updated, explicit `license:
"AGPL-3.0-only"` added (upstream didn't declare one in `package.json`,
  though the repo-root `LICENSE` file was always AGPL-3.0).
- `index.html`: `<title>` → `BCS Beam`.
- `electron-builder.json5`: `appId` → `com.brocent.bcsbeam.desktop`,
  `productName` → `BCS Beam`, `directories.output` path, NSIS
  `shortcutName`, Linux `maintainer` — cosmetic/identity fields only, no
  build-target or packaging-logic changes.
- This `NOTICE.md` itself.

## Login architecture finding (2026-08-26, corrects the earlier research-spike recommendation)

Traced the fork's own login flow: `src/pages/login/LoginForm.tsx` gets an
`imToken` from OpenIM's demo "chat" backend, then
`src/layout/useGlobalEvents.tsx`'s `tryLogin()` calls
`IMSDK.initSDK(...)` + `IMSDK.login({userID, token})`. We replace the demo
backend with our own `POST /api/openim/token/` (`backend/openim_bridge/`),
which returns `{openimUserID, token, expireTimeSeconds}` — a drop-in fit for
`IMSDK.login()`.

**Found a real blocker:** `/api/openim/token/` requires a Customer Portal
bearer token, and the DRF auth class validating it
(`api/portal_authentication.py`'s `PortalAuthentication`) also requires the
request's `Origin`/`Referer` to match the customer portal's real host
(`customer.centoffer.com` / `/customer-portal` path) — a defense against a
stale browser tab replaying the header, which a native Electron HTTP call
doesn't produce. `POST /api/customer-portal/auth/` (the login call itself)
is unaffected (`AllowAny`, no origin requirement) — only the _following_
token-broker call would 401.

**Corrected Phase 1 plan:** the handoff doc's original §7 Q3 recommendation
("native login form, skip WebView for Phase 1") is superseded — load the
_real_ customer-portal login page in an Electron window instead of a native
form. Real browser semantics give the correct Origin automatically, this
touches zero backend security code, and it's reusable groundwork for the
later WebView-into-portal ticket milestone rather than throwaway work.

**Not yet done** (tracked in the register, not silently skipped):

- No app icon/logo assets yet — still using upstream's own icons under
  `dist/icons/`. BCS Beam brand assets (see the RustDesk fork's `res/`
  artwork for the existing approved v1.3 brand system: steel-gradient "B"
  tile, navy `#081c33` background) need to be produced for this app's
  `dist/icons/` once real UI work starts, not part of this scaffolding pass.
- No login wiring yet — Phase 1's actual chat-over-Token-Broker work
  (`POST /api/openim/token/`, see handoff doc §3.1) has not started. This
  commit is scaffolding only: confirms the fork builds/rebrands cleanly
  before any auth/business logic goes in.
- Windows-only build target decided for Phase 1 (Jack, 2026-08-26) — the
  `mac`/`linux` sections in `electron-builder.json5` are left intact
  (harmless until invoked) rather than deleted, since re-enabling
  cross-platform later is meant to be a one-line scope change, not an
  architecture change.

## Verification status (2026-08-26)

`pnpm install` / `tsc --noEmit` / `eslint` / `pnpm run build` all pass clean
(confirmed on the FINOS dev box). Beyond that, this repo has **not** been
run end-to-end against a real customer-portal account — the dev sandbox
this was built in has `ELECTRON_RUN_AS_NODE=1` set globally (a deliberate
guardrail against spawning real Electron/Chromium GUI processes there), so
no actual `BrowserWindow` can be opened from it, with or without Xvfb. What
_was_ verified there instead: `scripts/verify-token-exchange-script.mjs`
(`pnpm run verify:token-exchange`) extracts the exact `executeJavaScript`
snippet from `electron/main/portalLoginWindow.ts` by regex (not a
hand-copied duplicate that could drift) and runs it under plain Node with a
mocked `window.localStorage`/`fetch`, covering: no token yet, wrong portal
type, a successful exchange (asserting the exact URL/method/headers sent),
and a non-ok broker response. This is a real check of that script's own
branching logic, but it is **not** a substitute for actually opening the
window, navigating to the live portal, logging in, and confirming the
poller detects it — that still needs to happen on a machine that can run a
real Electron window (e.g. Jack's own dev machine, or CI).

**2026-08-26, handed off:** see
`HANDOFF_ELECTRON_LOGIN_VERIFICATION_20260826.md` for the zero-context
handoff to whoever runs that real verification next (staged: a mock-server
dry run first with `scripts/mock-portal-login-server.mjs`, then the real
thing against `https://customer.centoffer.com`). Update this section with
the outcome once that's done, rather than adding a third parallel status
note — keep the verification story in one place.

## Licensing boundary (CLAUDE.md §6j precedent, applies here too)

This repo embeds `@openim/electron-client-sdk` and `@openim/wasm-client-sdk`,
both AGPL-3.0/commercial dual-licensed (confirmed against their own LICENSE
files, not assumed) — same boundary logic as `support-chat-web` (GPL-3.0) and
`rustdesk-dedicated-repo` (AGPL-3.0): this shell must stay a separate,
open-sourced repo; proprietary Brocent business logic (ticket details, Fleet
device data, customer identity) must live behind a WebView into the existing
proprietary customer portal / FINOS backend, never compiled into this client.
Same push discipline as those two repos: commit locally during development,
push to the public GitHub remote only at actual deploy time (tag = deploy
version) — per Jack's explicit repo approval, 2026-08-26 (see the register).

## Not changed

Everything else — SDK integration, chat/message UI, IM protocol handling,
build tooling beyond the identity fields above. This is upstream
`openim-electron-demo` unmodified except for the rebrand fields listed above.
