// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Phase 1 login (TASK-062, see NOTICE.md "Login architecture finding"):
// loads the REAL customer-portal login page instead of a native form. Two
// reasons, not one — a native form would additionally have to reimplement
// MFA/password-reset/OAuth, which the real page already does for free — but
// the deciding one is that `POST /api/openim/token/` is gated by
// PortalAuthentication, which requires the request's Origin/Referer to
// actually be the customer portal (api/portal_authentication.py,
// _is_request_from_portal_context). A native Electron HTTP call doesn't
// produce that; a real page loaded from that origin does, for free.
import { BrowserWindow } from "electron";

const DEFAULT_PORTAL_LOGIN_URL = "https://customer.centoffer.com/customer-portal/login";
const PORTAL_LOGIN_URL = process.env.VITE_PORTAL_LOGIN_URL || DEFAULT_PORTAL_LOGIN_URL;

const POLL_INTERVAL_MS = 800;

export interface PortalOpenIMCredentials {
  openimUserID: string;
  token: string;
  expireTimeSeconds: number;
}

interface PendingLogin {
  win: BrowserWindow;
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
 * Opens the customer portal's own login page in a child window. Resolves
 * once the user has actually logged in there, one of two ways:
 *  1. (native form) detected by polling that window's own localStorage for
 *     the `portal_token` the portal's web app already writes on successful
 *     login — see frontend/src/utils/portalAuth.ts `savePortalUser`.
 *  2. (OAuth) the OS's default browser completes the flow instead (Google's
 *     policy blocks embedded-webview logins — see Login.tsx handleOAuth)
 *     and hands the portal token back via a custom `bcsbeam://auth-callback`
 *     URL, caught by electron/main/oauthProtocol.ts, which calls
 *     completeDesktopOAuthLogin() below with that token.
 * Rejects if the window is closed first.
 */
export function openPortalLoginWindow(
  parent?: BrowserWindow,
): Promise<PortalOpenIMCredentials> {
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
      },
    });

    const state: PendingLogin = {
      win,
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

    win.loadURL(PORTAL_LOGIN_URL).catch((err) => {
      state.finish(() => reject(err));
    });

    state.poll = setInterval(() => {
      if (state.settled || win.isDestroyed()) return;
      void checkForLogin(win).then((credentials) => {
        if (credentials) {
          state.finish(() => {
            if (!win.isDestroyed()) win.close();
            resolve(credentials);
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
 * window was already closed some other way).
 */
export async function completeDesktopOAuthLogin(portalToken: string): Promise<boolean> {
  if (!pending || pending.settled || pending.win.isDestroyed()) return false;
  const { win } = pending;
  const credentials = await exchangeTokenForCredentials(win, portalToken);
  if (!credentials) return false;
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
async function checkForLogin(win: BrowserWindow): Promise<PortalOpenIMCredentials | null> {
  try {
    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const token = window.localStorage.getItem('portal_token');
        const portalType = window.localStorage.getItem('portal_type');
        if (!token || portalType !== 'customer') return null;
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
        return res.json();
      })()
    `);
    return (result as PortalOpenIMCredentials | null) ?? null;
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
 * flow completed in a different browser entirely.
 */
async function exchangeTokenForCredentials(
  win: BrowserWindow,
  portalToken: string,
): Promise<PortalOpenIMCredentials | null> {
  try {
    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const res = await fetch('/api/openim/token/', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + ${JSON.stringify(portalToken)},
            'X-Portal-Type': 'customer',
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        if (!res.ok) return null;
        return res.json();
      })()
    `);
    return (result as PortalOpenIMCredentials | null) ?? null;
  } catch {
    return null;
  }
}
