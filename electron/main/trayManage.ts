import { app, Menu, Tray } from "electron";
import { t } from "i18next";
import { IpcMainToRender } from "../constants";
import { hideWindow, sendEvent, showWindow } from "./windowManage";

let appTray: Tray;

export const createTray = () => {
  const trayMenu = Menu.buildFromTemplate([
    {
      label: t("system.showWindow"),
      click: showWindow,
    },
    {
      label: t("system.hideWindow"),
      click: hideWindow,
    },
    { type: "separator" },
    {
      // Phase 2 (TASK-062): the "unified client" tray is meant to be a
      // nicer front door onto the existing support-intake queue, not a new
      // remote-control implementation (handoff doc §3.5) — this just
      // surfaces the already-built My Devices page (its own
      // per-device "Request Support" button does the actual work) rather
      // than reimplementing device selection here.
      label: t("system.remoteSupport"),
      click: () => {
        showWindow();
        sendEvent(IpcMainToRender.navigateTo, "/devices");
      },
    },
    {
      label: t("system.toggleDevTools"),
      role: "toggleDevTools",
    },
    {
      label: t("system.quit"),
      click: () => {
        global.forceQuit = true;
        app.quit();
      },
    },
  ]);
  appTray = new Tray(global.pathConfig.trayIcon);
  appTray.setToolTip(app.getName());
  appTray.setIgnoreDoubleClickEvents(true);
  appTray.on("click", showWindow);

  appTray.setContextMenu(trayMenu);
};

export const destroyTray = () => {
  if (!appTray || appTray.isDestroyed()) return;
  appTray.destroy();
  appTray = null;
};
