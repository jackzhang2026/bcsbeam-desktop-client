// Copyright © 2026 Brocent
// SPDX-License-Identifier: AGPL-3.0-only
//
// TASK-062 (2026-08-28): renderer-side read of "which portal type did this
// install last sign in as". The main process (electron/main/portalLoginWindow.ts)
// is the one that WRITES the `portalType` electron-store key — it's the only
// place that actually knows a login just succeeded, so it's the single
// source of truth. This is only the read side, used to pre-select the
// picker on the login screen so a returning user doesn't have to re-pick
// their type every launch. Same electron-store-via-getKeyStoreSync pattern
// storage.ts's getLocale() already uses.
import { isPortalType, PortalType } from "@/types/portal";

const STORE_KEY = "portalType";

export const getStoredPortalType = (): PortalType | null => {
  const value = window.electronAPI?.ipcSendSync<string | undefined>("getKeyStoreSync", {
    key: STORE_KEY,
  });
  return isPortalType(value) ? value : null;
};
