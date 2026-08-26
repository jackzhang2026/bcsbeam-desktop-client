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
// "help me right now" one-click (2026-08-26): the desktop shell is the only
// party that can cheaply answer "which machine is this?" — it appends its
// own OS hostname (getHostname(), Node's os.hostname(), exposed by
// electron/preload) as a `localHost` query param on the portal URL. The
// portal page itself decides what to do with it (best-effort match against
// the customer's device list, offer a one-click request-support action if
// exactly one device matches) — this component owns nothing about that
// matching, only about telling the guest page what machine it's running on.
import { PortalWebView } from "@/components/PortalWebView";

const DEFAULT_PORTAL_DEVICES_URL =
  "https://customer.centoffer.com/customer-portal/devices";
const PORTAL_DEVICES_URL =
  import.meta.env.VITE_PORTAL_DEVICES_URL || DEFAULT_PORTAL_DEVICES_URL;

const buildDevicesUrl = () => {
  const hostname = window.electronAPI?.getHostname?.() || "";
  if (!hostname) return PORTAL_DEVICES_URL;
  const separator = PORTAL_DEVICES_URL.includes("?") ? "&" : "?";
  return `${PORTAL_DEVICES_URL}${separator}localHost=${encodeURIComponent(hostname)}`;
};

export const Devices = () => <PortalWebView url={buildDevicesUrl()} />;
