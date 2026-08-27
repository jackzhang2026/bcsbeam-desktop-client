# BCS Beam Desktop Client — Windows Build Handoff

**For: Claude Desktop on Jack's Windows machine, continuing this locally.**
**Date: 2026-08-28. Self-contained — do not assume access to any other machine or
conversation.**

You are picking up a unified BCS Beam desktop client (Electron, forked from OpenIM's
demo chat client) that just got a real UI design pass. There is currently **no build
pipeline that has ever produced a Windows package for this repo** — CI only builds
Linux. Your job: produce and validate a Windows build so Jack can actually click
through the new UI on his own machine.

---

## 0. TL;DR — what to do

1. `git pull` this repo (`main` branch) — the commits in §2 must be present.
2. Toolchain is light — no Rust/Flutter/vcpkg here, just Node 20 + pnpm (§4).
3. Build: `pnpm install` → `pnpm build:win` (§5). Expect an **unsigned** NSIS
   installer — Windows SmartScreen "unknown publisher" warning is expected, not a bug.
4. Run `pnpm electron:smoke` first (§6) — I fixed a real bug in that script on Linux
   but could not verify the fix on a real Windows machine. Confirm it actually passes
   here; if it still fails with something Windows-specific, that's a genuine new
   finding, not something to silently work around.
5. Install and click through the checklist in §7 — the whole point is validating the
   new login flow (progressive email→password, OAuth-forward, real 6-digit code boxes,
   the beam-of-light motif) actually renders correctly in a real packaged app, not just
   in dev mode.
6. Report back per §9 — do not attempt code signing or publishing anywhere; that's
   explicitly out of scope for this handoff.

---

## 1. What this project is

- **BCS Beam Desktop Client** = a unified support/IT companion app extending
  [OpenIM](https://github.com/openimsdk)'s Electron demo client — native chat (real
  OpenIM SDK), plus three webview-into-the-customer-portal panels: Tickets, My
  Devices, Security. Login delegates to the real customer-portal web login, opened in
  a child `BrowserWindow` (not a native form) — see `electron/main/portalLoginWindow.ts`.
- Repo: `github.com/jackzhang2026/bcsbeam-desktop-client` (this repo, branch `main`).
- **License: AGPL-3.0-only** (SPDX headers already in touched files — keep that
  convention on anything new).
- This is a **separate product** from the RustDesk-fork "BCS Beam Remote" client
  (`beam-remote-client` repo) — don't confuse the two handoffs if you've seen that
  one. This one is much simpler: no native Rust/Flutter toolchain, just Node/Electron.
- Backend it talks to: the FINOS customer portal (`customer.centoffer.com` in
  production) — real network calls to a real server, not mockable locally. You do NOT
  need backend access to build; you DO need internet access at runtime to actually
  click through login/chat/tickets/devices, since all of that is server-backed.

## 2. Current repo state (pushed to GitHub `main` — verify these are present after pull)

Recent commits (newest first) relevant to this handoff:

- `fix(ci): electron-smoke's release path was still "Base", the pre-rebrand product name`
- `feat(login): beam-of-light motif on the native gate screen, tighten copy`
- `feat: add TOTP settings webview (closes original plan gap)`
- `feat: add OAuth-for-native custom URI handoff (bcsbeam auth-callback)`

**What changed in this UI design pass** (full design record:
`backend/docs/BCS_BEAM_UI_DESIGN_PHASE1_20260828.md` in the main FINOS repo, not this
one — read it if you want the "why" behind every screen):

- `src/pages/login/index.tsx` / `index.module.scss`: the native gate screen (the one
  screen this repo owns for login) now has an ambient beam-of-light motif behind the
  brand panel and tighter button copy ("Sign in", not "Sign in with BCS Beam Portal").
  This is the ONE screen in this repo you can visually verify without any server
  changes being live — it's pure local rendering.
- Everything past that gate screen — the actual login FORM (email/OAuth/password/MFA),
  Tickets, My Devices, Security — is server-rendered content loaded in
  webviews/child-windows from `customer.centoffer.com`, which is **already deployed**
  (verified live as of 2026-08-28). You don't need to build anything server-side; just
  build this Electron shell and it'll load the live, already-updated pages.

## 3. The open task — there is no Windows build artifact yet, period

