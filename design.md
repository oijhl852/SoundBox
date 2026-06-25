# Soundbox - 音频素材管理工具 设计文档

> 版本：v1.3
> 日期：2026-05-20

---

## 一、项目概述

### 背景与定位

**Soundbox** 是一款面向视频后期制作人员的桌面端音频素材管理工具。核心目标是解决素材量大、重复文件多、缺乏标签管理导致的查找与复用困难问题，提供波形可视化、标签分类、快速预览、去重识别等能力。

### 目标用户

- 视频剪辑师 / 后期制作人员
- 需要管理大量 BGM、音效、环境音素材
- 素材库路径因人而异，但存在大量重复音频内容
- 需要在本地高性能操作

### 核心痛点

| 痛点 | 描述 |
|------|------|
| 素材量大，难以区分 | 相同文件名但不同情绪/能量的音乐难以区分 |
| 重复素材多 | 同一首音频可能散落在多个目录中 |
| 预览效率低 | 需要打开外部播放器才能试听 |
| 缺乏统一标签 | 标签若绑定路径，会导致重复劳动 |
| 查找困难 | 只能靠文件夹名和文件名记忆，无法按情绪/能量筛选 |

### 开发说明

> ⚠️ **本项目由单人使用 AI 辅助（vibe coding）开发，开发者无编程能力。**
> **设计文档也是给 AI 的开发指令**，每个功能模块附带明确的开发指引。
> 后续所有修改请严格遵循本文档定义的文件结构和数据流规范。

---

## 二、产品形态

### 版本定位

| 版本 | 定位 | 说明 |
|------|------|------|
| **桌面端** | 主力应用 | 独立 Windows 桌面应用，批量管理、打标签、整理素材库、维护索引与缓存 |
| **插件端** | ❌ 已废弃 | Premiere Pro 插件不再开发，专注桌面端体验 |

### 数据模型总览

系统统一拆分为三层：

- **素材库层**：仅存放原始音频文件（本地磁盘素材目录）
- **索引层**：维护文件实例、内容 ID、去重关系、波形缓存映射
- **标签仓库层**：集中存储标签数据（本地仓库，暂不实现 NAS 双仓同步，保留扩展能力）

### 标识策略

系统采用双层标识：

- **file instance**：表示某个素材库中的某个具体文件实例
- **contentId**：表示音频内容本身，用于重复识别、标签关联、波形缓存复用

当前实现：

- `file instance = libraryId + relativePath`
- `contentId = 采样哈希`（文件头64KB + 尾64KB + 文件大小 + 修改时间戳，避免大文件全量读）
- 后续可扩展为全量 SHA256 或音频指纹（识别同曲不同编码）

### 已验证依据

在 `E:\常用素材\音乐` 中检索 `Brand X Music - Game Changer`，共命中 18 个文件实例，且所有文件的哈希一致。

结论：
- 这些文件是同一音频内容在多个目录中的重复拷贝
- 标签主键不能绑定路径
- 标签必须绑定 `contentId`
- 索引层必须建立 `file instance -> contentId` 映射

---

## 三、功能模块

### 3.1 当前已完成

