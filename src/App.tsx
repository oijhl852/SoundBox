import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  FileAudio,
  ChevronRight,
  ChevronDown,
  Folder,
  Loader2,
  Plus,
  X,
  AlertCircle,
  Settings,
  Trash2,
  PanelLeft,
  Library,
  Database,
} from "lucide-react";
import { selectFolder, buildLibrarySnapshot, buildLibraryIndex, addTag, removeTag, loadSettings, addLibrary, removeLibrary, getAudioData, getSyncStatus } from "./lib/api";
import type { ContentIndexFile, FolderNode, SyncStatus, TagEntry, LibraryConfig, LibraryLoadState } from "./lib/types";

const TAG_GROUPS = [
  { key: "mood", label: "情绪", options: ["激昂", "悲伤", "悬疑", "温馨", "紧张", "轻松", "浪漫", "恐怖"] },
  { key: "energy", label: "能量", options: ["高", "中", "低"] },
  { key: "type", label: "类型", options: ["BGM", "音效", "环境音", "人声"] },
  { key: "source", label: "来源", options: [] },
  { key: "custom", label: "自定义", options: [] },
];

const LIBRARY_TYPES = [
  { value: "music", label: "音乐" },
  { value: "sfx", label: "音效" },
  { value: "ambient", label: "环境音" },
  { value: "voice", label: "人声" },
];

