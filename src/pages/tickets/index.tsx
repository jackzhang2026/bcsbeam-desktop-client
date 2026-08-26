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
// and left it signed in there. PortalWebView's <webview> uses that same
// default session/partition, so it inherits the portal's localStorage
// session — no second login, no token passed in.
import { PortalWebView } from "@/components/PortalWebView";

const DEFAULT_PORTAL_TICKETS_URL =
  "https://customer.centoffer.com/customer-portal/tickets";
const PORTAL_TICKETS_URL =
  import.meta.env.VITE_PORTAL_TICKETS_URL || DEFAULT_PORTAL_TICKETS_URL;

export const Tickets = () => <PortalWebView url={PORTAL_TICKETS_URL} />;
