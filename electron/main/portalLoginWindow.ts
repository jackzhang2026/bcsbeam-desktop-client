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

/**
 * Opens the customer portal's own login page in a child window. Resolves
 * once the user has actually logged in there (detected by polling that
 * window's own localStorage for the `portal_token` the portal's web app
 * already writes on successful login — see frontend/src/utils/portalAuth.ts
 * `savePortalUser`) and the OpenIM token exchange has succeeded. Rejects if
 * the window is closed first.
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

    let settled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (poll) clearInterval(poll);
      fn();
    };

    win.loadURL(PORTAL_LOGIN_URL).catch((err) => {
      finish(() => reject(err));
    });

    poll = setInterval(() => {
      if (settled || win.isDestroyed()) return;
      void checkForLogin(win).then((credentials) => {
        if (credentials) {
          finish(() => {
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
      finish(() => reject(new Error("Login window closed before completing sign-in.")));
    });
  });
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
