import { app, BrowserWindow, ipcMain, protocol } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerLocalAudioProtocol } from "./protocols.js";
import { registerSoundboxIpcHandlers } from "./ipc-handlers.js";
import { createMainWindow, resolveWindowPaths } from "./window.js";
import { log } from "../src/lib/logger.js";

// 自定义协议必须在 app.whenReady() 之前注册为特权方案
// 否则 <audio> <video> 等媒体元素无法加载
protocol.registerSchemesAsPrivileged([
  { scheme: "local-audio", privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } },
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const windowPaths = resolveWindowPaths(__dirname);

app.whenReady().then(() => {
  log("info", "[main] app:ready");
  registerLocalAudioProtocol(protocol);
  registerSoundboxIpcHandlers(ipcMain);
  createMainWindow({
    devServerUrl: DEV_SERVER_URL,
    preloadPath: windowPaths.preloadPath,
    distIndexPath: windowPaths.distIndexPath,
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({
        devServerUrl: DEV_SERVER_URL,
        preloadPath: windowPaths.preloadPath,
        distIndexPath: windowPaths.distIndexPath,
      });
    }
  });
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
