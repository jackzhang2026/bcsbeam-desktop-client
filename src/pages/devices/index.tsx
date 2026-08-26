// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// Phase 2 (TASK-062): "My Devices" — same WebView-into-portal pattern as
// Tickets (src/pages/tickets/index.tsx), pointed at the Customer Portal's
// own My Devices page (frontend/src/pages/CustomerPortal/MyDevices.tsx),
// which is what actually calls the backend's customer-scoped device API
// (it_audit/portal_customer_views.py). See PortalWebView for why this
// needs no separate auth step.
import { PortalWebView } from "@/components/PortalWebView";

const DEFAULT_PORTAL_DEVICES_URL =
  "https://customer.centoffer.com/customer-portal/devices";
const PORTAL_DEVICES_URL =
  import.meta.env.VITE_PORTAL_DEVICES_URL || DEFAULT_PORTAL_DEVICES_URL;

export const Devices = () => <PortalWebView url={PORTAL_DEVICES_URL} />;
