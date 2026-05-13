import { describe, expect, it } from "vitest";
import { buildDragDebugViewModel } from "@/lib/drag-debug-view-model";


describe("drag-debug-view-model", () => {

  it("returns null summary when drag debug state is absent", () => {
    expect(buildDragDebugViewModel(null)).toBeNull();
  });

  it("keeps key fields needed by app shell", () => {
    expect(
      buildDragDebugViewModel({

        stage: "ipc-received",
        timestamp: "2026-04-04T00:00:00.000Z",
        filePath: "A",
        iconPath: null,
        senderId: 1,
        senderUrl: "app://test",
        windowTitle: "Soundbox",
        detail: "ready",
        error: null,
      })
    ).toEqual({
      stage: "ipc-received",
      detail: "ready",
      error: null,
    });
  });
});
