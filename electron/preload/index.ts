import fs from "fs";
import os from "os";
import path from "path";
import { DataPath, IElectronAPI } from "./../../src/types/globalExpose.d";
import { contextBridge, ipcRenderer } from "electron";
import { isProd } from "../utils";
import "@openim/electron-client-sdk/lib/preload";

// NOT `import { Platform } from "@openim/wasm-client-sdk"` at the top level:
// that package's module top-level unconditionally calls initWorker(), which
// constructs `new URL('index.js', document.baseURI)` — and at the point this
// preload script first runs (before the window's loadURL()/loadFile() has
// navigated), `document.baseURI` is still "about:blank", which throws
// "Failed to construct 'URL': Invalid URL". That exception used to kill the
// whole preload script before contextBridge.exposeInMainWorld ran, silently
// leaving `window.electronAPI` undefined in every renderer. Deferring the
// require until getPlatform() is actually called (well after real
// navigation, when document.baseURI is a real URL) avoids it.
const getPlatform = () => {
  const { Platform } = require("@openim/wasm-client-sdk");
  if (process.platform === "darwin") {
    return Platform.MacOSX;
  }
  if (process.platform === "win32") {
    return Platform.Windows;
  }
  return Platform.Linux;
};

const getDataPath = (key: DataPath) => {
  switch (key) {
    case "public":
      return isProd ? ipcRenderer.sendSync("getDataPath", "public") : "";
    case "sdkResources":
      return isProd ? ipcRenderer.sendSync("getDataPath", "sdkResources") : "";
    case "logsPath":
      return isProd ? ipcRenderer.sendSync("getDataPath", "logsPath") : "";
    default:
      return "";
  }
};

const subscribe = (channel: string, callback: (...args: any[]) => void) => {
  const subscription = (_, ...args) => callback(...args);
  ipcRenderer.on(channel, subscription);
  return () => ipcRenderer.removeListener(channel, subscription);
};

const subscribeOnce = (channel: string, callback: (...args: any[]) => void) => {
  ipcRenderer.once(channel, (_, ...args) => callback(...args));
};

const unsubscribeAll = (channel: string) => {
  ipcRenderer.removeAllListeners(channel);
};

const ipcInvoke = (channel: string, ...arg: any) => {
  return ipcRenderer.invoke(channel, ...arg);
};

const ipcSendSync = (channel: string, ...arg: any) => {
  return ipcRenderer.sendSync(channel, ...arg);
};

const getUniqueSavePath = (originalPath: string) => {
  let counter = 0;
  let savePath = originalPath;
  let fileDir = path.dirname(originalPath);
  let fileName = path.basename(originalPath);
  let fileExt = path.extname(originalPath);
  let baseName = path.basename(fileName, fileExt);

  while (fs.existsSync(savePath)) {
    counter++;
    fileName = `${baseName}(${counter})${fileExt}`;
    savePath = path.join(fileDir, fileName);
  }

  return savePath;
};

const getFileByPath = async (filePath: string) => {
  try {
    const filename = path.basename(filePath);
    const data = await fs.promises.readFile(filePath);
    return new File([data], filename);
  } catch (error) {
    console.log(error);
    return null;
  }
};

const saveFileToDisk = async ({
  file,
  sync,
}: {
  file: File;
  sync?: boolean;
}): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const saveDir = ipcRenderer.sendSync("getDataPath", "sdkResources");
  const savePath = path.join(saveDir, file.name);
  const uniqueSavePath = getUniqueSavePath(savePath);
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }
  if (sync) {
    await fs.promises.writeFile(uniqueSavePath, Buffer.from(arrayBuffer));
  } else {
    fs.promises.writeFile(uniqueSavePath, Buffer.from(arrayBuffer));
  }
  return uniqueSavePath;
};

const portalLogin = () => ipcRenderer.invoke("portalLogin");
const openExternal = (url: string) => ipcRenderer.invoke("openExternal", url);

// Phase 2 (TASK-062): lets the Devices page (src/pages/devices) tell the
// customer portal's My Devices list which of the customer's devices IS the
// machine the click came from, so it can offer a true one-click "request
// support for this computer" instead of always making the user pick from a
// list — see src/pages/devices/index.tsx. Same style as getSystemVersion
// (a direct, synchronous Node call, not an ipcRenderer round trip — the
// preload script always has full Node access regardless of contextIsolation).
const getHostname = () => os.hostname();

const Api: IElectronAPI = {
  getDataPath,
  getVersion: () => process.version,
  getPlatform,
  getSystemVersion: process.getSystemVersion,
  getHostname,
  subscribe,
  subscribeOnce,
  unsubscribeAll,
  ipcInvoke,
  ipcSendSync,
  getFileByPath,
  saveFileToDisk,
  portalLogin,
  openExternal,
};

contextBridge.exposeInMainWorld("electronAPI", Api);
