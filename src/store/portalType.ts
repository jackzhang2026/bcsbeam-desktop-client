// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// TASK-062 (2026-08-28): current session's portal type (customer/staff/
// vendor), consumed by LeftNavBar (nav filtering), MainContentLayout (default
// landing route), and the three embedded webview page wrappers (which base
// URL + Electron session partition to use). Kept separate from useUserStore
// (src/store/user.ts) deliberately — that store is OpenIM-chat-identity
// shaped (BusinessUserInfo, IMSDK sync state, ...) and staff/vendor sessions
// never touch OpenIM at all, so folding this in would mean either faking chat
// fields for two of the three portal types or scattering `if (portalType)`
// guards through unrelated chat plumbing.
import { create } from "zustand";

import { PortalType } from "@/types/portal";
import { getStoredPortalType } from "@/utils/portalType";

interface PortalTypeStore {
  // null until Login.tsx's picker is used or portalLogin() resolves — most
  // of the app tree only ever mounts post-login (see routes/index.tsx), so
  // in practice this is non-null everywhere except the login screen itself.
  portalType: PortalType | null;
  setPortalType: (portalType: PortalType) => void;
}

export const usePortalTypeStore = create<PortalTypeStore>()((set) => ({
  // Hydrated once at module load from electron-store's last-known value —
  // purely a UX nicety (pre-selecting the picker); the actual login flow
  // always re-derives and re-persists this from whichever login just
  // succeeded, so a stale/missing value here never grants access to anything.
  portalType: getStoredPortalType(),
  setPortalType: (portalType) => set({ portalType }),
}));