| 模块 | 功能描述 |
|------|----------|
| **文件浏览器** | 扫描本地目录、文件夹树展示、音频文件列表 |
| **波形播放器** | 表格视图三列布局（文件名/波形/标签）、点击波形即播、点击定位播放 |
| **标签管理** | 添加/编辑/删除标签、标签分组、行内标签显示 |
| **搜索过滤** | 按文件名搜索、按标签过滤、多条件组合筛选 |
| **索引系统** | 维护 file-index / content-index，支持切库秒开与重复识别 |
| **标签仓库** | v1.2 分片存储（contentId → 独立文件），原子写入（.tmp→rename），旧格式自动迁移 |
| **去重提示** | 识别内容相同但路径不同的文件 |
| **波形缓存** | 独立缓存波形数据并复用（LRU，500MB/10000文件上限） |
| **文件拖出** | 拖拽文件到外部应用（如 PR、剪映） |
| **素材库管理** | 添加/删除素材库、设置弹窗 |
| **Zustand 状态管理** | 4 个 Store，组件自行订阅，无 Props drilling |
| **表格视图** | 三列表格、可拖拽列宽、行高44px |
| **主题系统** | 4 套配色（极简白/暖白纸墨/暗夜深蓝/赛博紫），设置中切换 |
| **三级波形预载** | Level 0 紧急/Level 1 可见/Level 2 后台 + 整库预载进度显示 |
| **Duration 预载** | getAudioMeta IPC（ffprobe）独立获取 duration，先于波形就绪 |
| **音量控件** | 顶栏音量滑块，随调随用 |
| **Range 协议** | local-audio:// 协议新增 Content-Length + Accept-Ranges + 206 响应，浏览器原生 seek |
| **播放架构** | selectFile 为唯一控制中心，一次性监听 + audioLoadId 代际隔离，根除竞态 |
| **浏览器波形竞速** | browserWaveform() + Promise.race，与 ffmpeg 子进程竞速先到先得 |
| **音频格式** | 支持 .wav .mp3 .m4a .ogg .flac .aac |
| **代码审阅** | v1.3 全项目审阅，修复 6 项高优问题（详见 AUDIT.md） |

### 3.2 后续开发优先级

#### P0 - 标签系统深化

| 模块 | 功能描述 | 说明 |
|------|----------|------|
| **全局搜索** | ✅ 搜索框已提至顶栏，绑定 uiStore.searchQuery | 已完成 |
| **标签视图** | 按标签聚合浏览素材（类似智能播放列表） | 核心需求 |
| **标签自动补全** | 输入标签值时自动匹配已有值 | 提升输入效率 |
| **标签预设** | 预设常用标签组，快速分类 | 减少重复输入 |
| **标签统计** | 每个标签的使用次数、最近使用时间 | 帮助发现常用标签 |

#### P0 - 界面逻辑改进

| 模块 | 功能描述 |
|------|----------|
| **批量操作** | 多选文件 + 批量打标签、批量删除标签 |
| **文件夹树体验** | 展开/折叠状态持久化、目录文件计数显示 |

#### P1 - 体验优化

| 模块 | 功能描述 |
|------|----------|
| **快捷键系统** | 空格播放/暂停、方向键切换文件、Ctrl+数字快速打标签 |
| **标签导入/导出** | JSON 格式导入导出标签数据 |

#### P2 - 远期

| 模块 | 功能描述 |
|------|----------|
| **多窗口工作区** | 音效库、音乐库等分窗口工作 |
| **AI 自动标签建议** | 基于文件名和音频特征自动推荐标签 |
| **NAS 双仓同步** | 保留扩展能力，暂不实现 |
| **音频指纹** | 识别同曲不同编码/不同码率 |

---

## 四、标签体系

### 标签分组

| 分组 | 示例标签 | 说明 |
|------|----------|------|
| **情绪 (mood)** | 激昂、悲伤、悬疑、温馨、紧张、轻松 | 核心分类维度 |
| **能量 (energy)** | 高、中、低 | 音乐能量强度 |
| **类型 (type)** | BGM、音效、环境音、人声 | 素材类型 |
| **来源 (source)** | 剧名、专辑名 | 记录素材出处 |
| **自定义** | 用户自定义 | 灵活扩展 |

### 数据结构

详见代码 `src/lib/types.ts` 中的类型定义。核心文件：

| 文件名 | 用途 | 存储位置 |
|--------|------|----------|
| `settings.json` | 素材库配置、用户设置（含 `custom_tag_path`） | Electron 主进程 userData |
| `file-index.json` | 文件实例 -> 元数据映射 | Electron 主进程 userData |
| `content-index.json` | contentId -> 实例列表 + 波形缓存路径 | Electron 主进程 userData |
| `tags/content/{bucket}/{contentId}.json` | v1.2 分片标签存储，每个 contentId 独立文件，原子写入 | `custom_tag_path` 或 `%APPDATA%/Soundbox/tags/` |
| `name-index.json` | 文件名归一化 -> 历史标签建议 | Electron 主进程 userData |

### 标签合并原则

- 单人使用场景，标签直接写入本地仓库
- 以 contentId 为核心关联标签，不绑定路径
- 支持基于文件名的智能标签建议（name-index.json）

