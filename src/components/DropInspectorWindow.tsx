import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getDragDebugState } from "@/lib/api";
import { buildDragDebugLines, buildDropEventSnapshot, buildDropEventSummary } from "@/lib/drop-inspector-state";
import type { DropEventSnapshot } from "@/lib/drop-inspector-state";
import type { DragDebugState } from "@/lib/types";

export function DropInspectorWindow() {
  const [events, setEvents] = useState<DropEventSnapshot[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [dragDebugState, setDragDebugState] = useState<DragDebugState | null>(null);

  const latestEvent = events[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    const syncDragState = async () => {
      try {
        const state = await getDragDebugState();
        if (!cancelled) {
          setDragDebugState(state);
        }
      } catch {
        if (!cancelled) {
          setDragDebugState(null);
        }
      }
    };

    void syncDragState();
    const timer = window.setInterval(syncDragState, 800);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const appendEvent = (eventType: string, dataTransfer: DataTransfer | null) => {
    if (!dataTransfer) return;
    const snapshot = buildDropEventSnapshot(eventType, dataTransfer);
    setEvents((prev) => [snapshot, ...prev].slice(0, 40));
  };

  const summary = useMemo(() => buildDropEventSummary(latestEvent), [latestEvent]);
  const dragDebugLines = useMemo(() => buildDragDebugLines(dragDebugState), [dragDebugState]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">拖放观察窗口</h1>
        <p className="text-sm text-muted-foreground mt-1">
          把 Edge / IDM / FL Studio / Soundbox 的拖放对象拖到下面区域，比较它们的 `dataTransfer` 差异。
        </p>
      </div>

      <div
        className={`rounded-xl border-2 border-dashed p-6 min-h-[220px] transition-colors ${isHovering ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsHovering(true);
          appendEvent("dragenter", e.dataTransfer);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!isHovering) setIsHovering(true);
          appendEvent("dragover", e.dataTransfer);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsHovering(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsHovering(false);
          appendEvent("drop", e.dataTransfer);
        }}
      >
        <div className="text-sm font-medium">把拖放对象释放到这里</div>
        <div className="text-xs text-muted-foreground mt-2 break-all">{summary}</div>
      </div>

      <div className="rounded-xl border p-4 bg-card space-y-2">
        <div className="text-sm font-medium">最近一次主进程拖动状态</div>
        {dragDebugState ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {dragDebugLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">暂未读取到主进程拖动状态</div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">已记录 {events.length} 条事件</div>
        <Button variant="outline" size="sm" onClick={() => setEvents([])}>清空记录</Button>
      </div>

      {latestEvent && (
        <div className="rounded-xl border p-4 space-y-3 bg-card">
          <div className="text-sm font-medium">最近一次事件快照</div>
          <div className="text-xs text-muted-foreground">{latestEvent.timestamp} · {latestEvent.eventType}</div>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">types：</span>{(latestEvent.types ?? []).join(", ") || "(none)"}</div>
            <div><span className="font-medium">files：</span>{latestEvent.files?.length ?? 0}</div>
            {(latestEvent.files?.length ?? 0) > 0 && (
              <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
                {(latestEvent.files ?? []).map((file, index) => (
                  <div key={`${file.name}-${index}`}>{file.name} | {file.type || "(no type)"} | {file.size} bytes</div>
                ))}
              </div>
            )}
            <div><span className="font-medium">effectAllowed：</span>{latestEvent.effectAllowed || "(empty)"}</div>
            <div><span className="font-medium">dropEffect：</span>{latestEvent.dropEffect || "(empty)"}</div>
            <div><span className="font-medium">itemKinds：</span>{(latestEvent.itemKinds ?? []).join(", ") || "(empty)"}</div>
            <div><span className="font-medium">itemTypes：</span>{(latestEvent.itemTypes ?? []).join(", ") || "(empty)"}</div>
            <div><span className="font-medium">text/plain：</span>{latestEvent.plainText || "(empty)"}</div>
            <div><span className="font-medium">text/uri-list：</span>{latestEvent.uriList || "(empty)"}</div>
            <div><span className="font-medium">DownloadURL：</span>{latestEvent.downloadUrl || "(empty)"}</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-4 bg-card space-y-2">
        <div className="text-sm font-medium">事件日志</div>
        <div className="max-h-[320px] overflow-auto space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-md border p-3 text-xs space-y-1">
              <div>{event.timestamp} · {event.eventType}</div>
              <div>types: {event.types.join(", ") || "(none)"}</div>
              <div>files: {event.files.length}</div>
            </div>
          ))}
          {events.length === 0 && <div className="text-xs text-muted-foreground">暂无记录</div>}
        </div>
      </div>
    </div>
  );
}
