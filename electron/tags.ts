import type { LocalTagsFile, TagEntry } from "../src/lib/types.js";

export function createTagService(deps: {
  readLocalTagsFile: () => Promise<LocalTagsFile>;
  writeLocalTagsFile: (localTags: LocalTagsFile) => Promise<void>;
}) {
  const { readLocalTagsFile, writeLocalTagsFile } = deps;

  async function addTag(contentId: string, group: string, value: string, author: string) {
    const localTags = await readLocalTagsFile();
    const nextTag: TagEntry = {
      value,
      author,
      createdAt: new Date().toISOString(),
      verified: false,
    };

    const contentRecord = localTags.contents[contentId] ?? { tags: {} };
    const currentGroupTags = contentRecord.tags[group] ?? [];
    contentRecord.tags[group] = [...currentGroupTags, nextTag];
    localTags.contents[contentId] = contentRecord;

    await writeLocalTagsFile(localTags);
  }

  async function removeTag(contentId: string, group: string, value: string) {
    const localTags = await readLocalTagsFile();
    const contentRecord = localTags.contents[contentId];
    if (!contentRecord) return;

    const currentGroupTags = contentRecord.tags[group] ?? [];
    const nextGroupTags = currentGroupTags.filter((tag: TagEntry) => tag.value !== value);

    if (nextGroupTags.length > 0) {
      contentRecord.tags[group] = nextGroupTags;
    } else {
      delete contentRecord.tags[group];
    }

    if (Object.keys(contentRecord.tags).length > 0) {
      localTags.contents[contentId] = contentRecord;
    } else {
      delete localTags.contents[contentId];
    }

    await writeLocalTagsFile(localTags);
  }

  return {
    addTag,
    removeTag,
  };
}
