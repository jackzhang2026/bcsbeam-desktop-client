// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Phase 1 login (TASK-062, see NOTICE.md "Login architecture finding"):
// loads the REAL portal login page instead of a native form. Two reasons,
// not one — a native form would additionally have to reimplement
// MFA/password-reset/OAuth, which the real page already does for free — but
// the deciding one is that `POST /api/openim/token/` (customer type only,
// see below) is gated by PortalAuthentication, which requires the request's
// Origin/Referer to actually be the portal (api/portal_authentication.py,
// _is_request_from_portal_context). A native Electron HTTP call doesn't
// produce that; a real page loaded from that origin does, for free.
//
// TASK-062 triple-portal extension (2026-08-28): this used to hardcode the
// customer portal only. Staff (main internal system) and vendor (Vendor
// Portal) are genuinely different, not just a different URL:
//  - customer & vendor share one auth transport (bearer token in that page's
//    own localStorage, see frontend/src/utils/portalAuth.ts) — detected the
//    same way, just against a different `portal_type` value.
//  - staff uses classic Django session cookies + CSRF (frontend/src/utils/auth.ts)
//    — there is no localStorage token to poll for at all; success is
//    detected by asking the window's own page context to call the session-
//    authenticated `/auth/user/` endpoint instead.
//  - only customer has OpenIM chat wired up (`/api/openim/token/`) — staff
//    and vendor logins resolve with just their type, no chat credentials to
//    mint (see src/types/portal.ts's PortalLoginResult).
//
// Session isolation: staff (fin.centoffer.com, session cookie) and vendor
// (resource.centoffer.com, but vendor's Django session cookie has
// SESSION_COOKIE_PATH='/' with no domain restriction per backend/config/settings.py)
// must never share Electron's session state, or logging into one after the
// other on the same install clobbers/leaks the other's cookie/localStorage.
// Each portal type gets its own persistent partition
// (persist:portal-<type>), applied here AND to every webview page for that
// type (src/components/PortalWebView.tsx's `partition` prop) so a webview
// inherits the exact session its type's login window created.
import { BrowserWindow } from "electron";
import { PortalLoginResult, PortalType } from "../../src/types/portal";
import { getStore } from "./storeManage";

const DEFAULT_PORTAL_LOGIN_URLS: Record<PortalType, string> = {
  customer: "https://customer.centoffer.com/customer-portal/login",
  staff: "https://fin.centoffer.com/login",
  vendor: "https://resource.centoffer.com/vendor-portal/login",
};

// VITE_PORTAL_LOGIN_URL is kept as a back-compat alias for the customer slot
// only, so an existing deploy config with just that one var set keeps working
// unchanged; the two new types get their own dedicated var names.
const PORTAL_LOGIN_URLS: Record<PortalType, string> = {
  customer:
    process.env.VITE_CUSTOMER_LOGIN_URL ||
    process.env.VITE_PORTAL_LOGIN_URL ||
    DEFAULT_PORTAL_LOGIN_URLS.customer,
  staff: process.env.VITE_STAFF_LOGIN_URL || DEFAULT_PORTAL_LOGIN_URLS.staff,
  vendor: process.env.VITE_VENDOR_LOGIN_URL || DEFAULT_PORTAL_LOGIN_URLS.vendor,
};

const POLL_INTERVAL_MS = 800;

interface PendingLogin {
  win: BrowserWindow;
  portalType: PortalType;
  settled: boolean;
  poll: ReturnType<typeof setInterval> | null;
  finish: (fn: () => void) => void;
}

// At most one login flow is ever in progress (the login window is modal) —
// a single slot, not a map, is enough. Read by completeDesktopOAuthLogin()
// (electron/main/oauthProtocol.ts) so the bcsbeam://auth-callback handler
// can finish the SAME flow the polling below would otherwise finish itself.
let pending: PendingLogin | null = null;

/**
 * Opens the given portal type's own login page in a child window, in that
 * type's own persistent Electron session partition. Resolves once the user
 * has actually logged in there, one of two ways:
 *  1. (native form) detected by polling that window's own page context —
 *     customer/vendor read the `portal_token`/`portal_type` the portal's web
 *     app writes to localStorage on success (frontend/src/utils/portalAuth.ts
 *     `savePortalUser`); staff has no such token, so it polls the
 *     session-cookie-authenticated `/auth/user/` endpoint instead.
 *  2. (OAuth, customer/vendor only — staff's Microsoft OAuth is a same-window
 *     redirect, not blocked the way Google's embedded-webview policy blocks
 *     the other two, so it completes via path 1's polling like a normal form
 *     login) the OS's default browser completes the flow instead and hands
 *     the portal token back via a custom `bcsbeam://auth-callback` URL,
 *     caught by electron/main/oauthProtocol.ts, which calls
 *     completeDesktopOAuthLogin() below with that token.
 * Rejects if the window is closed first. On success, persists `portalType`
 * to electron-store — the single place that actually knows a login just
 * succeeded, so the single source of truth for "which type did this install
 * last sign in as" (read back by src/utils/portalType.ts for the login
 * screen's picker default).
 */