---

## 五、界面布局

```text
┌────────────────────────────────────────────────────────────────┐
│ 🎵 Soundbox         🔊 ▬▬▬▬▬▬▬○○○  75%     [☰] [⚙]  v1.0.0  │
├───────────────┬────────────────────────────────────────────────┤
│               │  [🔍 搜索文件或标签________]          [🏷 标签] │
│   文件树 /     ├────────────────────────────────────────────────┤
│   标签筛选     │  文件名 ↕│  波形（点击播放）      ↕│  标签 ↕  │
│               ├──────────┼─────────────────────────┼──────────┤
│  📁 音乐库     │  song1  │  ╱╲╱╲╱╲╱╲╱╲             │ [紧张]   │
│  📁 音效库     │  song2  │  ╱╲╱╲╱╲╱╲╱╲             │ [BGM]    │
│               │  ...     │                         │          │
│               ├──────────┴─────────────────────────┴──────────┤
│               │  [🏷 标签编辑器]（点击标签按钮后弹出）          │
├───────────────┴────────────────────────────────────────────────┤
│  波形 23/85                                              v1.0.0 │
└────────────────────────────────────────────────────────────────┘
```

关键交互：
- **点波形** → 从点击位置播放（不管是不是当前文件）
- **点行（文件名区）** → 从开头播放/暂停
- **整行拖拽** → 拖出文件到外部应用
- **表头拖拽条** → 调整列宽
- **行内标签** → 每行最多显示 3 个标签，点击可删除

---

## 六、技术架构

### 技术选型

| 层面 | 选择 | 理由 |
|------|------|------|
| **桌面端框架** | Electron | 桌面集成与系统级能力 |
| **前端框架** | React 19 + TypeScript | 生态成熟 |
| **波形方案** | Web Audio API + ffmpeg + 缓存 | 可控性强 |
| **UI 组件** | TailwindCSS v4 + shadcn/ui | 现代感强 |
| **数据存储** | JSON 索引文件 | 简单可靠，适配单人场景 |
| **内容标识** | 采样哈希 | 实现简单、去重稳定 |
| **状态管理** | **Zustand** ✅ | 无 Props drilling，适合 vibe coding |
| **虚拟列表** | react-window | 大列表性能 |
| **测试** | Vitest + Testing Library | 核心纯函数 |

### 架构总览

```text
┌──────────────────────────────────────────────────────────────┐
│                       渲染进程 (React)                       │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Zustand Store（4 个）                                 │  │
│  │  ├─ libraryStore  素材库数据 + CRUD 操作               │  │
│  │  ├─ playerStore   播放器状态 + 播放控制                 │  │
│  │  ├─ tagStore      标签状态 + 标签操作                   │  │
│  │  └─ uiStore       搜索词/侧栏/弹窗等 UI 状态            │  │
│  └──────────┬─────────────────────────────────────────────┘  │
│             │ 每个 Store 提供 useXxxStore(selector) 接口       │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │  子组件（Component）                                  │  │
│  │  LibrarySidebar  FileListPanel  StatusBar             │  │
│  │  SettingsDialog  DropInspectorWindow                  │  │
│  │  └─ 内部 use LibraryStore() / usePlayerStore() ...    │  │
│  │  自行订阅所需状态，不靠父组件传 props                   │  │
│  └────────────────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │  Pure Functions (lib/*.ts)                            │  │
│  │  无副作用的纯函数：状态转换、过滤、视图模型构建           │  │
│  │  可独立测试，不依赖 React                              │  │
│  └────────────────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │  Effects + API (lib/*-effects.ts + lib/api.ts)        │  │
│  │  副作用编排：调用 IPC → 处理结果 → 更新 Store           │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                  Bridge (IPC / preload.ts)                   │
├──────────────────────────────────────────────────────────────┤
│                    Electron 主进程 (Node.js)                  │
│  - 文件系统扫描 (library-scan.ts)                            │
│  - 索引读写 (library-storage.ts)                             │
│  - SHA256 采样哈希生成 (audio.ts)                             │
│  - 波形生成 (ffmpeg.ts + waveform-generator.ts)              │
│  - 标签 CRUD (tags.ts)                                       │
└──────────────────────────────────────────────────────────────┘
```

