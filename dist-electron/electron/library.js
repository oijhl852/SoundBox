import path from "node:path";
import { createLibraryStorage } from "./library-storage.js";
import { buildNameSuggestions, createLibraryId, rebuildNameIndex, } from "./library-domain.js";
import { buildDirectoryPreview, buildTreeFromFileIndex, scanDirectoryWithIndex, } from "./library-scan.js";
import { computeCachedLibrarySignature, computeLibrarySignature, } from "./library-signature.js";
export function createLibraryService(getAppDataDir) {
    const storage = createLibraryStorage(getAppDataDir);
    const { getLocalMetaDir, ensureLocalMetaDir, loadSettingsFile, saveSettingsFile, readFileIndexFile, writeFileIndexFile, readContentIndexFile, writeContentIndexFile, readLocalTagsFile, writeLocalTagsFile, readNameIndexFile, readNameNormalizationConfig, } = storage;
    async function addLibrary(name, libraryPath, libType) {
        const settings = await loadSettingsFile();
        if (settings.libraries.some((library) => library.path === libraryPath)) {
            throw new Error("Library already exists");
        }
        const nextLibrary = {
            name,
            path: libraryPath,
            lib_type: libType,
        };
        await saveSettingsFile({
            ...settings,
            libraries: [...settings.libraries, nextLibrary],
        });
    }
    async function removeLibrary(libraryPath) {
        const settings = await loadSettingsFile();
        await saveSettingsFile({
            ...settings,
            libraries: settings.libraries.filter((library) => library.path !== libraryPath),
        });
    }
    async function buildLibrarySnapshot(libraryPath) {
        const rootPath = path.resolve(libraryPath);
        const fileIndex = await readFileIndexFile();
        const contentIndex = await readContentIndexFile();
        const localTags = await readLocalTagsFile();
        const nameIndex = await readNameIndexFile();
        const normalizationConfig = await readNameNormalizationConfig();
        await ensureLocalMetaDir();
        const libraryId = createLibraryId(rootPath);
        const libraryEntries = fileIndex.files.filter((entry) => entry.libraryId === libraryId);
        const cachedLibraryPathMatches = fileIndex.libraries[libraryId]?.path === rootPath;
        const currentSignature = await computeLibrarySignature(rootPath);
        const cachedSignature = computeCachedLibrarySignature(libraryEntries);
        const cacheLooksFresh = cachedLibraryPathMatches &&
            currentSignature.fileCount === libraryEntries.length &&
            currentSignature.signature === cachedSignature;
        if (cacheLooksFresh && libraryEntries.length > 0) {
            const entriesByDir = new Map();
            for (const entry of libraryEntries) {
                const dir = path.dirname(entry.absolutePath);
                const current = entriesByDir.get(dir) ?? [];
                current.push(entry);
                entriesByDir.set(dir, current);
            }
            return {
                tree: buildTreeFromFileIndex(rootPath, entriesByDir),
                fileIndex,
                contentIndex,
                localTags,
                nameIndex,
                nameSuggestions: buildNameSuggestions(fileIndex, nameIndex, localTags, normalizationConfig.removableTokens),
                usedCache: true,
                indexingComplete: true,
            };
        }
        return {
            tree: await buildDirectoryPreview(rootPath, rootPath),
            fileIndex,
            contentIndex,
            localTags,
            nameIndex,
            nameSuggestions: buildNameSuggestions(fileIndex, nameIndex, localTags, normalizationConfig.removableTokens),
            usedCache: false,
            indexingComplete: false,
        };
    }
    async function buildLibraryIndex(libraryPath) {
        const rootPath = path.resolve(libraryPath);
        const libraryId = createLibraryId(rootPath);
        const libraryName = path.basename(rootPath) || "Root";
        const localTags = await readLocalTagsFile();
        const currentFileIndex = await readFileIndexFile();
        const currentContentIndex = await readContentIndexFile();
        const nextFileEntries = [];
        const nextContentEntries = {};
        const tree = await scanDirectoryWithIndex(rootPath, rootPath, libraryId, libraryName, nextFileEntries, nextContentEntries);
        const mergedFileIndex = {
            ...currentFileIndex,
            libraries: {
                ...currentFileIndex.libraries,
                [libraryId]: {
                    name: libraryName,
                    path: rootPath,
                },
            },
            files: [...currentFileIndex.files.filter((entry) => entry.libraryId !== libraryId), ...nextFileEntries],
        };
        const currentLibraryFileIds = new Set(currentFileIndex.files.filter((entry) => entry.libraryId === libraryId).map((entry) => entry.fileId));
        const retainedContentEntries = Object.fromEntries(Object.entries(currentContentIndex.contents)
            .map(([contentId, entry]) => {
            const remainingInstances = entry.instances.filter((fileId) => !currentLibraryFileIds.has(fileId));
            if (remainingInstances.length === 0) {
                return null;
            }
            return [contentId, { ...entry, instances: remainingInstances }];
        })
            .filter((entry) => Boolean(entry)));
        const mergedContentIndex = {
            ...currentContentIndex,
            contents: {
                ...retainedContentEntries,
                ...nextContentEntries,
            },
        };
        await writeFileIndexFile(mergedFileIndex);
        await writeContentIndexFile(mergedContentIndex);
        const { nameIndex, normalizationConfig } = await rebuildNameIndex(storage, nextFileEntries, localTags, libraryId);
        return {
            tree,
            fileIndex: mergedFileIndex,
            contentIndex: mergedContentIndex,
            localTags,
            nameIndex,
            nameSuggestions: buildNameSuggestions(mergedFileIndex, nameIndex, localTags, normalizationConfig.removableTokens),
            usedCache: false,
            indexingComplete: true,
        };
    }
    /**
     * 从磁盘缓存直接读取库快照，不做签名校验。
     * 启动时快速展示上次索引结果，签名校验由后台 `buildLibraryIndex` 处理。
     */
    async function getCachedSnapshot(libraryPath) {
        const rootPath = path.resolve(libraryPath);
        const fileIndex = await readFileIndexFile();
        const contentIndex = await readContentIndexFile();
        const localTags = await readLocalTagsFile();
        const nameIndex = await readNameIndexFile();
        const normalizationConfig = await readNameNormalizationConfig();
        const libraryId = createLibraryId(rootPath);
        const libraryEntries = fileIndex.files.filter((entry) => entry.libraryId === libraryId);
        if (libraryEntries.length === 0)
            return null;
        const entriesByDir = new Map();
        for (const entry of libraryEntries) {
            const dir = path.dirname(entry.absolutePath);
            const current = entriesByDir.get(dir) ?? [];
            current.push(entry);
            entriesByDir.set(dir, current);
        }
        return {
            tree: buildTreeFromFileIndex(rootPath, entriesByDir),
            fileIndex,
            contentIndex,
            localTags,
            nameIndex,
            nameSuggestions: buildNameSuggestions(fileIndex, nameIndex, localTags, normalizationConfig.removableTokens),
            usedCache: true,
            indexingComplete: true,
        };
    }
    return {
        getLocalMetaDir,
        loadSettingsFile,
        saveSettingsFile,
        readFileIndexFile,
        readContentIndexFile,
        readLocalTagsFile,
        addLibrary,
        removeLibrary,
        buildLibrarySnapshot,
        buildLibraryIndex,
        getCachedSnapshot,
        writeLocalTagsFile,
    };
}
//# sourceMappingURL=library.js.map