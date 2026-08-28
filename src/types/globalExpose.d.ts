import { Platform } from "@openim/wasm-client-sdk";

import { PortalLoginResult, PortalType } from "./portal";

export type DataPath = "public" | "emojiData" | "sdkResources" | "logsPath";

export interface IElectronAPI {
  getDataPath: (key: DataPath) => string;
  getVersion: () => string;
  getPlatform: () => Platform;
  getSystemVersion: () => string;
  /** The local machine's OS hostname (Node's os.hostname()) — used to
   * auto-detect "this computer" in the Devices page's device list, without
   * a server-side round trip. See electron/preload/index.ts. */
  getHostname: () => string;
  /** This machine's own RustDesk connection id, via `rustdesk.exe --get-id`
   * — an exact-match alternative to getHostname() above for the same
   * "this computer" auto-detect. Resolves to "" (never rejects) if RustDesk
   * isn't installed, isn't Windows, or the query fails for any reason —
   * always safe to fall back to getHostname() on an empty result. See
   * electron/preload/index.ts for why no MeshCentral equivalent exists. */
  getRustdeskId: () => Promise<string>;
  subscribe: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  subscribeOnce: (channel: string, callback: (...args: unknown[]) => void) => void;
  unsubscribeAll: (channel: string) => void;
  ipcInvoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  ipcSendSync: <T = unknown>(channel: string, ...args: unknown[]) => T;
  saveFileToDisk: (params: { file: File; sync?: boolean }) => Promise<string>;
  getFileByPath: (filePath: string) => Promise<File | null>;
  /** Opens the given portal type's own real login page in its own window
   * (its own persistent Electron session partition) and resolves once login
   * completes there. Only `customer` carries OpenIM chat credentials in the
   * result — see src/types/portal.ts's PortalLoginResult for why staff/vendor
   * don't. See electron/main/portalLoginWindow.ts. */
  portalLogin: (portalType: PortalType) => Promise<PortalLoginResult>;
  /** Opens an http(s) URL in the OS default browser. Used by the embedded
   * ticket <webview> (src/pages/tickets) for links that try to open in a
   * new tab/window — a bare <webview> has nowhere else to put those. */
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
    userClick: (userID?: string, groupID?: string) => void;
    editRevoke: (clientMsgID: string) => void;
    screenshotPreview: (results: string) => void;
  }
}

declare module "i18next" {
  interface TFunction {
    (key: string, options?: object): string;
  }
}
