// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Phase 1 §6 step 4 (TASK-062): "tickets" is not reimplemented in this
// client — it's the real, already-authenticated customer-portal ticket
// pages loaded in place. Same licensing-boundary reasoning as chat login
// (see electron/main/portalLoginWindow.ts): business logic (ticket
// creation/detail/SLA data) stays behind a WebView into the proprietary
// backend/portal, never compiled into this open client shell.
//
// Auth is free here: the login window (portalLoginWindow.ts) already
// navigated the customer portal's own origin in Electron's default session
// and left it signed in there. This <webview> uses that same default
// session/partition, so it inherits the portal's localStorage session —
// no second login, no token passed in.
import { Spin } from "antd";
import { useEffect, useRef, useState } from "react";

const DEFAULT_PORTAL_TICKETS_URL =
  "https://customer.centoffer.com/customer-portal/tickets";
const PORTAL_TICKETS_URL =
  import.meta.env.VITE_PORTAL_TICKETS_URL || DEFAULT_PORTAL_TICKETS_URL;

// Not importing electron's own types here: its .d.ts also globally augments
// DOM's `File` interface with a required `path`, which conflicts with this
// repo's own (optional-path) `FileWithPath` used by chat file uploads. A
// narrow local shape for just the one field this page reads is enough.
interface NewWindowEvent extends Event {
  url: string;
}

export const Tickets = () => {
  const webviewRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);

  // `did-stop-loading` / `new-window` are Electron-native DOM events fired
  // directly on the <webview> element — not React synthetic props (React's
  // WebViewHTMLAttributes only covers the tag's HTML attributes) — so they
  // have to be wired with addEventListener, not onDidStopLoading/onNewWindow.
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStopLoading = () => setLoading(false);
    // Links the portal page tries to open in a new tab (e.g. an attachment,
    // an external doc link) have nowhere to go inside a bare <webview> —
    // hand them to the OS browser instead, same treatment the main window
    // gives its own outbound links (see windowManage.ts's
    // setWindowOpenHandler).
    const handleNewWindow = (event: Event) => {
      void window.electronAPI?.openExternal((event as NewWindowEvent).url);
    };

    webview.addEventListener("did-stop-loading", handleStopLoading);
    webview.addEventListener("new-window", handleNewWindow);
    return () => {
      webview.removeEventListener("did-stop-loading", handleStopLoading);
      webview.removeEventListener("new-window", handleNewWindow);
    };
  }, []);

  return (
    <div className="relative h-full flex-1 bg-white">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <Spin />
        </div>
      )}
      <webview
        ref={webviewRef}
        src={PORTAL_TICKETS_URL}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};
