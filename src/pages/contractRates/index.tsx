// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// TASK-062 (2026-08-28): vendor-only page. Same WebView-into-portal pattern
// as Tickets (src/pages/tickets/index.tsx) — links to the vendor's own
// already-permission-gated, already-working Contract Rates page
// (frontend's VendorPortalContractRatesViewSet, /vendor-portal/contract-rates)
// rather than reinventing a detail view here. Read-only in the real page
// itself, so nothing further to gate client-side.
import { PortalWebView } from "@/components/PortalWebView";

const DEFAULT_PORTAL_CONTRACT_RATES_URL =
  "https://resource.centoffer.com/vendor-portal/contract-rates";
const PORTAL_CONTRACT_RATES_URL =
  import.meta.env.VITE_VENDOR_CONTRACT_RATES_URL || DEFAULT_PORTAL_CONTRACT_RATES_URL;
const EMBEDDED_PORTAL_CONTRACT_RATES_URL = `${PORTAL_CONTRACT_RATES_URL}${
  PORTAL_CONTRACT_RATES_URL.includes("?") ? "&" : "?"
}embed=1`;

export const ContractRates = () => (
  <PortalWebView
    url={EMBEDDED_PORTAL_CONTRACT_RATES_URL}
    partition="persist:portal-vendor"
  />
);
