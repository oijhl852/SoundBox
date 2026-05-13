import { describe, expect, it } from "vitest";
import { buildDragDebugLines, buildDropEventSummary } from "@/lib/drop-inspector-state";

describe("drop-inspector-state", () => {
  it("builds empty summary for missing event", () => {
    expect(buildDropEventSummary(null)).toBe("等待拖放输入");
  });

  it("builds readable drag debug lines", () => {
    const lines = buildDragDebugLines({
      stage: "idle",
      timestamp: "2026-04-04T00:00:00.000Z",
      filePath: null,
      iconPath: null,
      senderId: null,
      senderUrl: null,
      windowTitle: null,
      detail: "ready",
      error: null,
    });

    expect(lines[0]).toContain("stage: idle");
    expect(lines[7]).toContain("detail: ready");
  });
});