### 四个 Store 各自管什么

| Store | 状态 | 操作 | 被哪些组件订阅 |
|-------|------|------|---------------|
| **libraryStore** | libraries, activeLibrary, folderTree, allFiles, tags, contentIndex, nameSuggestions, miniWaveforms, syncStatus, libraryLoadState | selectLibrary, handleAddLibrary/RemoveLibrary, toggleFolder, applySnapshot, initLibraries | LibrarySidebar, FileListPanel, SettingsDialog, StatusBar |
| **playerStore** | currentFile, isPlaying, isLoading, currentTime, duration, volume, isMuted | selectFile, togglePlay, toggleMute, setVolume, seekToPercent, resetPlayerState | FileListPanel, App.tsx |
| **(+) audioRef / progressRef** | 模块级 DOM 引用（不在 Store 内） | App.tsx 中绑定 `<audio>` 元素 | — |
| **(+) usePlayerAudioEffect** | 副作用 Hook（挂载一次） | 音量同步、音频事件绑定、切文件时加载波形 | App.tsx 调用 |
| **tagStore** | tagFilters, showTagEditor, newTagValue, selectedTagGroup | handleAddTag, handleRemoveTag, handleAdoptSuggestion, toggleTagFilter | LibrarySidebar, FileListPanel |
| **uiStore** | searchQuery, showSettings, showDropInspector, showSidebar, sidebarWidth, isResizingSidebar, theme | setSearchQuery, setShowSettings 等 setter | App.tsx, LibrarySidebar, FileListPanel, SettingsDialog |

### 数据流

```
用户点击"播放"按钮
  → WaveformPlayer 调用 playerStore.togglePlay()
    → playerStore 更新 isPlaying 状态
    → 所有订阅 usePlayerStore((s) => s.isPlaying) 的组件自动重渲染
      → WaveformPlayer 按钮图标从 ▶ 变为 ⏸
```

```
用户给文件打标签
  → TagInspector 调用 tagStore.handleAddTag()
    → tagStore 读取 playerStore.currentFile（跨 Store 取数据）
    → tagStore 调用 Electron IPC（通过 api.ts）
    → tag-domain-effects.ts 更新 libraryStore.tags（增量写入）
    → FileListPanel 自动重渲染（标签变化）
```

### App.tsx 的角色

App.tsx 目前做四件事：

```
1. 初始化：调用 libraryStore.initLibraries()（启动时加载素材库）
2. 挂载副作用 Hook：useThemeEffect()、usePlayerAudioEffect()、useSidebarResizeEffect()
3. 绑定 <audio> 元素
4. 顶部 Header（Logo、搜索、音量、设置）+ 底部 StatusBar + 弹窗控制
```

App.tsx **不传递任何业务数据给子组件**。子组件全部通过 `useXxxStore()` 自行订阅。