function App() {
  const [libraries, setLibraries] = useState<LibraryConfig[]>([]);
  const [activeLibrary, setActiveLibrary] = useState<string>("");
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [currentFile, setCurrentFile] = useState<{ name: string; path: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Record<string, TagEntry[]>>({});
  const [allFiles, setAllFiles] = useState<{ name: string; path: string; folder: string; contentId?: string }[]>([]);
  const [contentIndex, setContentIndex] = useState<ContentIndexFile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [selectedTagGroup, setSelectedTagGroup] = useState("mood");
  const [showSettings, setShowSettings] = useState(false);
  const [newLibName, setNewLibName] = useState("");
  const [newLibType, setNewLibType] = useState("music");
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [waveformHeight, setWaveformHeight] = useState(120);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingWaveform, setIsResizingWaveform] = useState(false);
  const [libraryLoadState, setLibraryLoadState] = useState<LibraryLoadState>({ status: "idle" });

  const libraryCacheRef = useRef(new Map<string, Awaited<ReturnType<typeof buildLibrarySnapshot>>>());
  const playheadRafRef = useRef<number | null>(null);
  const waveformJobIdRef = useRef(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioDataRef = useRef<string | null>(null);

  const drawWaveform = useCallback(async (dataUrl: string) => {
    if (!waveformRef.current) return;
    const canvas = waveformRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close().catch(() => undefined);
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const response = await fetch(dataUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channelData = audioBuffer.getChannelData(0);
      const width = canvas.width;
      const height = canvas.height;
      const mid = height / 2;
      const samplesPerBucket = Math.max(1, Math.floor(channelData.length / width));

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(99,102,241,0.08)";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        const start = x * samplesPerBucket;
        const end = Math.min(start + samplesPerBucket, channelData.length);
        let min = 1;
        let max = -1;
        for (let i = start; i < end; i++) {
          const value = channelData[i];
          if (value < min) min = value;
          if (value > max) max = value;
        }
        ctx.moveTo(x + 0.5, mid + min * mid * 0.9);
        ctx.lineTo(x + 0.5, mid + max * mid * 0.9);
      }
      ctx.stroke();
    } catch (err) {
      console.error("Failed to draw waveform:", err);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(239,68,68,0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    if (currentAudioDataRef.current) {
      drawWaveform(currentAudioDataRef.current);
    }
  }, [waveformHeight, drawWaveform]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.paused && !audio.ended) {
        playheadRafRef.current = requestAnimationFrame(tick);
      }
    };

    const stopRaf = () => {
      if (playheadRafRef.current !== null) {
        cancelAnimationFrame(playheadRafRef.current);
        playheadRafRef.current = null;
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      setError(null);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onPlay = () => {
      setIsPlaying(true);
      stopRaf();
      playheadRafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setIsPlaying(false);
      stopRaf();
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      stopRaf();
    };
    const onError = () => {
      setError("音频播放失败");
      setIsLoading(false);
      stopRaf();
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      stopRaf();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => {
    const tree = snapshot.tree;
    setFolderTree([tree]);
    setExpandedFolders(new Set([tree.path]));
    const tagsByContentId = snapshot.localTags?.contents ?? {};
    const allTagsByFileName: Record<string, TagEntry[]> = {};
    const files: { name: string; path: string; folder: string; contentId?: string }[] = [];

    const collectFiles = (node: FolderNode, folderName: string) => {
      node.files.forEach((f) => {
        files.push({ name: f.name, path: f.path, folder: folderName, contentId: f.contentId });
        if (f.contentId && tagsByContentId[f.contentId]) {
          const tagList: TagEntry[] = [];
          for (const [_group, entries] of Object.entries(tagsByContentId[f.contentId].tags as Record<string, TagEntry[]>)) {
            tagList.push(...entries);
          }
          allTagsByFileName[f.name] = tagList;
        }
      });
      node.children.forEach((c) => collectFiles(c, c.name));
    };

    collectFiles(tree, tree.name);
    setContentIndex(snapshot.contentIndex);
    setTags(allTagsByFileName);
    setAllFiles(files);
    setLibraryLoadState({
      status: snapshot.indexingComplete ? "ready" : "indexing",
      usedCache: snapshot.usedCache,
      indexingComplete: snapshot.indexingComplete,
      message: snapshot.usedCache
        ? "已从本地索引恢复素材列表"
        : snapshot.indexingComplete
          ? "已完成完整索引构建"
          : "已加载目录和文件列表，正在后台补建索引...",
    });
  }, []);

  const clearLibraryView = useCallback(() => {
    setFolderTree([]);
    setExpandedFolders(new Set());
    setAllFiles([]);
    setTags({});
    setContentIndex(null);
    setCurrentFile(null);
    currentAudioDataRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  }, []);

  const selectLibrary = useCallback(async (path: string) => {
    setActiveLibrary(path);
    setError(null);

    const cached = libraryCacheRef.current.get(path);
    if (cached) {
      applySnapshot(cached);
      return;
    }

    setLibraryLoadState({ status: "indexing", message: "正在读取目录结构..." });
    try {
      const previewSnapshot = await buildLibrarySnapshot(path);
      applySnapshot(previewSnapshot);

      if (!previewSnapshot.indexingComplete) {
        setTimeout(async () => {
          try {
            const fullSnapshot = await buildLibraryIndex(path);
            libraryCacheRef.current.set(path, fullSnapshot);
            applySnapshot(fullSnapshot);
          } catch (indexErr) {
            console.error("Background indexing failed:", indexErr);
            setLibraryLoadState((prev) => ({
              ...prev,
              status: "error",
              message: indexErr instanceof Error ? indexErr.message : String(indexErr),
            }));
          }
        }, 0);
      } else {
        libraryCacheRef.current.set(path, previewSnapshot);
      }
    } catch (err) {
      clearLibraryView();
      setLibraryLoadState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      setError("素材库加载失败");
    }
  }, [applySnapshot, clearLibraryView]);

  useEffect(() => {
    loadSettings().then((settings) => {
      setLibraries(settings.libraries);
      if (settings.libraries.length === 0) {
        clearLibraryView();
        setActiveLibrary("");
        setLibraryLoadState({ status: "idle", message: "请先添加素材库" });
        return;
      }
      setActiveLibrary(settings.libraries[0].path);
      setLibraryLoadState({ status: "idle", message: "已读取素材库配置，等待选择加载" });
    });
    getSyncStatus().then(setSyncStatus).catch(() => undefined);
  }, [clearLibraryView]);

  useEffect(() => {
    let rafId: number | null = null;
    let pendingX = 0;
    let pendingY = 0;

    const flushResize = () => {
      rafId = null;
      if (isResizingSidebar) {
        setSidebarWidth(Math.min(480, Math.max(180, pendingX)));
      }
      if (isResizingWaveform) {
        const viewportHeight = window.innerHeight;
        const bottomReserved = 220;
        const next = viewportHeight - pendingY - bottomReserved;
        setWaveformHeight(Math.min(280, Math.max(90, next)));
      }
    };

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (rafId === null) {
        rafId = requestAnimationFrame(flushResize);
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizingSidebar(false);
      setIsResizingWaveform(false);
    };

    const onWindowResize = () => {
      if (currentAudioDataRef.current) {
        requestAnimationFrame(() => drawWaveform(currentAudioDataRef.current!));
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("resize", onWindowResize);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("resize", onWindowResize);
    };
  }, [isResizingSidebar, isResizingWaveform, drawWaveform]);

  useEffect(() => {
    if (!currentFile) return;
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);

    const jobId = ++waveformJobIdRef.current;

    getAudioData(currentFile.path).then((dataUrl) => {
      currentAudioDataRef.current = dataUrl;
      if (audioRef.current) {
        audioRef.current.src = dataUrl;
        audioRef.current.load();
        audioRef.current.play().catch((err) => console.log("Auto play failed:", err));
      }

      requestAnimationFrame(() => {
        if (jobId !== waveformJobIdRef.current) return;
        drawWaveform(dataUrl);
      });
    }).catch((err) => {
      setError("音频加载失败: " + err);
      setIsLoading(false);
    });
  }, [currentFile, drawWaveform]);

  const seekToPercent = (percent: number) => {
    if (!audioRef.current || !duration) return;
    const safePercent = Math.min(1, Math.max(0, percent));
    const newTime = safePercent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    seekToPercent((e.clientX - rect.left) / rect.width);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekToPercent((e.clientX - rect.left) / rect.width);
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch((err) => console.error("Waveform seek play failed:", err));
    }
  };

  const handleAddLibrary = async () => {
    if (!newLibName.trim()) {
      alert("请输入素材库名称");
      return;
    }
    const path = await selectFolder();
    if (!path) return;
    try {
      await addLibrary(newLibName, path, newLibType);
      const settings = await loadSettings();
      setLibraries(settings.libraries);
      setNewLibName("");
      setShowSettings(false);
      await selectLibrary(path);
    } catch (e) {
      alert("添加素材库失败: " + e);
    }
  };

  const handleRemoveLibrary = async (path: string) => {
    await removeLibrary(path);
    libraryCacheRef.current.delete(path);
    const settings = await loadSettings();
    setLibraries(settings.libraries);
    if (activeLibrary === path) {
      if (settings.libraries.length > 0) {
        await selectLibrary(settings.libraries[0].path);
      } else {
        setActiveLibrary("");
        clearLibraryView();
        setLibraryLoadState({ status: "idle", message: "请先添加素材库" });
      }
    }
  };

  const handleAddTag = async () => {
    if (!currentFile || !newTagValue.trim()) return;
    const currentFileMeta = allFiles.find((file) => file.path === currentFile.path);
    if (!currentFileMeta?.contentId) return;

    await addTag(currentFileMeta.contentId, selectedTagGroup, newTagValue.trim(), "user");
    const snapshot = await buildLibrarySnapshot(activeLibrary);
    libraryCacheRef.current.set(activeLibrary, snapshot);
    const contentRecord = snapshot.localTags.contents[currentFileMeta.contentId];
    if (contentRecord) {
      const tagList: TagEntry[] = [];
      for (const [_group, entries] of Object.entries(contentRecord.tags as Record<string, TagEntry[]>) ) tagList.push(...entries);
      setTags((prev) => ({ ...prev, [currentFile.name]: tagList }));
    }
    setNewTagValue("");
  };

  const handleRemoveTag = async (tagValue: string) => {
    if (!currentFile) return;
    const currentFileMeta = allFiles.find((file) => file.path === currentFile.path);
    if (!currentFileMeta?.contentId) return;

    // 找到该标签属于哪个组
    const currentTags = tags[currentFile.name] || [];
    const tagEntry = currentTags.find(t => t.value === tagValue);
    if (!tagEntry) return;

    // 遍历所有组找到该标签
    for (const group of TAG_GROUPS) {
      await removeTag(currentFileMeta.contentId, group.key, tagValue);
    }

    const snapshot = await buildLibrarySnapshot(activeLibrary);
    libraryCacheRef.current.set(activeLibrary, snapshot);
    const contentRecord = snapshot.localTags.contents[currentFileMeta.contentId];
    if (contentRecord) {
      const tagList: TagEntry[] = [];
      for (const [_group, entries] of Object.entries(contentRecord.tags as Record<string, TagEntry[]>) ) tagList.push(...entries);
      setTags((prev) => ({ ...prev, [currentFile.name]: tagList }));
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const selectFile = (name: string, path: string) => {
    setCurrentFile({ name, path });
    setIsPlaying(false);
    setCurrentTime(0);
    setShowTagEditor(false);
    setError(null);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch((err) => setError("播放失败: " + err.message));
  };

  const toggleMute = () => setIsMuted(!isMuted);
  const formatTime = (seconds: number) => isNaN(seconds) ? "00:00" : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  const toggleTagFilter = (tag: string) => setTagFilters((prev) => {
    const next = new Set(prev);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    return next;
  });

  const filteredFiles = allFiles.filter((f) => {
    const duplicateCount = f.contentId ? contentIndex?.contents[f.contentId]?.instances.length ?? 0 : 0;
    const duplicateLabel = duplicateCount > 1 ? `重复 ${duplicateCount}` : "";
    const matchesSearch = searchQuery
      ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        duplicateLabel.includes(searchQuery) ||
        tags[f.name]?.some((t) => t.value.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    const matchesTags = tagFilters.size > 0 ? tags[f.name]?.some((t) => tagFilters.has(t.value)) : true;
    return matchesSearch && matchesTags;
  });

  const allUniqueTags = Array.from(allFiles.reduce((acc, f) => {
    tags[f.name]?.forEach((t) => acc.add(t.value));
    return acc;
  }, new Set<string>())).sort();

  const renderFolderTree = (node: FolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children.length > 0 || node.files.length > 0;
    return (
      <div key={node.path}>
        <button onClick={() => toggleFolder(node.path)} className="flex w-full items-center rounded px-2 py-1 text-sm hover:bg-accent transition-colors" style={{ paddingLeft: `${level * 16 + 8}px` }}>
          {hasChildren ? (isExpanded ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />) : <span className="mr-1 w-3" />}
          <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
          {node.files.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{node.files.length}</span>}
        </button>
        {isExpanded && (
          <>
            {node.children.map((child) => renderFolderTree(child, level + 1))}
            {node.files.map((file) => (
              <button key={file.path} onClick={() => selectFile(file.name, file.path)} className={`flex w-full items-center rounded pl-8 pr-2 py-1 text-sm hover:bg-accent transition-colors ${currentFile?.path === file.path ? "bg-accent text-accent-foreground" : ""}`} style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
                <FileAudio className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none">
      <audio ref={audioRef} preload="metadata" />

      <header className="flex h-10 items-center border-b px-4 text-sm font-medium">
        <Music className="mr-2 h-4 w-4" />
        <span>The Arcane Crate</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSidebar(!showSidebar)}><PanelLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}><Settings className="h-4 w-4" /></Button>
          <span className="text-xs text-muted-foreground">v1.0.0</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <>
            <aside className="border-r bg-muted/30 flex flex-col shrink-0" style={{ width: sidebarWidth }}>
              <div className="border-b">
                <div className="p-2 flex items-center gap-2"><Library className="h-4 w-4" /><span className="text-sm font-medium">素材库</span></div>
                <div className="flex flex-wrap gap-1 px-2 pb-2">
                  {libraries.map((lib) => <Badge key={lib.path} variant={activeLibrary === lib.path ? "default" : "outline"} className="cursor-pointer" onClick={() => selectLibrary(lib.path)}>{lib.name}</Badge>)}
                </div>
                <div className="px-2 pb-2 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1"><Database className="h-3.5 w-3.5" /><span>{libraryLoadState.message ?? "等待加载素材库"}</span></div>
                  {libraryLoadState.status === "ready" && <div>{libraryLoadState.usedCache ? "当前使用本地索引缓存" : "当前为首次索引结果"}</div>}
                  {libraryLoadState.status === "indexing" && <div>{libraryLoadState.indexingComplete ? "正在刷新界面..." : "目录和文件已可浏览，完整索引仍在生成。"}</div>}
                </div>
              </div>

              {allUniqueTags.length > 0 && (
                <div className="px-2 pb-2 border-b">
                  <div className="text-xs text-muted-foreground mb-1 px-2">标签筛选</div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {allUniqueTags.map((tag) => <Badge key={tag} variant={tagFilters.has(tag) ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => toggleTagFilter(tag)}>{tag}</Badge>)}
                  </div>
                  {tagFilters.size > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setTagFilters(new Set())}>清除筛选</Button>}
                </div>
              )}

              <div className="px-2 flex-1 overflow-y-auto">
                {folderTree.length > 0 ? (
                  <>
                    {libraryLoadState.status === "indexing" && (
                      <div className="px-2 py-2 flex items-center gap-2 text-xs text-muted-foreground sticky top-0 bg-muted/30 z-10">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>正在后台补建索引，目录可先浏览。</span>
                      </div>
                    )}
                    {folderTree.map((node) => renderFolderTree(node))}
                  </>
                ) : <p className="px-2 py-4 text-sm text-muted-foreground text-center">{libraryLoadState.message ?? "请在设置中添加素材库"}</p>}
              </div>
            </aside>
            <div className="w-1.5 cursor-col-resize bg-border hover:bg-primary/40 shrink-0" onMouseDown={() => setIsResizingSidebar(true)} />
          </>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索文件名或标签..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 flex-1" />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredFiles.map((file) => {
              const duplicateCount = file.contentId ? contentIndex?.contents?.[file.contentId]?.instances.length ?? 0 : 0;
              return (
                <button key={file.path} onClick={() => selectFile(file.name, file.path)} className={`flex w-full items-center rounded-md px-3 py-2 text-left hover:bg-accent transition-colors mb-1 ${currentFile?.path === file.path ? "bg-accent text-accent-foreground" : ""}`}>
                  <FileAudio className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {duplicateCount > 1 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">重复 {duplicateCount}</Badge>}
                      {file.contentId && <Badge variant="outline" className="text-[10px] px-1.5 py-0">CID</Badge>}
                      {tags[file.name]?.slice(0, 5).map((tag, idx) => <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">{tag.value}</Badge>)}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">{file.folder}</span>
                </button>
              );
            })}
            {filteredFiles.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Search className="h-8 w-8 mb-2" /><p className="text-sm">{libraryLoadState.status === "indexing" ? "正在建立索引..." : libraries.length > 0 ? "未找到匹配的素材" : "请在设置中添加素材库"}</p></div>}
          </div>

          <div className="border-t px-4 pt-3" style={{ height: waveformHeight + 16 }}>
            {currentFile ? (
              <div className="rounded-md bg-muted/50 border relative overflow-hidden cursor-pointer h-full" onClick={handleWaveformClick}>
                {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                {error && <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20"><div className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /><span className="text-sm">{error}</span></div></div>}
                <canvas ref={waveformRef} width={800} height={Math.max(96, waveformHeight)} className="w-full h-full" />
                {duration > 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none" style={{ left: `${(currentTime / duration) * 100}%` }} />}
              </div>
            ) : (
              <div className="h-full rounded-md bg-muted/30 flex items-center justify-center border border-dashed"><span className="text-sm text-muted-foreground">选择一个音频文件</span></div>
            )}
          </div>
          <div className="h-1.5 cursor-row-resize bg-border hover:bg-primary/40" onMouseDown={() => setIsResizingWaveform(true)} />

          <div className="border-t px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay} disabled={!currentFile || isLoading}>{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!currentFile} onClick={() => audioRef.current && (audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10))}><SkipBack className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!currentFile} onClick={() => audioRef.current && (audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10))}><SkipForward className="h-4 w-4" /></Button>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>{isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button>
                <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-24 cursor-pointer" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
              <div ref={progressRef} className="flex-1 h-2 bg-muted rounded-full cursor-pointer" onClick={handleProgressClick}>
                {duration > 0 && <div className="h-full bg-primary rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }} />}
              </div>
              <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
            </div>
          </div>

          {currentFile && (() => {
            const currentMeta = allFiles.find((file) => file.path === currentFile.path);
            const duplicateCount = currentMeta?.contentId ? contentIndex?.contents[currentMeta.contentId]?.instances.length ?? 0 : 0;
            const instances = currentMeta?.contentId ? contentIndex?.contents[currentMeta.contentId]?.instances ?? [] : [];
            return (
              <div className="border-t px-4 py-2 space-y-2">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{currentFile.name}</span>
                  <div className="flex gap-1 ml-auto flex-wrap">
                    {tags[currentFile.name]?.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="group cursor-pointer hover:bg-destructive hover:text-destructive-foreground">
                        <span onClick={() => handleRemoveTag(tag.value)}>{tag.value}</span>
                      </Badge>
                    ))}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTagEditor(!showTagEditor)}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {currentMeta?.contentId && <div>contentId：<span className="font-mono">{currentMeta.contentId}</span></div>}
                  <div>重复实例数：{duplicateCount}</div>
                  {duplicateCount > 1 && <div className="truncate">实例示例：{instances.slice(0, 2).join(" / ")}{instances.length > 2 ? " ..." : ""}</div>}
                  {syncStatus && <div>同步模式：{syncStatus.mode}｜待同步变更：{syncStatus.pendingChanges}</div>}
                </div>
              </div>
            );
          })()}

          {showTagEditor && currentFile && (
            <div className="border-t px-4 py-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <select className="h-8 px-2 rounded border bg-background" value={selectedTagGroup} onChange={(e) => setSelectedTagGroup(e.target.value)}>
                  {TAG_GROUPS.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
                </select>
                <Input placeholder="输入标签..." value={newTagValue} onChange={(e) => setNewTagValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddTag()} className="h-8 flex-1" />
                <Button size="sm" onClick={handleAddTag}>添加</Button>
                <Button variant="ghost" size="icon" onClick={() => setShowTagEditor(false)}><X className="h-4 w-4" /></Button>
              </div>
              {(() => {
                const group = TAG_GROUPS.find((g) => g.key === selectedTagGroup);
                return group && group.options.length > 0 && <div className="flex gap-1 mt-2 flex-wrap">{group.options.map((opt) => <Badge key={opt} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => { setNewTagValue(opt); handleAddTag(); }}>{opt}</Badge>)}</div>;
              })()}
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg w-[500px] max-h-[80vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">设置</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">素材库管理</h3>
                <div className="space-y-2">
                  {libraries.map((lib) => (
                    <div key={lib.path} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div>
                        <div className="text-sm font-medium">{lib.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{lib.path}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveLibrary(lib.path)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium mb-2">添加素材库</h3>
                  <div className="flex gap-2">
                    <Input placeholder="名称" value={newLibName} onChange={(e) => setNewLibName(e.target.value)} className="flex-1" />
                    <select className="h-8 px-2 rounded border bg-background" value={newLibType} onChange={(e) => setNewLibType(e.target.value)}>
                      {LIBRARY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Button onClick={handleAddLibrary}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="border-t pt-3 text-xs text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">仓库 / 同步状态</div>
                  <div>本地标签仓库：%APPDATA%/TheArcaneCrate/local-meta</div>
                  <div>远程标签仓库：预留 NAS 路径配置（下一阶段接入）</div>
                  <div>当前同步模式：{syncStatus?.mode ?? "local-only"}</div>
                  <div>待同步变更：{syncStatus?.pendingChanges ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
