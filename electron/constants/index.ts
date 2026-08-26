export const IpcMainToRender = {
  appResume: "appResume",
  // Phase 2 (TASK-062): the tray's "Get Remote Support" item lives in the
  // main process (trayManage.ts) but the destination is a React route — it
  // asks the renderer to navigate rather than trying to drive react-router
  // from outside the renderer. Carries the target path as its one arg.
  navigateTo: "navigateTo",
};

export const IpcRenderToMain = {
  showMainWindow: "showMainWindow",
  clearSession: "clearSession",
  minimizeWindow: "minimizeWindow",
  maxmizeWindow: "maxmizeWindow",
  closeWindow: "closeWindow",
  showMessageBox: "showMessageBox",
  setKeyStore: "setKeyStore",
  getKeyStore: "getKeyStore",
  getKeyStoreSync: "getKeyStoreSync",
  showInputContextMenu: "showInputContextMenu",
  getDataPath: "getDataPath",
  portalLogin: "portalLogin",
  openExternal: "openExternal",
};
