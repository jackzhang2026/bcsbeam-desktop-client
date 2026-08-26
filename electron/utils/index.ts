import * as electron from "electron";

export const isLinux = process.platform == "linux";
export const isWin = process.platform == "win32";
export const isMac = process.platform == "darwin";
// `electron.app` only exists in the main process — this module is also
// imported from the preload script (for getDataPath's isProd check), where
// `app` is undefined and `app.isPackaged` used to throw a TypeError that
// killed the whole preload script before contextBridge.exposeInMainWorld
// ran, silently leaving `window.electronAPI` undefined in the renderer.
// `process.defaultApp` is Electron's documented way to detect "launched
// unpackaged" (e.g. `electron .`) from contexts where `app` isn't available.
export const isProd = electron.app ? electron.app.isPackaged : !process.defaultApp;
