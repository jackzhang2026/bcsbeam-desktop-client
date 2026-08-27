import { app } from "electron";
import { join } from "node:path";
import { createMainWindow } from "./windowManage";
import { createTray } from "./trayManage";
import { setIpcMainListener } from "./ipcHandlerManage";
import { setAppGlobalData, setAppListener, setSingleInstance } from "./appManage";
import createAppMenu from "./menuManage";
import { handleProtocolArgv, registerOAuthProtocol } from "./oauthProtocol";
import { isLinux } from "../utils";
import { getLogger } from "../utils/log";
import { initI18n } from "../i18n";

export const logger = getLogger(join(app.getPath("userData"), `/OpenIMData/logs`));

const init = () => {
  initI18n();
  createMainWindow();
  createAppMenu();
  createTray();
  if (process.env.OPENIM_SMOKE_TEST === "1") {
    process.stdout.write("OPENIM_ELECTRON_READY\n");
  }
};

setAppGlobalData();
setIpcMainListener();
// As early as possible (before whenReady) — see oauthProtocol.ts's own
// comment on why registration timing matters for catching a launch URL.
registerOAuthProtocol();
setSingleInstance();
setAppListener(init);
// Windows/Linux: if a bcsbeam:// link launched this process fresh (app
// wasn't already running — the second-instance path in appManage.ts covers
// the far more common "app already open" case), the URL is in THIS
// process's own argv rather than an event.
handleProtocolArgv(process.argv);

app.whenReady().then(() => {
  isLinux ? setTimeout(init, 300) : init();
});
