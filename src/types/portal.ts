// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// TASK-062 (2026-08-28): shared portal-type contract. Before this, the whole
// client only ever knew one account kind (customer) — hardcoded in
// electron/main/portalLoginWindow.ts. Extending to staff (main internal
// system, Django session-cookie auth) and vendor (Vendor Portal, same
// bearer-token scheme as customer) needs one shared vocabulary both the main
// process (deciding which login URL/auth transport to use) and the renderer
// (LeftNavBar's nav filtering, MainContentLayout's default-route redirect,
// the login screen's picker) agree on.
//
// Kept as a plain runtime module, not a `.d.ts` — both sides need the actual
// DEFAULT_ROUTE_BY_PORTAL_TYPE map, not just a type. Import via `@/types/portal`
// from src/, or a relative path from electron/ — same convention
// electron/preload/index.ts already uses for globalExpose.d.ts, since
// vite-electron-plugin's transform for the main/preload bundles doesn't
// reliably resolve the `@` alias the renderer's vite config defines.
export type PortalType = "customer" | "staff" | "vendor";

export const PORTAL_TYPES: PortalType[] = ["customer", "staff", "vendor"];

// Where each portal type lands after a successful sign-in. Customer keeps
// the existing chat-first landing (this client's original, only purpose);
// staff and vendor have no chat (see PortalLoginResult below) so Tickets is
// the first meaningful page for either.
export const DEFAULT_ROUTE_BY_PORTAL_TYPE: Record<PortalType, string> = {
  customer: "/chat",
  staff: "/tickets",
  vendor: "/tickets",
};

export function getDefaultRouteForPortalType(portalType: PortalType): string {
  return DEFAULT_ROUTE_BY_PORTAL_TYPE[portalType] ?? "/tickets";
}

export function isPortalType(value: unknown): value is PortalType {
  return typeof value === "string" && (PORTAL_TYPES as string[]).includes(value);
}

// Discriminated union replacing the customer-only `PortalOpenIMCredentials`
// portalLoginWindow.ts used to return. Only `customer` carries OpenIM chat
// credentials — `/api/openim/token/` (PortalAuthentication) has no
// credential-minting path for a Django-session staff login or a vendor
// bearer token today, so staff/vendor logins resolve with just the type.
export type PortalLoginResult =
  | {
      portalType: "customer";
      openimUserID: string;
      token: string;
      expireTimeSeconds: number;
    }
  | { portalType: "staff" }
  | { portalType: "vendor"; token: string };