### 目录结构（渲染进程）

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # 顶层协调（无 Props drilling）
├── index.css                   # Tailwind + CSS 变量主题
│
├── stores/                     # Zustand Store
│   ├── libraryStore.ts         # 素材库状态 + 操作
│   ├── playerStore.ts          # 播放器状态 + 操作
│   ├── tagStore.ts             # 标签状态 + 操作
│   └── uiStore.ts              # UI 状态 + 操作
│
├── lib/                        # 纯函数 + 副作用（无 React 依赖）
│   ├── types.ts                # 所有类型定义
│   ├── api.ts                  # Electron IPC 调用封装
│   ├── bridge-contract.ts      # Bridge 接口契约
│   ├── utils.ts                # 通用工具函数（cn, formatTime）
│   ├── logger.ts               # 日志
│   ├── app-constants.ts        # 常量（TAG_GROUPS, LIBRARY_TYPES）
│   ├── file-filtering.ts       # 文件搜索/标签过滤
│   ├── file-list-state.ts      # 文件列表状态
│   ├── browser-waveform.ts     # 浏览器端波形生成
│   ├── tag-domain-state.ts     # 标签领域纯函数
│   ├── tag-domain-effects.ts   # 标签领域副作用
│   ├── tag-actions.ts          # 标签原子查询
│   ├── tag-inspector-state.ts  # 标签视图模型
│   ├── drag-state.ts           # 拖拽状态
│   ├── drag-debug-view-model.ts# 拖拽调试视图
│   ├── drop-inspector-state.ts # 拖放事件快照
│   ├── library-state.ts        # 素材库纯函数
│   ├── player-state.ts         # 播放器纯函数
│   ├── sidebar-resize-state.ts # 侧栏 resize 状态
│   ├── waveform-player-state.ts# 波形播放器辅助
│   ├── app-shell-actions.ts    # 顶层动作
│   ├── app-shell-view-model.ts # 视图模型
│   ├── app-effects.ts          # 应用级副作用
│   ├── app-orchestration.ts    # 应用编排工具
│   ├── audio-element-effects.ts# 音频元素绑定
│   ├── library-actions.ts      # 库原子查询
│   ├── library-domain-effects.ts# 库领域副作用
│   ├── player-actions.ts       # 播放器原子查询
│   ├── player-domain-effects.ts# 播放器领域副作用
│   ├── library-controller-state.ts # 库控制器状态
│   ├── player-controller-state.ts  # 播放器控制器状态
│   ├── library-management-actions.ts # 库管理操作
│   └── use-mini-waveform-preload.ts  # 迷你波形预加载 Hook
│
├── components/
│   ├── ui/                     # shadcn/ui 基础组件
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   └── input.tsx
│   ├── LibrarySidebar.tsx       # 左侧栏（自行订阅 Store）
│   ├── FileListPanel.tsx        # 文件列表：表格视图 + 波形 + 标签（自行订阅 Store）
│   ├── SettingsDialog.tsx       # 设置弹窗（标签页结构：外观/素材库/关于）
│   ├── StatusBar.tsx            # 底部状态栏（独立组件，避免根组件频繁重渲染）
│   ├── ErrorBoundary.tsx        # 错误边界
│   └── DropInspectorWindow.tsx  # 拖放调试窗口（可移除）
│
└── test/                       # Vitest 测试（26 文件，63 用例）
```

---

## 七、开发指引（给 AI 的指令模板）

> 本节是 vibe coding 的核心——每个功能的修改都按以下模板操作。
> 使用时，直接粘贴对应模板 + 你的需求给 AI。

### 快速理解架构

```
┌──────────────────────────────────────────┐
│ 你只需要记住一个原则：                      │
│                                          │
│  每个组件用 useXxxStore() 自己拿数据      │
│  不需要父组件传 props                     │
│                                          │
│  想改一个组件 → 打开那个文件 → 改     │
│  想新增一个功能 → 找到对应 Store → 加 action │
│  想新增一个组件 → 从 Store 读数据写 UI   │
└──────────────────────────────────────────┘
```

**四个 Store 分别是**：
- `useLibraryStore()` → 素材库的一切（文件列表、文件夹树、标签数据、索引）
- `usePlayerStore()` → 播放器的一切（当前文件、播放状态、音量）
- `useTagStore()` → 标签操作的一切（添加/删除标签、筛选、采纳建议）
- `useUiStore()` → UI 状态的一切（搜索词、弹窗开关、侧栏宽度、主题）

**使用 Store 的两种姿势**：
```typescript
// 姿势 1：订阅单个值（组件会随这个值变化而重渲染）
const currentFile = usePlayerStore((s) => s.currentFile);

