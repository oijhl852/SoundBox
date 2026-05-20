import type { LocalTagsFile, TagEntry } from "../src/lib/types.js";
import type { AppSettings } from "../src/lib/types.js";

export function createTagService(deps: {
  readLocalTagsFile: () => Promise<LocalTagsFile>;
  writeLocalTagsFile: (localTags: LocalTagsFile) => Promise<void>;
  // 分片存储（v3.0+）
  getTagsBaseDir: (settings: AppSettings) => string;
  readContentTags: (tagsBaseDir: string, contentId: string) => Promise<Record<string, TagEntry[]>>;
  writeContentTags: (tagsBaseDir: string, contentId: string, tags: Record<string, TagEntry[]>) => Promise<void>;
  deleteContentTags: (tagsBaseDir: string, contentId: string) => Promise<void>;
  loadSettings: () => Promise<AppSettings>;
}) {

  async function getTagsBaseDirFromSettings() {
    const settings = await deps.loadSettings();
    return deps.getTagsBaseDir(settings);
  }

  async function addTag(contentId: string, group: string, value: string, author: string) {
    const tagsBaseDir = await getTagsBaseDirFromSettings();
    const currentTags = await deps.readContentTags(tagsBaseDir, contentId);

    const nextTag: TagEntry = {
      value,
      author,
      createdAt: new Date().toISOString(),
      verified: false,
    };

    const groupTags = currentTags[group] ?? [];
    currentTags[group] = [...groupTags, nextTag];

    await deps.writeContentTags(tagsBaseDir, contentId, currentTags);
  }

  async function removeTag(contentId: string, group: string, value: string) {
    const tagsBaseDir = await getTagsBaseDirFromSettings();
    const currentTags = await deps.readContentTags(tagsBaseDir, contentId);

    const groupTags = currentTags[group];
    if (!groupTags) return;

    const nextTags = groupTags.filter((tag: TagEntry) => tag.value !== value);
    if (nextTags.length > 0) {
      currentTags[group] = nextTags;
    } else {
      delete currentTags[group];
    }

    if (Object.keys(currentTags).length > 0) {
      await deps.writeContentTags(tagsBaseDir, contentId, currentTags);
    } else {
      await deps.deleteContentTags(tagsBaseDir, contentId);
    }
  }

  return {
    addTag,
    removeTag,
  };
}