Unlike the RustDesk-fork handoff you may have seen, there's no "one specific feature
left to wire" here. The task is simpler and more foundational: **nobody has ever
produced a Windows package for this repo.** `.github/workflows/ci.yml` only does:

```yaml
- Package Linux application  (pnpm electron:build -- --linux --x64 --dir)
- Smoke-test packaged application  (xvfb-run pnpm electron:smoke)
```

No Windows build step, no code signing, no publish-anywhere step exists in CI or
anywhere else in this repo. `electron-updater` is in `package.json` but is NOT wired
up anywhere (no `autoUpdater` usage, no `publish` block in `electron-builder.json5`) —
it's a dormant dependency, not a working update channel. Don't assume otherwise.

Your job is just: build it for Windows, prove it actually runs and looks right, report
back. Signing/publishing are explicitly separate, later decisions (§8).

## 4. Toolchain setup (Windows) — much lighter than a native-code project

| Tool    | Version                                       | Notes                                                                                         |
| ------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Node.js | **>= 18.12.0** (repo built/tested on 20.20.2) | `winget install OpenJS.NodeJS.LTS`                                                            |
| pnpm    | **>= 10.0.0, < 11.0.0** (repo uses 10.28.0)   | `corepack enable` then `corepack prepare pnpm@10.28.0 --activate`, or `npm i -g pnpm@10.28.0` |
| Git     | —                                             | —                                                                                             |

**No Rust, no Flutter, no vcpkg, no Visual Studio Build Tools needed.** The two
native-ish dependencies (`koffi` — FFI library, and `@openim/electron-client-sdk`)
both ship **prebuilt platform binaries** (`node_modules/koffi/build/koffi/win32_x64/`,
`node_modules/@openim/electron-client-sdk/assets/win_x64/`) — `pnpm install` fetches
these automatically for whatever platform you run it on. If `pnpm install` on Windows
somehow tries to compile something from source, that itself is worth reporting back —
it would mean something unexpected, not an expected step.

```powershell
git clone git@github.com:jackzhang2026/bcsbeam-desktop-client.git
cd bcsbeam-desktop-client
git pull origin main
pnpm install
```

## 5. Build recipe

```powershell
pnpm build          # vite build (renderer) + electron build (main/preload) — verify this succeeds first
pnpm build:win       # = node scripts/electron-build.mjs --win --x64 — produces the NSIS installer
```

Output lands in `release/BcsBeam/<version>/` (e.g. `release/BcsBeam/0.1.0/`) —
`win-unpacked/bcsbeam-desktop-client.exe` (unpacked, for quick iteration) and
`BCS Beam_0.1.0.exe` (the actual NSIS installer, per `artifactName` in
`electron-builder.json5`).

If you want a dry-run manifest check first (matches what CI does before packaging):

```powershell
pnpm electron:package:check    # = electron-build.mjs --dry-run, just prints the runtime deps list
```

## 6. Smoke test — verify my Linux-side fix, and watch for a second issue

```powershell
pnpm electron:smoke
```

This spawns the packaged exe with `--user-data-dir=<temp>` and `--no-sandbox`, waits
for a "ready" signal, and kills it. Two things to know:

1. **I fixed a real, standing bug in this script on 2026-08-28**: it was looking for
   the built exe under `release/Base/<version>/...` — "Base" was the pre-rebrand
   product name, stale since the very first BCS-Beam-rebrand commit. It's now
   `release/BcsBeam/<version>/...`, matching `electron-builder.json5`'s
   `directories.output`. This means `pnpm electron:smoke` — including CI's own
   "Smoke-test packaged application" step — has probably never actually smoke-tested
   anything on Linux until this fix. Confirm the script finds the exe correctly on
   Windows too (path should resolve to `release/BcsBeam/0.1.0/win-unpacked/
bcsbeam-desktop-client.exe` per the script's own `win32` branch).

2. **After that fix, on MY Linux sandbox, the packaged exe itself then failed with
   `bad option: --user-data-dir=...` and `bad option: --no-sandbox`** — as if the
   binary doesn't recognize standard Electron/Chromium flags at all. I did NOT chase
   this further because it smelled like a sandbox-specific quirk in my container
   (possibly a missing dependency or a `chrome-sandbox` permissions issue specific to
   that environment), not necessarily a real bug — but I never got to verify that
   theory on a real machine. **On Windows, check whether this reproduces.** If the
   Windows build launches fine and responds to these flags normally, that confirms it
   really was a Linux-sandbox-only artifact (nothing to fix). If it reproduces on
   Windows too, that's a genuine second bug worth reporting back in detail (exact
   Electron version is pinned to `22.3.27` in `electron-builder.json5` — check if a
   plain `electron .` dev-mode launch handles the same flags fine, to narrow down
   whether it's an electron-builder packaging issue vs. something upstream).

## 7. On-machine validation checklist — the actual point of this handoff

Launch the installed app (or `release\BcsBeam\0.1.0\win-unpacked\
bcsbeam-desktop-client.exe` directly for quick iteration without installing) and
check:

- [ ] **Login gate screen** (this repo's own, no network dependency to render):
      navy gradient brand panel on the left with a visible, subtly moving/glowing
      light-sweep behind the "B" mark and "BCS Beam" wordmark (not static — give it a
      few seconds; the animation is slow and ambient, ~9s cycle). Right side: a plain
      white card, app name heading, single **"Sign in"** button (not "Sign in with BCS
      Beam Portal" — that copy was tightened), hint text "Opens your BCS Beam account
      in a secure window."
- [ ] Click "Sign in" — a child window opens loading the real customer-portal login
      (`customer.centoffer.com/customer-portal/login`). This needs real internet
      access and doesn't require a real account to LOOK right:
  - [ ] OAuth row (Google / Microsoft / WeChat icon buttons) appears ABOVE the email
        field, not below it.
  - [ ] Enter any text in the email field and click "Continue" — the screen should
        transition to show an "email · Change" chip + password field (not still
        showing the email field).
  - [ ] Click "Change" — goes back to the email step.
  - [ ] (Only testable with a real account that has MFA enabled) the MFA step shows
        SIX separate single-digit boxes, not one long text field, and typing a digit
        auto-advances to the next box.
- [ ] After a real sign-in (needs valid portal credentials — ask Jack if you don't
      have a test account): the left nav rail shows Messages / Contacts / Tickets /
      Devices / Security. Tickets and My Devices are webviews into the live portal —
      if they load at all, they already reflect the 2026-08-28 fixes (real ticket
      status categories instead of raw internal codes, a fleet security score card on
      My Devices) since that's server-side and already deployed; no local build step
      affects that content.
- [ ] System tray icon (bottom-right on Windows) — right-click shows "Show Window /
      Hide Window / — / Get Remote Support / Toggle Developer Tools / Quit". This
      repo's tray labels currently render as literal untranslated keys
      (`system.remoteSupport` etc.) — a PRE-EXISTING, separate, known i18n gap (missing
      `"system"` namespace in `src/i18n/resources/{en,zh}.json`), not something
      introduced by this build. Worth confirming it still shows that way (expected,
      not a build regression) rather than something worse.

**Expected, not bugs:** Windows SmartScreen "Windows protected your PC / Unknown
publisher" on first launch of the unsigned installer/exe — click "More info" → "Run
anyway". This is normal for an unsigned build; do not attempt to fix, sign, or
work around it. Signing is a deliberately separate, later decision (§8).

## 8. Signing / publishing — explicitly NOT part of this handoff

Do not attempt to code-sign or publish this build anywhere. There is no signing
certificate configured for this repo (unlike the RustDesk-fork client, which has an
active SignPath Foundation + Sectigo OV plan — see that repo's own handoff docs; this
repo hasn't gone through that process at all yet). If Jack wants a real signed,
publicly-distributed release pipeline for this client, that's a separate follow-up
decision (buy/apply for a cert, wire `electron-updater` to a real feed, add a Windows
build+sign step to CI) — not something to improvise here.

## 9. What to hand back to Jack when done

1. Confirmation the build succeeded (`pnpm build:win`) and where the installer landed.
2. Smoke-test result (§6) — pass/fail, and specifically whether the "bad option" issue
   reproduced on Windows or was Linux-sandbox-only.
3. Results of the §7 checklist — screenshots of the login gate screen (with the beam
   motif visible) and the OAuth-forward/progressive-email login form are the most
   useful things to send back, since those are the two screens this pass actually
   changed code for.
4. Anything that looked wrong that isn't listed above as "expected."

Do not push any new commits back to `main` without checking with Jack first if you end
up needing to change code to get a clean build — report findings first; only fix
things that are clearly safe, narrowly-scoped bugs (the same bar the electron-smoke.mjs
path fix met).
