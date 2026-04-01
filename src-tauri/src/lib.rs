use base64::Engine;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioFile {
    pub name: String,
    pub path: String,
    pub extension: String,
    pub size: u64,
    pub content_id: Option<String>,
    pub relative_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderNode {
    pub name: String,
    pub path: String,
    pub children: Vec<FolderNode>,
    pub files: Vec<AudioFile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagEntry {
    pub value: String,
    pub author: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub verified: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContentTagRecord {
    pub tags: HashMap<String, Vec<TagEntry>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalTagsFile {
    pub version: String,
    pub users: Option<HashMap<String, serde_json::Value>>,
    pub contents: HashMap<String, ContentTagRecord>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub libraries: Vec<LibraryConfig>,
    pub waveform_cache_path: Option<String>,
    pub tag_storage_mode: String,
    pub custom_tag_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryConfig {
    pub name: String,
    pub path: String,
    pub lib_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileIndexLibraryInfo {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileIndexEntry {
    pub file_id: String,
    pub library_id: String,
    pub library_name: Option<String>,
    pub relative_path: String,
    pub absolute_path: String,
    pub size: u64,
    pub modified_at: i64,
    pub extension: String,
    pub content_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileIndexFile {
    pub version: String,
    pub libraries: HashMap<String, FileIndexLibraryInfo>,
    pub files: Vec<FileIndexEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContentIndexEntry {
    pub canonical_name: String,
    pub instances: Vec<String>,
    pub waveform_cache: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContentIndexFile {
    pub version: String,
    pub contents: HashMap<String, ContentIndexEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibrarySnapshot {
    pub tree: FolderNode,
    pub file_index: FileIndexFile,
    pub content_index: ContentIndexFile,
    pub local_tags: LocalTagsFile,
    pub used_cache: bool,
    pub indexing_complete: bool,
}

const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "m4a"];

fn is_audio_file(path: &PathBuf) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn get_app_data_dir() -> PathBuf {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(app_data).join("TheArcaneCrate")
}

fn ensure_app_data_dir() -> std::io::Result<PathBuf> {
    let dir = get_app_data_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

fn ensure_local_meta_dir() -> std::io::Result<PathBuf> {
    let dir = get_app_data_dir().join("local-meta");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

fn settings_path() -> PathBuf {
    get_app_data_dir().join("settings.json")
}

fn file_index_path() -> PathBuf {
    get_app_data_dir().join("local-meta").join("file-index.json")
}

fn content_index_path() -> PathBuf {
    get_app_data_dir().join("local-meta").join("content-index.json")
}

fn local_tags_path() -> PathBuf {
    get_app_data_dir().join("local-meta").join("local-tags.json")
}

fn compute_content_id(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| format!("Failed to open file for hash: {}", e))?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read file for hash: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let hash = hex::encode(hasher.finalize()).to_uppercase();
    Ok(format!("sha256:{}", hash))
}

fn modified_at(path: &Path) -> i64 {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default()
}

fn library_id_from_path(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    let hash = hex::encode(hasher.finalize());
    format!("lib-{}", &hash[..12])
}

fn read_local_tags_internal() -> Result<LocalTagsFile, String> {
    let path = local_tags_path();
    if !path.exists() {
        return Ok(LocalTagsFile {
            version: "2.0".to_string(),
            users: None,
            contents: HashMap::new(),
            settings: None,
        });
    }

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read local tags: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse local tags: {}", e))
}

fn write_local_tags_internal(data: &LocalTagsFile) -> Result<(), String> {
    ensure_local_meta_dir().map_err(|e| format!("Failed to create local-meta dir: {}", e))?;
    let content = serde_json::to_string_pretty(data).map_err(|e| format!("Failed to serialize local tags: {}", e))?;
    fs::write(local_tags_path(), content).map_err(|e| format!("Failed to write local tags: {}", e))
}

fn read_file_index_internal() -> Result<FileIndexFile, String> {
    let path = file_index_path();
    if !path.exists() {
        return Ok(FileIndexFile {
            version: "2.0".to_string(),
            libraries: HashMap::new(),
            files: vec![],
        });
    }
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file index: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse file index: {}", e))
}

fn write_file_index_internal(data: &FileIndexFile) -> Result<(), String> {
    ensure_local_meta_dir().map_err(|e| format!("Failed to create local-meta dir: {}", e))?;
    let content = serde_json::to_string_pretty(data).map_err(|e| format!("Failed to serialize file index: {}", e))?;
    fs::write(file_index_path(), content).map_err(|e| format!("Failed to write file index: {}", e))
}

fn read_content_index_internal() -> Result<ContentIndexFile, String> {
    let path = content_index_path();
    if !path.exists() {
        return Ok(ContentIndexFile {
            version: "2.0".to_string(),
            contents: HashMap::new(),
        });
    }
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read content index: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse content index: {}", e))
}

fn write_content_index_internal(data: &ContentIndexFile) -> Result<(), String> {
    ensure_local_meta_dir().map_err(|e| format!("Failed to create local-meta dir: {}", e))?;
    let content = serde_json::to_string_pretty(data).map_err(|e| format!("Failed to serialize content index: {}", e))?;
    fs::write(content_index_path(), content).map_err(|e| format!("Failed to write content index: {}", e))
}

fn build_directory_preview(dir_path: &Path, root_path: &Path) -> Result<FolderNode, String> {
    let name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Root".to_string());

    let mut children = Vec::new();
    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();

            if entry_name.starts_with('.') {
                continue;
            }

            if entry_path.is_dir() {
                children.push(build_directory_preview(&entry_path, root_path)?);
            } else if is_audio_file(&entry_path) {
                let extension = entry_path
                    .extension()
                    .map(|e| e.to_string_lossy().to_string())
                    .unwrap_or_default();
                let relative_path = entry_path
                    .strip_prefix(root_path)
                    .unwrap_or(&entry_path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                files.push(AudioFile {
                    name: entry_name,
                    path: entry_path.to_string_lossy().to_string(),
                    extension,
                    size,
                    content_id: None,
                    relative_path: Some(relative_path),
                });
            }
        }
    }

    children.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(FolderNode {
        name,
        path: dir_path.to_string_lossy().to_string(),
        children,
        files,
    })
}

fn build_tree_from_file_index(dir_path: &Path, entries_by_dir: &HashMap<String, Vec<FileIndexEntry>>) -> FolderNode {
    let name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Root".to_string());

    let mut child_dirs: Vec<PathBuf> = entries_by_dir
        .keys()
        .filter_map(|dir| {
            let path = PathBuf::from(dir);
            let parent = path.parent()?;
            if parent == dir_path && path != dir_path {
                Some(path)
            } else {
                None
            }
        })
        .collect();
    child_dirs.sort_by(|a, b| a.to_string_lossy().to_lowercase().cmp(&b.to_string_lossy().to_lowercase()));
    child_dirs.dedup();

    let mut children = child_dirs
        .into_iter()
        .map(|child| build_tree_from_file_index(&child, entries_by_dir))
        .collect::<Vec<_>>();

    children.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    let current_dir = dir_path.to_string_lossy().to_string();
    let mut files = entries_by_dir
        .get(&current_dir)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| AudioFile {
            name: Path::new(&entry.absolute_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| entry.relative_path.clone()),
            path: entry.absolute_path,
            extension: entry.extension,
            size: entry.size,
            content_id: Some(entry.content_id),
            relative_path: Some(entry.relative_path),
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    FolderNode {
        name,
        path: current_dir,
        children,
        files,
    }
}

fn build_snapshot_from_index(
    root_path: &Path,
    library_id: &str,
    file_index: &FileIndexFile,
    content_index: ContentIndexFile,
    local_tags: LocalTagsFile,
) -> LibrarySnapshot {
    let root_string = root_path.to_string_lossy().to_string();
    let mut entries_by_dir: HashMap<String, Vec<FileIndexEntry>> = HashMap::new();

    for entry in file_index.files.iter().filter(|f| f.library_id == library_id) {
        let dir = Path::new(&entry.absolute_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| root_string.clone());
        entries_by_dir.entry(dir).or_default().push(entry.clone());
    }

    let tree = build_tree_from_file_index(root_path, &entries_by_dir);

    LibrarySnapshot {
        tree,
        file_index: file_index.clone(),
        content_index,
        local_tags,
        used_cache: true,
        indexing_complete: true,
    }
}

fn build_indexed_snapshot(path: &str, root_path: &PathBuf, library_id: &str, library_name: &str, local_tags: LocalTagsFile) -> Result<LibrarySnapshot, String> {
    let mut file_entries = Vec::new();
    let mut content_entries = HashMap::new();
    let tree = build_tree_with_index(
        root_path,
        root_path,
        library_id,
        library_name,
        &mut file_entries,
        &mut content_entries,
    )?;

    let mut next_file_index = read_file_index_internal()?;
    next_file_index.libraries.insert(
        library_id.to_string(),
        FileIndexLibraryInfo {
            name: library_name.to_string(),
            path: path.to_string(),
        },
    );
    next_file_index.files.retain(|f| f.library_id != library_id);
    next_file_index.files.extend(file_entries.clone());
    write_file_index_internal(&next_file_index)?;

    let mut next_content_index = read_content_index_internal()?;
    for (content_id, entry) in content_entries {
        next_content_index
            .contents
            .entry(content_id)
            .and_modify(|existing| {
                for instance in &entry.instances {
                    if !existing.instances.contains(instance) {
                        existing.instances.push(instance.clone());
                    }
                }
                if existing.canonical_name.is_empty() {
                    existing.canonical_name = entry.canonical_name.clone();
                }
            })
            .or_insert(entry);
    }
    write_content_index_internal(&next_content_index)?;

    Ok(LibrarySnapshot {
        tree,
        file_index: next_file_index,
        content_index: next_content_index,
        local_tags,
        used_cache: false,
        indexing_complete: true,
    })
}

fn build_preview_snapshot(path: &str, root_path: &PathBuf, library_id: &str, library_name: &str, local_tags: LocalTagsFile) -> Result<LibrarySnapshot, String> {
    let tree = build_directory_preview(root_path, root_path)?;
    let mut file_index = read_file_index_internal()?;
    file_index.libraries.insert(
        library_id.to_string(),
        FileIndexLibraryInfo {
            name: library_name.to_string(),
            path: path.to_string(),
        },
    );

    Ok(LibrarySnapshot {
        tree,
        file_index,
        content_index: read_content_index_internal()?,
        local_tags,
        used_cache: false,
        indexing_complete: false,
    })
}

fn build_tree_with_index(
    dir_path: &PathBuf,
    root_path: &PathBuf,
    library_id: &str,
    library_name: &str,
    file_entries: &mut Vec<FileIndexEntry>,
    content_entries: &mut HashMap<String, ContentIndexEntry>,
) -> Result<FolderNode, String> {
    let name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Root".to_string());

    let mut children = Vec::new();
    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();

            if entry_name.starts_with('.') {
                continue;
            }

            if entry_path.is_dir() {
                children.push(build_tree_with_index(
                    &entry_path,
                    root_path,
                    library_id,
                    library_name,
                    file_entries,
                    content_entries,
                )?);
            } else if is_audio_file(&entry_path) {
                let content_id = compute_content_id(&entry_path)?;
                let relative_path = entry_path
                    .strip_prefix(root_path)
                    .unwrap_or(&entry_path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let file_id = format!("{}:{}", library_id, relative_path);
                let extension = entry_path
                    .extension()
                    .map(|e| e.to_string_lossy().to_string())
                    .unwrap_or_default();
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                file_entries.push(FileIndexEntry {
                    file_id: file_id.clone(),
                    library_id: library_id.to_string(),
                    library_name: Some(library_name.to_string()),
                    relative_path: relative_path.clone(),
                    absolute_path: entry_path.to_string_lossy().to_string(),
                    size,
                    modified_at: modified_at(&entry_path),
                    extension: extension.clone(),
                    content_id: content_id.clone(),
                });

                content_entries
                    .entry(content_id.clone())
                    .and_modify(|record| record.instances.push(file_id.clone()))
                    .or_insert(ContentIndexEntry {
                        canonical_name: entry_name.clone(),
                        instances: vec![file_id.clone()],
                        waveform_cache: None,
                    });

                files.push(AudioFile {
                    name: entry_name,
                    path: entry_path.to_string_lossy().to_string(),
                    extension,
                    size,
                    content_id: Some(content_id),
                    relative_path: Some(relative_path),
                });
            }
        }
    }

    children.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(FolderNode {
        name,
        path: dir_path.to_string_lossy().to_string(),
        children,
        files,
    })
}

#[tauri::command]
fn scan_directory(path: String) -> Result<FolderNode, String> {
    let root_path = PathBuf::from(&path);
    if !root_path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let library_id = library_id_from_path(&path);
    let library_name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Root".to_string());

    let mut file_entries = Vec::new();
    let mut content_entries = HashMap::new();
    build_tree_with_index(
        &root_path,
        &root_path,
        &library_id,
        &library_name,
        &mut file_entries,
        &mut content_entries,
    )
}

#[tauri::command]
fn build_library_snapshot(path: String) -> Result<LibrarySnapshot, String> {
    let root_path = PathBuf::from(&path);
    if !root_path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let library_id = library_id_from_path(&path);
    let library_name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Root".to_string());

    let file_index = read_file_index_internal()?;
    let content_index = read_content_index_internal()?;
    let local_tags = read_local_tags_internal()?;

    let has_cached_library = file_index.files.iter().any(|f| f.library_id == library_id)
        && file_index
            .libraries
            .get(&library_id)
            .map(|info| info.path == path)
            .unwrap_or(false);

    if has_cached_library {
        return Ok(build_snapshot_from_index(
            &root_path,
            &library_id,
            &file_index,
            content_index,
            local_tags,
        ));
    }

    build_preview_snapshot(&path, &root_path, &library_id, &library_name, local_tags)
}

#[tauri::command]
fn build_library_index(path: String) -> Result<LibrarySnapshot, String> {
    let root_path = PathBuf::from(&path);
    if !root_path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let library_id = library_id_from_path(&path);
    let library_name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Root".to_string());
    let local_tags = read_local_tags_internal()?;

    build_indexed_snapshot(&path, &root_path, &library_id, &library_name, local_tags)
}

#[tauri::command]
fn read_file_index() -> Result<FileIndexFile, String> {
    read_file_index_internal()
}

#[tauri::command]
fn read_content_index() -> Result<ContentIndexFile, String> {
    read_content_index_internal()
}

#[tauri::command]
fn read_local_tags() -> Result<LocalTagsFile, String> {
    read_local_tags_internal()
}

#[tauri::command]
fn add_tag(content_id: String, group: String, value: String, author: String) -> Result<(), String> {
    let mut data = read_local_tags_internal()?;
    let record = data.contents.entry(content_id).or_insert(ContentTagRecord {
        tags: HashMap::new(),
    });

    let tag_entry = TagEntry {
        value,
        author,
        created_at: Utc::now().to_rfc3339(),
        verified: Some(false),
    };

    record.tags.entry(group).or_insert_with(Vec::new).push(tag_entry);
    write_local_tags_internal(&data)
}

#[tauri::command]
fn remove_tag(content_id: String, group: String, value: String) -> Result<(), String> {
    let mut data = read_local_tags_internal()?;
    if let Some(record) = data.contents.get_mut(&content_id) {
        if let Some(tags) = record.tags.get_mut(&group) {
            tags.retain(|t| t.value != value);
        }
    }
    write_local_tags_internal(&data)
}

#[tauri::command]
fn load_settings() -> Result<AppSettings, String> {
    let config_path = settings_path();
    if !config_path.exists() {
        return Ok(AppSettings {
            libraries: vec![],
            waveform_cache_path: None,
            tag_storage_mode: "local".to_string(),
            custom_tag_path: None,
        });
    }

    let content = fs::read_to_string(&config_path).map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    ensure_app_data_dir().map_err(|e| format!("Failed to create app data dir: {}", e))?;
    let content = serde_json::to_string_pretty(&settings).map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_path(), content).map_err(|e| format!("Failed to write settings: {}", e))
}

#[tauri::command]
fn add_library(name: String, path: String, lib_type: String) -> Result<(), String> {
    let mut settings = load_settings()?;
    if settings.libraries.iter().any(|l| l.path == path) {
        return Err("Library already exists".to_string());
    }
    settings.libraries.push(LibraryConfig { name, path, lib_type });
    save_settings(settings)
}

#[tauri::command]
fn remove_library(path: String) -> Result<(), String> {
    let mut settings = load_settings()?;
    settings.libraries.retain(|l| l.path != path);
    save_settings(settings)
}

#[tauri::command]
fn get_audio_data(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata = fs::metadata(&file_path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();
    const MAX_SIZE: u64 = 50 * 1024 * 1024; // 50MB

    if file_size > MAX_SIZE {
        return Err(format!("File too large ({}MB). Maximum supported size is 50MB.", file_size / 1024 / 1024));
    }

    let data = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let base64 = base64::engine::general_purpose::STANDARD.encode(&data);

    let mime = match file_path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) {
        Some(ext) if ext == "wav" => "audio/wav",
        Some(ext) if ext == "mp3" => "audio/mpeg",
        Some(ext) if ext == "m4a" => "audio/mp4",
        Some(ext) if ext == "ogg" => "audio/ogg",
        _ => "audio/mpeg",
    };

    Ok(format!("data:{};base64,{}", mime, base64))
}

#[tauri::command]
fn get_sync_status() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "mode": "local-only",
        "localMetaPath": get_app_data_dir().join("local-meta").to_string_lossy(),
        "sharedMetaPath": serde_json::Value::Null,
        "lastSyncAt": serde_json::Value::Null,
        "pendingChanges": 0
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            build_library_snapshot,
            build_library_index,
            read_file_index,
            read_content_index,
            read_local_tags,
            add_tag,
            remove_tag,
            load_settings,
            save_settings,
            add_library,
            remove_library,
            get_audio_data,
            get_sync_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
