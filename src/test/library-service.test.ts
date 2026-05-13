import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../electron/audio.js", () => ({
  computeContentId: vi.fn(async (filePath: string) => `cid:${path.basename(filePath)}`),
  toRelativePath: vi.fn((rootPath: string, targetPath: string) => path.relative(rootPath, targetPath).replace(/\\/g, "/")),
}));

type LibraryServiceModule = typeof import("../../electron/library.js");

describe("library service", () => {
  let tempRoot: string;
  let appDataDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "soundbox-library-service-"));
    appDataDir = path.join(tempRoot, "appdata");
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("falls back to directory preview when cached file metadata changes", async () => {
    const libraryDir = path.join(tempRoot, "library-a");
    await fs.mkdir(libraryDir, { recursive: true });

    const audioPath = path.join(libraryDir, "track.wav");
    await fs.writeFile(audioPath, "v1");

    const { createLibraryService } = (await import("../../electron/library.js")) as LibraryServiceModule;
    const service = createLibraryService(() => appDataDir);

    const indexed = await service.buildLibraryIndex(libraryDir);
    expect(indexed.indexingComplete).toBe(true);

    await fs.writeFile(audioPath, "v2-updated");

    const snapshot = await service.buildLibrarySnapshot(libraryDir);
    expect(snapshot.usedCache).toBe(false);
    expect(snapshot.indexingComplete).toBe(false);
  });

  it("rebuild replaces stale content instances instead of merging old library data", async () => {
    const libraryDir = path.join(tempRoot, "library-b");
    await fs.mkdir(libraryDir, { recursive: true });

    const firstAudioPath = path.join(libraryDir, "first.wav");
    const secondAudioPath = path.join(libraryDir, "second.wav");
    await fs.writeFile(firstAudioPath, "first-file");
    await fs.writeFile(secondAudioPath, "second-file");

    const { createLibraryService } = (await import("../../electron/library.js")) as LibraryServiceModule;
    const service = createLibraryService(() => appDataDir);

    await service.buildLibraryIndex(libraryDir);

    await fs.rm(firstAudioPath, { force: true });
    await service.buildLibraryIndex(libraryDir);

    const contentIndex = await service.readContentIndexFile();
    expect(contentIndex.contents["cid:first.wav"]).toBeUndefined();
    expect(contentIndex.contents["cid:second.wav"]?.instances).toEqual([
      expect.stringMatching(/:second\.wav$/),
    ]);

  });
});
