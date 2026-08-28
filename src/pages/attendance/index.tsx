// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// TASK-062 (2026-08-28, corrected same day per Jack's scope call): vendor-only
// page. Jack's explicit scope for the Vendor account type in v1: engineers
// need to see/use Attendance and FSM tickets here — nothing else yet ("其他
// 需要后续可以慢慢加"). This replaces an earlier Contract Rates page that
// was built ahead of that direction and has been removed. FSM work orders
// live as a tab inside the existing Tickets page (VendorPortal/Layout.tsx's
// own comment: "Field Jobs now live as a tab inside the Tickets page"), so
// no separate FSM page/nav item is needed — src/pages/tickets/index.tsx's
// vendor URL slot already covers it.
//
// Same WebView-into-portal pattern as Tickets — links to the vendor portal's
// own check-in/self-service page (VendorPortalAttendanceSelfService) rather
// than reinventing it here.
import { PortalWebView } from "@/components/PortalWebView";

const DEFAULT_PORTAL_ATTENDANCE_URL =
  "https://resource.centoffer.com/vendor-portal/attendance/check-in";
const PORTAL_ATTENDANCE_URL =
  import.meta.env.VITE_VENDOR_ATTENDANCE_URL || DEFAULT_PORTAL_ATTENDANCE_URL;
const EMBEDDED_PORTAL_ATTENDANCE_URL = `${PORTAL_ATTENDANCE_URL}${
  PORTAL_ATTENDANCE_URL.includes("?") ? "&" : "?"
}embed=1`;

export const Attendance = () => (
  <PortalWebView
    url={EMBEDDED_PORTAL_ATTENDANCE_URL}
    partition="persist:portal-vendor"
  />
);
