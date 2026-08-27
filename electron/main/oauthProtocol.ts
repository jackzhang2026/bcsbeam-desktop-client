// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// OAuth-for-native handoff (2026-08-27). Google's own OAuth policy rejects
// logins from an embedded webview / default Electron user-agent
// ("disallowed_useragent") — the login window (portalLoginWindow.ts) is
// exactly that kind of embedded BrowserWindow, so Login.tsx's OAuth buttons
// open the provider's auth page in the OS's DEFAULT browser instead
// (window.electronAPI.openExternal, when running inside this client — see
// that file's handleOAuth). This module is the other half: catching the
// portal token the completed flow hands back via a custom `bcsbeam://`
// URI (registered as this app's protocol handler) and finishing the SAME
// login flow the polling in portalLoginWindow.ts would otherwise finish
// itself — see completeDesktopOAuthLogin() there for why this can't just
// be a plain fetch from here (PortalAuthentication requires a genuine
// portal-origin Origin header, which only the still-open login window's
// own page context can produce).
//
// redirect_uri in the OAuth request itself stays a normal
// https://customer.centoffer.com/... URL throughout (see
// customers/portal_views.py's get_google_oauth_url) — NOT this custom
// scheme. Google's "Desktop app" OAuth client type (which DOES allow a
// custom-scheme redirect_uri directly) would need a SEPARATE OAuth client
// registered in Google Cloud Console, a real external credentials task
// outside what a code change here can do. Reusing the existing "Web
// application" client's real HTTPS redirect_uri, then handing off to this
// scheme as a second hop AFTER the browser-side OAuth exchange completes,
// needs no new Google-side registration at all.
import { app } from "electron";
import { completeDesktopOAuthLogin } from "./portalLoginWindow";

const PROTOCOL = "bcsbeam";

/** Call once, as early as possible (before app.whenReady() resolves) — see
 * electron/main/index.ts. Registering late can miss the OS handing us the
 * launch URL as a command-line argument on Windows/Linux. */
export function registerOAuthProtocol(): void {
  if (!app.isDefaultProtocolClient(PROTOCOL)) {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  // macOS: a custom-scheme navigation fires this event directly, whether or
  // not the app was already running.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void handleProtocolUrl(url);
  });
}

/** Windows/Linux: no `open-url` event exists — the custom-scheme URL shows
 * up as a plain argv entry, either on this launch (app was closed, the OS
 * link launched it fresh) or on the SECOND-INSTANCE event (app was already
 * running, which is the expected case here — the user triggered OAuth from
 * an already-open login window). Call from both places in index.ts /
 * appManage.ts's existing setSingleInstance(); a non-matching argv list is
 * a harmless no-op, not an error, so this is safe to call unconditionally
 * on every launch/second-instance. */
export function handleProtocolArgv(argv: string[]): void {
  const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (url) void handleProtocolUrl(url);
}

async function handleProtocolUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return; // malformed — ignore rather than crash on a garbage argv/open-url value
  }
  if (parsed.protocol !== `${PROTOCOL}:`) return;
  // Only one callback path exists today (auth-callback) — a stray/older
  // link with a different host is ignored rather than guessed at.
  if (parsed.hostname !== "auth-callback" && parsed.pathname !== "//auth-callback") return;

  const token = parsed.searchParams.get("token");
  if (!token) return;
  // `type` (e.g. "customer") is accepted for forward-compatibility (a future
  // vendor-portal desktop client would need to distinguish) but unused
  // today — completeDesktopOAuthLogin() only ever targets the customer
  // portal's login window, the only kind this client has.
  await completeDesktopOAuthLogin(token);
}
