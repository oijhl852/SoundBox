import { describe, expect, it } from "vitest";
import { clampSidebarWidth, deriveBootstrapState, getMissingMiniWaveformFiles } from "@/lib/app-shell-actions";
import { mergeMiniWaveforms } from "@/lib/app-effects";

describe("app-shell-actions", () => {
  it("derives empty bootstrap state when there are no libraries", () => {
    const result = deriveBootstrapState(
      {
        libraries: [],
        waveform_cache_path: null,
        tag_storage_mode: "local",
        custom_tag_path: null,
      },
      null
    );

    expect(result.activeLibrary).toBe("");
    expect(result.libraryLoadState.message).toBe("请先添加素材库");
  });

  it("clamps sidebar width to allowed range", () => {
    expect(clampSidebarWidth(100)).toBe(180);
    expect(clampSidebarWidth(260)).toBe(260);
    expect(clampSidebarWidth(999)).toBe(480);
  });

  it("finds missing mini waveforms and merges only new entries", () => {
    const files = [
      { name: "A.wav", path: "A", folder: "fx" },
      { name: "B.wav", path: "B", folder: "fx" },
    ];
    expect(getMissingMiniWaveformFiles(files, { A: [1, 2] })).toEqual([{ name: "B.wav", path: "B", folder: "fx" }]);
    expect(mergeMiniWaveforms({ A: [1] }, [["A", [9]], ["B", [2, 3]]] as const)).toEqual({ A: [1], B: [2, 3] });
  });
});
