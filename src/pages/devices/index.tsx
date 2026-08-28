// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Phase 2 (TASK-062): "My Devices" — same WebView-into-portal pattern as
// Tickets (src/pages/tickets/index.tsx), pointed at the Customer Portal's
// own My Devices page (frontend/src/pages/CustomerPortal/MyDevices.tsx),
// which is what actually calls the backend's customer-scoped device API
// (it_audit/portal_customer_views.py). See PortalWebView for why this
// needs no separate auth step.
//
// TASK-062 (2026-08-28): customer-only page — "my monitored devices" and
// RustDesk pairing don't exist as a staff or vendor concept, so this page is
// never reachable outside a customer session (LeftNavBar only shows it for
// portalType==='customer'). Uses the customer session partition unconditionally
// for the same reason. `embed=1` hides CustomerPortalLayout's own sidebar/
// header — see src/pages/tickets/index.tsx's comment for the full reasoning.
//
// "help me right now" one-click (2026-08-26, upgraded 2026-08-27): the
// desktop shell is the only party that can cheaply answer "which machine is
// this?" — it appends its own OS hostname (getHostname()) AND, when
// available, this machine's own RustDesk connection id (getRustdeskId(),
// an exact match — see electron/preload/index.ts for why there's no
// MeshCentral equivalent) as query params on the portal URL. The portal
// page itself decides what to do with them (prefers the RustDesk id match
// when present, falls back to the hostname guess otherwise) — this
// component owns nothing about that matching, only about telling the guest
// page what machine it's running on.
import { Spin } from "antd";
import { useEffect, useState } from "react";

import { PortalWebView } from "@/components/PortalWebView";

const DEFAULT_PORTAL_DEVICES_URL =
  "https://customer.centoffer.com/customer-portal/devices";
const PORTAL_DEVICES_URL =
  import.meta.env.VITE_PORTAL_DEVICES_URL || DEFAULT_PORTAL_DEVICES_URL;

const buildDevicesUrl = (hostname: string, rustdeskId: string) => {
  const params = new URLSearchParams();
  params.set("embed", "1");
  if (hostname) params.set("localHost", hostname);
  if (rustdeskId) params.set("localRustdeskId", rustdeskId);
  const separator = PORTAL_DEVICES_URL.includes("?") ? "&" : "?";
  return `${PORTAL_DEVICES_URL}${separator}${params.toString()}`;
};

export const Devices = () => {
  // Held until both local-identity lookups resolve (getRustdeskId() is
  // async — it shells out to a subprocess) so the webview's very first
  // navigation already carries whichever params are available, rather than
  // loading once, then reloading a moment later when the RustDesk id shows
  // up. getHostname() is synchronous so this only ever waits on the latter.
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hostname = window.electronAPI?.getHostname?.() || "";
    Promise.resolve(window.electronAPI?.getRustdeskId?.() ?? "")
      .catch(() => "")
      .then((rustdeskId) => {
        if (!cancelled) setUrl(buildDevicesUrl(hostname, rustdeskId));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!url) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-white">
        <Spin />
      </div>
    );
  }
  return <PortalWebView url={url} partition="persist:portal-customer" />;
};
