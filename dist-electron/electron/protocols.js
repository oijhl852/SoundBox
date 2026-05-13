import fs from "node:fs/promises";
import path from "node:path";
import { getDragSourceWindow, resolveDragPayload } from "./system.js";
import { guessAudioMime } from "./audio.js";
export function createDragDebugStore() {
    let latestDragDebugState = {
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
    function setDragDebugState(patch) {
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
export function registerLocalAudioProtocol(protocol) {
    protocol.handle("local-audio", async (request) => {
        try {
            const url = new URL(request.url);
            const pathname = decodeURIComponent(url.pathname);
            const normalizedPath = /^\/[A-Za-z]:/.test(pathname) ? pathname.slice(1) : pathname;
            const filePath = path.normalize(`${url.hostname}${normalizedPath}`);
            const data = await fs.readFile(filePath);
            return new Response(data, {
                headers: {
                    "Content-Type": guessAudioMime(filePath),
                },
            });
        }
        catch (error) {
            console.error("[audio] local-audio protocol failed", { url: request.url, error });
            return new Response("", { status: 404 });
        }
    });
}
export function registerDragOutHandler(ipcMain, dragStore) {
    ipcMain.on("soundbox:drag-out-file", (event, filePath, iconPath) => {
        const sourceWindow = getDragSourceWindow(event.sender);
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
        }
        catch (error) {
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
//# sourceMappingURL=protocols.js.map