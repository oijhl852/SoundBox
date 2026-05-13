import path from "node:path";
import fs from "node:fs/promises";
import { computeContentId, toRelativePath } from "./audio.js";
import { isAudioFile } from "./library-domain.js";
import type {
  AudioFile,
  ContentIndexEntry,
  ContentIndexFile,
  FileIndexEntry,
  FolderNode,
} from "../src/lib/types.js";

function sortFolderChildren(children: FolderNode[], files: AudioFile[]) {
  children.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  files.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export async function buildDirectoryPreview(dirPath: string, rootPath: string): Promise<FolderNode> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children: FolderNode[] = [];
  const files: AudioFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      children.push(await buildDirectoryPreview(entryPath, rootPath));
      continue;
    }

    if (!entry.isFile() || !isAudioFile(entryPath)) {
      continue;
    }

    const stats = await fs.stat(entryPath);
    files.push({
      name: entry.name,
      path: entryPath,
      extension: path.extname(entryPath).slice(1),
      size: stats.size,
      relativePath: toRelativePath(rootPath, entryPath),
    });
  }

  sortFolderChildren(children, files);

  return {
    name: path.basename(dirPath) || "Root",
    path: dirPath,
    children,
    files,
  };
}

export function buildTreeFromFileIndex(dirPath: string, entriesByDir: Map<string, FileIndexEntry[]>): FolderNode {
  const childDirs = [...entriesByDir.keys()]
    .filter((candidate) => candidate !== dirPath && path.dirname(candidate) === dirPath)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));

  const files = (entriesByDir.get(dirPath) ?? []).map((entry) => ({
    name: path.basename(entry.absolutePath),
    path: entry.absolutePath,
    extension: entry.extension,
    size: entry.size,
    contentId: entry.contentId,
    relativePath: entry.relativePath,
  }));

  return {
    name: path.basename(dirPath) || "Root",
    path: dirPath,
    children: childDirs.map((childDir) => buildTreeFromFileIndex(childDir, entriesByDir)),
    files,
  };
}

export async function scanDirectoryWithIndex(
  dirPath: string,
  rootPath: string,
  libraryId: string,
  libraryName: string,
  fileEntries: FileIndexEntry[],
  contentIndexEntries: ContentIndexFile["contents"]
): Promise<FolderNode> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children: FolderNode[] = [];
  const files: AudioFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      children.push(
        await scanDirectoryWithIndex(entryPath, rootPath, libraryId, libraryName, fileEntries, contentIndexEntries)
      );
      continue;
    }

    if (!entry.isFile() || !isAudioFile(entryPath)) {
      continue;
    }

    const stats = await fs.stat(entryPath);
    const relativePath = toRelativePath(rootPath, entryPath);
    const contentId = await computeContentId(entryPath);
    const fileId = `${libraryId}:${relativePath}`;

    fileEntries.push({
      fileId,
      libraryId,
      libraryName,
      relativePath,
      absolutePath: entryPath,
      size: stats.size,
      modifiedAt: Math.floor(stats.mtimeMs / 1000),
      extension: path.extname(entryPath).slice(1),
      contentId,
    });

    const existingContent: ContentIndexEntry | undefined = contentIndexEntries[contentId];
    if (existingContent) {
      if (!existingContent.instances.includes(fileId)) {
        existingContent.instances.push(fileId);
      }
      if (!existingContent.canonicalName) {
        existingContent.canonicalName = entry.name;
      }
    } else {
      contentIndexEntries[contentId] = {
        canonicalName: entry.name,
        instances: [fileId],
      };
    }

    files.push({
      name: entry.name,
      path: entryPath,
      extension: path.extname(entryPath).slice(1),
      size: stats.size,
      contentId,
      relativePath,
    });
  }

  sortFolderChildren(children, files);

  return {
    name: path.basename(dirPath) || "Root",
    path: dirPath,
    children,
    files,
  };
}
