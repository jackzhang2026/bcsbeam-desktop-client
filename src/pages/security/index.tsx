// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Original vision gap-closing (2026-08-27): BCS_BEAM_WINDOWS_CLIENT_PLAN_20260824.md
// §0 named "an embedded WebView into the customer portal (ticket viewing,
// TOTP settings)" as part of this client's scope — Tickets shipped in Phase
// 1, TOTP settings never did. The customer portal itself had NO TOTP/MFA
// feature at all until this same pass (backend/customers' MFA port, mirroring
// the vendor portal's already-shipped one) — this page is just the last,
// mechanical step: point a WebView at it, same pattern as Tickets/Devices.
// See PortalWebView / Tickets' original comment for the full licensing/
// session-inheritance reasoning, not repeated per call site.
// TASK-062 (2026-08-28): customer-only page, same reasoning as
// src/pages/devices/index.tsx — MFA/TOTP settings here are the customer
// portal's own; staff/vendor have no equivalent surfaced in this client.
import { PortalWebView } from "@/components/PortalWebView";

const DEFAULT_PORTAL_SECURITY_URL =
  "https://customer.centoffer.com/customer-portal/settings/security";
const PORTAL_SECURITY_URL =
  import.meta.env.VITE_PORTAL_SECURITY_URL || DEFAULT_PORTAL_SECURITY_URL;
const EMBEDDED_PORTAL_SECURITY_URL = `${PORTAL_SECURITY_URL}${
  PORTAL_SECURITY_URL.includes("?") ? "&" : "?"
}embed=1`;

export const Security = () => (
  <PortalWebView
    url={EMBEDDED_PORTAL_SECURITY_URL}
    partition="persist:portal-customer"
  />
);
