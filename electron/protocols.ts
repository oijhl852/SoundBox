import fs from "node:fs/promises";
import path from "node:path";
import type { Protocol, IpcMain, WebContents } from "electron";
import { getDragSourceWindow, resolveDragPayload } from "./system.js";
import { guessAudioMime } from "./audio.js";
import type { DragDebugState } from "../src/lib/types.js";

export function createDragDebugStore() {
  let latestDragDebugState: DragDebugState = {
    stage: "idle",
    timestamp: new Date().toISOString(),
    filePath: null,
    iconPath: null,
    senderId: null,
    senderUrl: null,
    windowTitle: null,
    detail: null,
    error: null,
  };

  function setDragDebugState(patch: Partial<DragDebugState>) {
    latestDragDebugState = {
      ...latestDragDebugState,
      ...patch,
      timestamp: new Date().toISOString(),
    };
  }

  function getDragDebugState() {
    return latestDragDebugState;
  }

  return {
    setDragDebugState,
    getDragDebugState,
  };
}

function parseRange(header: string, fileSize: number) {
  const match = header.match(/bytes=(\d+)-(\d*)/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (start >= fileSize || end >= fileSize || start > end) return null;
  return { start, end };
}

export function registerLocalAudioProtocol(protocol: Protocol) {
  protocol.handle("local-audio", async (request) => {
    try {
      const url = new URL(request.url);
      const pathname = decodeURIComponent(url.pathname);
      const normalizedPath = /^\/[A-Za-z]:/.test(pathname) ? pathname.slice(1) : pathname;
      const filePath = path.normalize(`${url.hostname}${normalizedPath}`);
      const fileSize = (await fs.stat(filePath)).size;
      const mime = guessAudioMime(filePath);
      const rangeHeader = request.headers.get("Range");

      if (rangeHeader) {
        const range = parseRange(rangeHeader, fileSize);
        if (range) {
          const { start, end } = range;
          const length = end - start + 1;
          const buffer = Buffer.alloc(length);
          const fd = await fs.open(filePath, "r");
          try {
            await fd.read(buffer, 0, length, start);
          } finally {
            await fd.close();
          }
          return new Response(buffer, {
            status: 206,
            headers: {
              "Content-Type": mime,
              "Content-Range": `bytes ${start}-${end}/${fileSize}`,
              "Content-Length": String(length),
              "Accept-Ranges": "bytes",
            },
          });
        }
      }

      const data = await fs.readFile(filePath);
      return new Response(data, {
        headers: {
          "Content-Type": mime,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (error) {
      console.error("[audio] local-audio protocol failed", { url: request.url, error });
      return new Response("", { status: 404 });
    }
  });
}

export function registerDragOutHandler(
  ipcMain: IpcMain,
  dragStore: ReturnType<typeof createDragDebugStore>
) {
  ipcMain.on("soundbox:drag-out-file", (event, filePath: string, iconPath?: string) => {
    const sourceWindow = getDragSourceWindow(event.sender as WebContents);
    dragStore.setDragDebugState({
      stage: "ipc-received",
      filePath,
      iconPath: iconPath ?? null,
      senderId: event.sender.id,
      senderUrl: event.sender.getURL(),
      windowTitle: sourceWindow?.getTitle() ?? null,
      detail: "主进程已收到拖动请求",
      error: null,
    });

    try {
      const payload = resolveDragPayload(filePath, iconPath);
      event.sender.startDrag({
        file: payload.file,
        icon: payload.icon,
      });

      dragStore.setDragDebugState({
        stage: "start-called",
        filePath,
        iconPath: iconPath ?? null,
        senderId: event.sender.id,
        senderUrl: event.sender.getURL(),
        windowTitle: sourceWindow?.getTitle() ?? null,
        detail: "已调用 event.sender.startDrag",
        error: null,
      });
    } catch (error) {
      dragStore.setDragDebugState({
        stage: "error",
        filePath,
        iconPath: iconPath ?? null,
        senderId: event.sender.id,
        senderUrl: event.sender.getURL(),
        windowTitle: sourceWindow?.getTitle() ?? null,
        detail: "拖动请求执行失败",
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("[drag][main] failed", { filePath, error });
    }
  });
}