export function openPortalLoginWindow(
  portalType: PortalType,
  parent?: BrowserWindow,
): Promise<PortalLoginResult> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 480,
      height: 720,
      parent,
      modal: !!parent,
      title: "BCS Beam — Sign in",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: `persist:portal-${portalType}`,
      },
    });

    const state: PendingLogin = {
      win,
      portalType,
      settled: false,
      poll: null,
      finish: (fn) => {
        if (state.settled) return;
        state.settled = true;
        if (state.poll) clearInterval(state.poll);
        pending = null;
        fn();
      },
    };
    pending = state;

    win.loadURL(PORTAL_LOGIN_URLS[portalType]).catch((err) => {
      state.finish(() => reject(err));
    });

    state.poll = setInterval(() => {
      if (state.settled || win.isDestroyed()) return;
      void checkForLogin(win, portalType).then((result) => {
        if (result) {
          getStore().set("portalType", result.portalType);
          state.finish(() => {
            if (!win.isDestroyed()) win.close();
            resolve(result);
          });
        }
      });
      // A failed check (page mid-navigation, token exchange not ready yet,
      // 401 because the token exchange raced a portal-side redirect) is not
      // fatal here — we just retry on the next tick. Only an explicit window
      // close (below) ends the flow unsuccessfully.
    }, POLL_INTERVAL_MS);

    win.on("closed", () => {
      state.finish(() => reject(new Error("Login window closed before completing sign-in.")));
    });
  });
}

/**
 * The OAuth counterpart to the polling loop above — called by
 * electron/main/oauthProtocol.ts when a `bcsbeam://auth-callback?token=...`
 * URL arrives. Runs the exact same token-exchange `executeJavaScript` the
 * poller uses (same Origin-header requirement, same reasoning), just
 * triggered by an event instead of a timer tick, and against a token handed
 * in directly rather than read from the window's own localStorage. Resolves
 * the SAME promise `openPortalLoginWindow()` returned, or does nothing if no
 * login is currently pending (e.g. a stale/duplicate callback after the
 * window was already closed some other way), or if the callback's own
 * `type` doesn't match the flow that's actually pending (defensive only —
 * the OAuth buttons that produce this callback are rendered by whichever
 * portal page is currently loaded, so a mismatch would mean a stale link).
 */
export async function completeDesktopOAuthLogin(
  portalToken: string,
  portalType: PortalType,
): Promise<boolean> {
  if (!pending || pending.settled || pending.win.isDestroyed()) return false;
  if (pending.portalType !== portalType) return false;
  // Staff never reaches this path — its Microsoft OAuth is a same-window
  // redirect completed by checkForLogin()'s session-cookie poll instead (see
  // openPortalLoginWindow's doc comment) — so a "staff" callback here would
  // mean a stale/mismatched link, not a real flow to finish.
  if (portalType === "staff") return false;
  const { win } = pending;
  const result = await exchangeTokenForCredentials(win, portalToken, portalType);
  if (!result) return false;
  getStore().set("portalType", result.portalType);
  pending.finish(() => {
    if (!win.isDestroyed()) win.close();
  });
  return true;
}

/**
 * Runs entirely inside the login window's own page context via
 * executeJavaScript — both the localStorage read AND the token-broker fetch
 * — so the fetch carries that page's real Origin header. Returns null (not
 * a rejection) for "not logged in yet" / "exchange not ready", so the
 * poller can keep trying instead of treating a transient miss as fatal.
 */
async function checkForLogin(
  win: BrowserWindow,
  portalType: PortalType,
): Promise<PortalLoginResult | null> {
  try {
    if (portalType === "staff") {
      // No bearer token exists for a session-cookie login — ask the page's
      // own context whether the session it's sitting on is authenticated yet.
      const authed = await win.webContents.executeJavaScript(`
        (async () => {
          const res = await fetch('/auth/user/', { credentials: 'include' });
          return res.ok;
        })()
      `);
      return authed ? { portalType: "staff" } : null;
    }

    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const token = window.localStorage.getItem('portal_token');
        const portalType = window.localStorage.getItem('portal_type');
        if (!token || portalType !== ${JSON.stringify(portalType)}) return null;
        ${customerTokenExchangeSnippet(portalType)}
      })()
    `);
    return (result as PortalLoginResult | null) ?? null;
  } catch {
    // executeJavaScript throws if the page is mid-navigation when we poll —
    // expected during the login form submit/redirect, just retry next tick.
    return null;
  }
}

/**
 * Same shape as checkForLogin, but the portal token is handed in (from the
 * OAuth custom-URI callback) rather than read from this window's own
 * localStorage — the window never saw it written, since the actual OAuth
 * flow completed in a different browser entirely. Staff never reaches this
 * path (its Microsoft OAuth is a same-window redirect that completes via
 * checkForLogin's polling instead — see openPortalLoginWindow's doc comment).
 */
async function exchangeTokenForCredentials(
  win: BrowserWindow,
  portalToken: string,
  portalType: "customer" | "vendor",
): Promise<PortalLoginResult | null> {
  try {
    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const token = ${JSON.stringify(portalToken)};
        ${customerTokenExchangeSnippet(portalType)}
      })()
    `);
    return (result as PortalLoginResult | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Only `customer` mints OpenIM chat credentials (`/api/openim/token/` has no
 * equivalent for vendor or staff today — see this file's top comment).
 * `vendor` resolves as soon as its bearer token is confirmed present; the
 * snippet is shared between checkForLogin/exchangeTokenForCredentials rather
 * than duplicated, since both need this exact branch.
 */
function customerTokenExchangeSnippet(portalType: "customer" | "vendor"): string {
  if (portalType === "vendor") {
    return `return { portalType: 'vendor', token };`;
  }
  return `
    const res = await fetch('/api/openim/token/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-Portal-Type': 'customer',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) return null;
    const credentials = await res.json();
    return { portalType: 'customer', ...credentials };
  `;
}
