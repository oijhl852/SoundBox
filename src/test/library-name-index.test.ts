import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../electron/audio.js", () => ({
  computeContentId: vi.fn(async (filePath: string) => `cid:${path.basename(filePath)}`),
  toRelativePath: vi.fn((rootPath: string, targetPath: string) => path.relative(rootPath, targetPath).replace(/\\/g, "/")),
}));

type LibraryServiceModule = typeof import("../../electron/library.js");

describe("library name index cleanup", () => {
  let tempRoot: string;
  let appDataDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "soundbox-library-name-index-"));
    appDataDir = path.join(tempRoot, "appdata");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("removes deleted content ids from name index when rebuilding a library", async () => {
    const libraryDir = path.join(tempRoot, "library-name-index");
    await fs.mkdir(libraryDir, { recursive: true });

    const firstAudioPath = path.join(libraryDir, "theme copy.wav");
    const secondAudioPath = path.join(libraryDir, "theme.wav");
    await fs.writeFile(firstAudioPath, "first-theme");
    await fs.writeFile(secondAudioPath, "second-theme");

    const { createLibraryService } = (await import("../../electron/library.js")) as LibraryServiceModule;
    const service = createLibraryService(() => appDataDir);

    await service.buildLibraryIndex(libraryDir);

    await fs.rm(firstAudioPath, { force: true });
    await service.buildLibraryIndex(libraryDir);

    const nameIndexPath = path.join(appDataDir, "local-meta", "name-index.json");
    const nameIndex = JSON.parse(await fs.readFile(nameIndexPath, "utf-8")) as {
      names: Record<string, { contentIds: string[]; tagHints: Record<string, string[]>; updatedAt: string }>;
    };

    expect(nameIndex.names.theme?.contentIds).toEqual(["cid:theme.wav"]);
    expect(nameIndex.names.theme?.contentIds).not.toContain("cid:theme copy.wav");
  });
});
