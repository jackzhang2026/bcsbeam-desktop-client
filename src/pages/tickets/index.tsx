// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Phase 1 §6 step 4 (TASK-062): "tickets" is not reimplemented in this
// client — it's the real, already-authenticated portal/main-system ticket
// pages loaded in place. Same licensing-boundary reasoning as chat login
// (see electron/main/portalLoginWindow.ts): business logic (ticket
// creation/detail/SLA data) stays behind a WebView into the proprietary
// backend/portal, never compiled into this open client shell.
//
// TASK-062 triple-portal extension (2026-08-28): Tickets is the one page
// every portal type has (My Devices/Security are customer-only concepts —
// see src/pages/devices, src/pages/security). URL, embed flag, and session
// partition all now depend on which type is currently signed in.
//
// Auth is free here: the login window (portalLoginWindow.ts) already
// navigated that portal type's own origin, in that type's own persistent
// session partition, and left it signed in there. PortalWebView's <webview>
// joins the SAME partition, so it inherits that session — no second login,
// no token passed in.
//
// `embed=1`: tells the loaded page's own Layout to hide its own sidebar/
// header (see frontend's CustomerPortalLayout.tsx / VendorPortalLayout.tsx /
// components/Layout/index.tsx) — without it, the real page's own nav renders
// a second time inside this client's own LeftNavBar.
import { PortalWebView } from "@/components/PortalWebView";
import { usePortalTypeStore } from "@/store";
import { PortalType } from "@/types/portal";

const DEFAULT_PORTAL_TICKETS_URLS: Record<PortalType, string> = {
  customer: "https://customer.centoffer.com/customer-portal/tickets",
  staff: "https://fin.centoffer.com/tickets",
  vendor: "https://resource.centoffer.com/vendor-portal/tickets",
};

// VITE_PORTAL_TICKETS_URL kept as a back-compat alias for the customer slot
// only, matching portalLoginWindow.ts's VITE_PORTAL_LOGIN_URL convention.
const PORTAL_TICKETS_URLS: Record<PortalType, string> = {
  customer:
    import.meta.env.VITE_CUSTOMER_TICKETS_URL ||
    import.meta.env.VITE_PORTAL_TICKETS_URL ||
    DEFAULT_PORTAL_TICKETS_URLS.customer,
  staff: import.meta.env.VITE_STAFF_TICKETS_URL || DEFAULT_PORTAL_TICKETS_URLS.staff,
  vendor: import.meta.env.VITE_VENDOR_TICKETS_URL || DEFAULT_PORTAL_TICKETS_URLS.vendor,
};

const withEmbedFlag = (url: string) => `${url}${url.includes("?") ? "&" : "?"}embed=1`;

export const Tickets = () => {
  // Falls back to "customer" (this client's original, only portal type)
  // rather than rendering nothing if somehow reached pre-hydration — the
  // store is synchronously hydrated from electron-store at module load
  // (src/store/portalType.ts) and every route here only mounts post-login,
  // so this fallback is defensive, not an expected path.
  const portalType = usePortalTypeStore((state) => state.portalType) ?? "customer";
  return (
    <PortalWebView
      url={withEmbedFlag(PORTAL_TICKETS_URLS[portalType])}
      partition={`persist:portal-${portalType}`}
    />
  );
};