// 姿势 2：在回调/事件中临时读取（不需要订阅）
const handleClick = () => {
  const state = usePlayerStore.getState();
  state.togglePlay();
};
```

**跨 Store 通信**：Store 之间可以通过 `useXxxStore.getState()` 互相读取，无需 Props drilling。

### 通用修改流程

```
修改任何功能请遵循以下步骤：
1. 修改纯函数：src/lib/*.ts（如果需要新增逻辑函数）
2. 修改副作用：src/lib/*-effects.ts（如果需要调 Electron API 后的处理）
3. 修改 Store：src/stores/xxxStore.ts（暴露新状态或新操作）
4. 修改组件：src/components/Xxx.tsx（用 useXxxStore() 读取新状态）
5. 确保 type 定义一致：src/lib/types.ts
```

### 新增标签功能

```
如需新增标签相关功能，按此顺序修改文件：

1. src/lib/tag-domain-state.ts
   新增纯函数处理标签数据转换
2. src/lib/tag-domain-effects.ts
   新增副作用编排（如果需要调用 Electron API）
3. src/stores/tagStore.ts
   暴露新状态和操作
4. src/components/FileListPanel.tsx（TagEditorPopup 内部组件）
   用 useTagStore() 读取新数据，添加对应 UI
```

### 新增 UI 功能

```
如需新增 UI 组件或修改 UI：

1. src/lib/types.ts（如果需要新类型）
2. src/stores/xxxStore.ts（如果需要新状态，用 set() 加一个字段）
3. src/components/YourNewComponent.tsx
   用 useXxxStore() 自行读取数据，不需要父组件传 props
4. src/App.tsx（如果需要在顶层挂载新组件，直接加一行 <YourNewComponent />）
```

---

## 八、开发计划

### 当前状态

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 标签视图（按标签聚合浏览） | P0 | ⏳ 下一项 |
| 批量打标签（多选 + 批量操作） | P0 | ⏳ 待开始 |
| 标签自动补全 | P0 | ⏳ 待开始 |
| 文件夹树展开状态持久化 + 文件计数 | P0 | ⏳ 待开始 |
| 标签预设 | P0 | ⏳ 待开始 |
| 标签统计面板 | P1 | ⏳ 待开始 |
| 快捷键系统 | P1 | ⏳ 待开始 |
| 标签导入/导出 | P1 | ⏳ 待开始 |
| 补充 Electron 主进程单元测试 | P1 | ⏳ 待开始 |

### 已完成的里程碑

- [x] 引入 Zustand，创建 4 个 Store，消除 Props drilling
- [x] 界面重构为表格视图（三列布局、可拖拽列宽）
- [x] 主题系统（4套配色）
- [x] 三级波形预载 + 整库后台预载
- [x] Duration 预载（getAudioMeta）
- [x] 点击波形定位播放 + Range 协议支持
- [x] 全局搜索框
- [x] 波形缓存稳定性修复（contentId 去 mtimeMs）
- [x] 播放架构重构（selectFile 单一控制点 + audioLoadId 代际隔离）
- [x] 音频格式扩展至 .ogg .flac .aac
- [x] 标签存储分片升级 + 原子写入 + 旧格式迁移
- [x] v1.3 全项目审阅 + 6 项高优问题修复

### 迭代说明

> 每次迭代请只改 1-2 个功能，改完后跑 `npm run test` 确认测试通过，
> 再手动打开应用验证修改正确后，再进入下一个功能。

---

## 九、测试策略

### 规则

> ⚠️ **新代码必须有新测试。** 任何新增或修改的纯函数（`lib/*.ts`），必须在同一次提交中附带对应测试。
> 修改涉及 `electron/` 目录时，提交前必须运行 `npm run electron:build`。

### 交付前自检（不可跳过）

```
npm run test              ← 全部测试必须通过
npm run electron:build    ← 修改了 electron/ 目录时必须执行
```

### 覆盖范围

| 类型 | 覆盖范围 | 说明 |
|------|----------|------|
| **单元测试（纯函数）** | src/lib/*.ts | ✅ 85 用例，覆盖 26/29 需测试文件 |
| **主进程测试** | electron/*.ts | ❌ 3 个集成测试，其余未覆盖 |
| **组件集成测试** | components/*.tsx | ❌ 未覆盖 |

---

## 十、相关文档

| 文档 | 用途 |
|------|------|
| [CHANGELOG.md](./CHANGELOG.md) | 各版本修改记录（按时间倒序） |
| [AUDIT.md](./AUDIT.md) | 代码审阅记录与问题追踪 |
| [README.md](./README.md) | 项目介绍 |

---

*本文档随项目迭代持续更新。修改记录请写入 CHANGELOG.md，审阅记录请写入 AUDIT.md。*
