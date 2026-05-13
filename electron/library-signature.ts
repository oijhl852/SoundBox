import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { toRelativePath } from "./audio.js";
import { isAudioFile } from "./library-domain.js";
import type { FileIndexEntry } from "../src/lib/types.js";

export async function listAudioFilesForSignature(dirPath: string, results: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await listAudioFilesForSignature(entryPath, results);
      continue;
    }

    if (entry.isFile() && isAudioFile(entryPath)) {
      results.push(entryPath);
    }
  }

  return results;
}

export async function computeLibrarySignature(libraryPath: string) {
  const files = await listAudioFilesForSignature(libraryPath);
  files.sort((a, b) => a.localeCompare(b, "zh-CN"));

  const hash = createHash("sha256");
  for (const filePath of files) {
    const stats = await fs.stat(filePath);
    hash.update(toRelativePath(libraryPath, filePath));
    hash.update(":");
    hash.update(String(stats.size));
    hash.update(":");
    hash.update(String(Math.floor(stats.mtimeMs)));
    hash.update("\n");
  }

  return {
    fileCount: files.length,
    signature: hash.digest("hex"),
  };
}

export function computeCachedLibrarySignature(libraryEntries: FileIndexEntry[]) {
  const cachedSignature = createHash("sha256");
  for (const entry of [...libraryEntries].sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-CN"))) {
    cachedSignature.update(entry.relativePath);
    cachedSignature.update(":");
    cachedSignature.update(String(entry.size));
    cachedSignature.update(":");
    cachedSignature.update(String(Math.floor(entry.modifiedAt * 1000)));
    cachedSignature.update("\n");
  }
  return cachedSignature.digest("hex");
}
