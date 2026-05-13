import { BrowserWindow } from "electron";
import path from "node:path";
import { log, logError } from "../src/lib/logger.js";

export function createMainWindow(options: {
  devServerUrl?: string;
  preloadPath: string;
  distIndexPath: string;
}) {
  const { devServerUrl, preloadPath, distIndexPath } = options;

  log("info", "[main] create-window:start");
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Soundbox",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.webContents.on("did-start-loading", () => log("debug", "[main] window:did-start-loading"));
  window.webContents.on("did-finish-load", () => log("debug", "[main] window:did-finish-load"));
  window.webContents.on("did-fail-load", (_event, code, description) => {
    logError("[main] window:did-fail-load", { code, description });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    logError("[main] window:render-process-gone", details);
  });

  if (devServerUrl) {
    log("info", "[main] load-url", devServerUrl);
    void window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return window;
  }

  log("info", "[main] load-file", distIndexPath);
  void window.loadFile(distIndexPath);
  return window;
}

export function resolveWindowPaths(baseDir: string) {
  return {
    preloadPath: path.join(baseDir, "preload.js"),
    distIndexPath: path.join(baseDir, "../dist/index.html"),
  };
}
