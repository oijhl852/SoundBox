import { describe, expect, it } from "vitest";
import { createEmptyLibraryResult, createLibrarySelectionResult } from "@/lib/library-management-actions";

describe("library-management-actions", () => {
  it("returns empty state when libraries list is empty", () => {
    expect(createEmptyLibraryResult()).toEqual({
      libraries: [],
      activeLibrary: "",
      libraryLoadState: { status: "idle", message: "请先添加素材库" },
    });
  });

  it("prefers requested active library when it still exists", () => {
    const result = createLibrarySelectionResult(
      {
        libraries: [
          { name: "A", path: "A", lib_type: "music" },
          { name: "B", path: "B", lib_type: "sfx" },
        ],
        waveform_cache_path: null,
        tag_storage_mode: "local",
        custom_tag_path: null,
      },
      "B"
    );

    expect(result.activeLibrary).toBe("B");
    expect(result.libraries).toHaveLength(2);
  });
});
