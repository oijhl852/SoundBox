import type { DragDebugState } from "@/lib/types";


export type DropFileInfo = {
  name: string;
  type: string;
  size: number;
};

export type DropEventSnapshot = {
  id: string;
  eventType: string;
  timestamp: string;
  types: string[];
  files: DropFileInfo[];
  plainText: string;
  uriList: string;
  downloadUrl: string;
  effectAllowed: string;
  dropEffect: string;
  itemKinds: string[];
  itemTypes: string[];
};

export function readDataTransferSafely(dataTransfer: DataTransfer, type: string) {
  try {
    return dataTransfer.getData(type) || "";
  } catch {
    return "";
  }
}

export function buildDropEventSnapshot(eventType: string, dataTransfer: DataTransfer): DropEventSnapshot {
  const items = Array.from(dataTransfer.items ?? []);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType,
    timestamp: new Date().toLocaleTimeString(),
    types: Array.from(dataTransfer.types ?? []),
    files: Array.from(dataTransfer.files ?? []).map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    })),
    plainText: readDataTransferSafely(dataTransfer, "text/plain"),
    uriList: readDataTransferSafely(dataTransfer, "text/uri-list"),
    downloadUrl: readDataTransferSafely(dataTransfer, "DownloadURL"),
    effectAllowed: dataTransfer.effectAllowed || "",
    dropEffect: dataTransfer.dropEffect || "",
    itemKinds: items.map((item) => item.kind),
    itemTypes: items.map((item) => item.type),
  };
}

export function buildDropEventSummary(event: DropEventSnapshot | null): string {
  if (!event) {
    return "等待拖放输入";
  }

  return `${event.eventType} | types=${event.types.join(", ") || "(none)"} | files=${event.files.length}`;
}

export function buildDragDebugLines(state: DragDebugState | null): string[] {
  if (!state) {
    return [];
  }

  return [
    `stage: ${state.stage}`,
    `time: ${state.timestamp}`,
    `file: ${state.filePath || "(empty)"}`,
    `icon: ${state.iconPath || "(empty)"}`,
    `senderId: ${state.senderId ?? "(empty)"}`,
    `senderUrl: ${state.senderUrl || "(empty)"}`,
    `windowTitle: ${state.windowTitle || "(empty)"}`,
    `detail: ${state.detail || "(empty)"}`,
    `error: ${state.error || "(empty)"}`,
  ];
}
