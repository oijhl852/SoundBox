import { describe, expect, it, vi } from "vitest";

// ── mock api ──
vi.mock("@/lib/api", () => ({
  loadSettings: vi.fn(),
  getSyncStatus: vi.fn(),
  buildLibrarySnapshot: vi.fn(),
  buildLibraryIndex: vi.fn(),
}));

// ── mock 依赖模块 ──
vi.mock("@/lib/app-shell-actions", () => ({
  deriveBootstrapState: vi.fn(),
}));

// ── 因为是动态导入，用实际的而非 mock ──
import { resolveLibraryAdd, resolveLibraryRemoval } from "@/lib/library-domain-effects";

describe("library-domain-effects", () => {
  // ────── resolveLibraryAdd ──────

  it("rejects empty library name", async () => {
    const r = await resolveLibraryAdd({
      newLibName: "   ",
      newLibType: "music",
      librariesState: { libraries: [], activeLibrary: "", folderTree: [], selectedFolderPath: null, expandedFolders: new Set(), allFiles: [], tags: {}, nameSuggestions: {}, miniWaveforms: {}, contentIndex: null, libraryLoadState: { status: "idle" } },
      addLibraryAction: vi.fn(),
      selectFolderAction: vi.fn(),
    });
    expect(r).toEqual({ ok: false, reason: "empty-name" });
  });

  it("returns cancelled when folder dialog is cancelled", async () => {
    const r = await resolveLibraryAdd({
      newLibName: "我的素材",
      newLibType: "music",
      librariesState: { libraries: [], activeLibrary: "", folderTree: [], selectedFolderPath: null, expandedFolders: new Set(), allFiles: [], tags: {}, nameSuggestions: {}, miniWaveforms: {}, contentIndex: null, libraryLoadState: { status: "idle" } },
      addLibraryAction: vi.fn(),
      selectFolderAction: vi.fn().mockResolvedValue(null),
    });
    expect(r).toEqual({ ok: false, reason: "cancelled" });
  });

  it("returns new state on successful add", async () => {
    const { loadSettings } = await import("@/lib/api");
    vi.mocked(loadSettings).mockResolvedValue({
      libraries: [{ name: "我的素材", path: "D:/music", type: "music" }],
    });

    const r = await resolveLibraryAdd({
      newLibName: "我的素材",
      newLibType: "music",
      librariesState: { libraries: [], activeLibrary: "", folderTree: [], selectedFolderPath: null, expandedFolders: new Set(), allFiles: [], tags: {}, nameSuggestions: {}, miniWaveforms: {}, contentIndex: null, libraryLoadState: { status: "idle" } },
      addLibraryAction: vi.fn().mockResolvedValue(undefined),
      selectFolderAction: vi.fn().mockResolvedValue("D:/music"),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.path).toBe("D:/music");
      expect(r.nextState.libraries.length).toBe(1);
    }
  });

  it("passes lib name and type from options to addLibraryAction", async () => {
    const { loadSettings } = await import("@/lib/api");
    vi.mocked(loadSettings).mockResolvedValue({
      libraries: [{ name: "音效库", path: "D:/sfx", type: "sound" }],
    });

    const addAction = vi.fn().mockResolvedValue(undefined);
    await resolveLibraryAdd({
      newLibName: "音效库",
      newLibType: "sound",
      librariesState: { libraries: [], activeLibrary: "", folderTree: [], selectedFolderPath: null, expandedFolders: new Set(), allFiles: [], tags: {}, nameSuggestions: {}, miniWaveforms: {}, contentIndex: null, libraryLoadState: { status: "idle" } },
      addLibraryAction: addAction,
      selectFolderAction: vi.fn().mockResolvedValue("D:/sfx"),
    });
    expect(addAction).toHaveBeenCalledWith("音效库", "D:/sfx", "sound");
  });

  // ────── resolveLibraryRemoval ──────

  it("removes library and returns updated state", async () => {
    const { loadSettings } = await import("@/lib/api");
    vi.mocked(loadSettings).mockResolvedValue({ libraries: [] });

    const state = {
      libraries: [{ name: "旧库", path: "D:/old", type: "music" }],
      activeLibrary: "D:/old",
    } as any;
    const next = await resolveLibraryRemoval({
      path: "D:/old",
      librariesState: state,
      removeLibraryAction: vi.fn().mockResolvedValue(undefined),
    });
    expect(next.libraries).toEqual([]);
    expect(next.activeLibrary).toBe("");
  });
});
