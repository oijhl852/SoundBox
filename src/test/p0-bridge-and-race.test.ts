import { describe, expect, it, vi } from "vitest";
import { dragOutFile, getDragDebugState, selectFolder, buildLibrarySnapshot } from "@/lib/api";



describe("P0 bridge contract", () => {
  it("dragOutFile uses sync bridge without throwing", () => {
    const bridge = vi.fn();
    Object.defineProperty(window, "soundbox", {
      configurable: true,
      value: { dragOutFile: bridge },
    });

    expect(() => dragOutFile("C:/demo/test.wav")).not.toThrow();
    expect(bridge).toHaveBeenCalledWith("C:/demo/test.wav", undefined);
  });

  it("dragOutFile does not throw when bridge is missing", () => {
    Object.defineProperty(window, "soundbox", {
      configurable: true,
      value: {},
    });

    expect(() => dragOutFile("C:/demo/test.wav")).not.toThrow();
  });

  it("getDragDebugState reads bridge method", async () => {
    const payload = {
      stage: "idle",
      timestamp: new Date().toISOString(),
      filePath: null,
      iconPath: null,
      senderId: null,
      senderUrl: null,
      windowTitle: null,
      detail: null,
      error: null,
    } as const;

    Object.defineProperty(window, "soundbox", {
      configurable: true,
      value: { getDragDebugState: vi.fn().mockResolvedValue(payload) },
    });

    await expect(getDragDebugState()).resolves.toEqual(payload);
  });

  it("fails fast when required async bridge method is missing", async () => {
    Object.defineProperty(window, "soundbox", {
      configurable: true,
      value: {},
    });

    await expect(selectFolder()).rejects.toThrow("Electron 宿主尚未实现 selectFolder");
  });

  it("fails fast for another required bridge method", async () => {
    Object.defineProperty(window, "soundbox", {
      configurable: true,
      value: {
        selectFolder: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(buildLibrarySnapshot("D:/library")).rejects.toThrow("Electron 宿主尚未实现 buildLibrarySnapshot");
  });
});


