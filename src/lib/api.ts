import { invoke } from "@tauri-apps/api/core";
import type { ContentIndexFile, FileIndexFile, FolderNode, LibrarySnapshot, LocalTagsFile, SyncStatus } from "./types";

export interface LibraryConfig {
  name: string;
  path: string;
  lib_type: string;
}

export interface AppSettings {
  libraries: LibraryConfig[];
  waveform_cache_path: string | null;
  tag_storage_mode: string;
  custom_tag_path: string | null;
}

export async function selectFolder(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择素材库文件夹",
    });
    return selected as string | null;
  } catch (e) {
    console.error("Failed to open folder dialog:", e);
    return null;
  }
}

export async function scanDirectory(path: string): Promise<FolderNode> {
  return invoke<FolderNode>("scan_directory", { path });
}

export async function buildLibrarySnapshot(path: string): Promise<LibrarySnapshot> {
  return invoke<LibrarySnapshot>("build_library_snapshot", { path });
}

export async function buildLibraryIndex(path: string): Promise<LibrarySnapshot> {
  return invoke<LibrarySnapshot>("build_library_index", { path });
}

export async function readFileIndex(): Promise<FileIndexFile> {
  return invoke<FileIndexFile>("read_file_index");
}

export async function readContentIndex(): Promise<ContentIndexFile> {
  return invoke<ContentIndexFile>("read_content_index");
}

export async function readLocalTags(): Promise<LocalTagsFile> {
  return invoke<LocalTagsFile>("read_local_tags");
}

export async function addTag(
  contentId: string,
  group: string,
  value: string,
  author: string = "user"
): Promise<void> {
  return invoke("add_tag", { contentId, group, value, author });
}

export async function removeTag(contentId: string, group: string, value: string): Promise<void> {
  return invoke("remove_tag", { contentId, group, value });
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function addLibrary(name: string, path: string, libType: string): Promise<void> {
  return invoke("add_library", { name, path, libType });
}

export async function removeLibrary(path: string): Promise<void> {
  return invoke("remove_library", { path });
}

export async function getAudioData(path: string): Promise<string> {
  return invoke<string>("get_audio_data", { path });
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return invoke<SyncStatus>("get_sync_status");
}