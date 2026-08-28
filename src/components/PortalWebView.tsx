// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Shared shell for "load a real, already-authenticated customer-portal page
// in place" (Phase 1 §6 step 4's Tickets, Phase 2's My Devices, and whatever
// comes next) — see src/pages/tickets/index.tsx's original comment for the
// full licensing-boundary + shared-session reasoning, not repeated per call
// site now that there's more than one.
import { Spin } from "antd";
import { useEffect, useRef, useState } from "react";

// Not importing electron's own types here: its .d.ts also globally augments
// DOM's `File` interface with a required `path`, which conflicts with this
// repo's own (optional-path) `FileWithPath` used by chat file uploads. A
// narrow local shape for just the one field this component reads is enough.
interface NewWindowEvent extends Event {
  url: string;
}

export const PortalWebView = ({
  url,
  partition,
}: {
  url: string;
  // TASK-062 (2026-08-28): must match the partition the portal type's login
  // window used (electron/main/portalLoginWindow.ts), or this webview opens
  // Electron's default session instead and finds no login there. Left
  // optional/unset for back-compat — an unset partition keeps this
  // component's original single-session behavior.
  partition?: string;
}) => {
  const webviewRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);

  // `did-stop-loading` / `new-window` are Electron-native DOM events fired
  // directly on the <webview> element — not React synthetic props (React's
  // WebViewHTMLAttributes only covers the tag's HTML attributes) — so they
  // have to be wired with addEventListener, not onDidStopLoading/onNewWindow.
  useEffect(() => {
    setLoading(true);
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
  }, [url]);

  return (
    <div className="relative h-full flex-1 bg-white">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <Spin />
        </div>
      )}
      {/* `partition` is a genuine Electron <webview> attribute (session
          isolation, see this component's `partition` prop doc) — react's DOM
          typings don't know about Electron's webview-specific attributes. */}
      <webview
        ref={webviewRef}
        src={url}
        // eslint-disable-next-line react/no-unknown-property
        partition={partition}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};
