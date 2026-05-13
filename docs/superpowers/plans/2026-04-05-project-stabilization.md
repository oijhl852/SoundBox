# Project Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 `soundbox` 项目从“结构未收口的可迭代状态”推进到“主线清晰、关键模块职责稳定、便于继续扩展”的状态。

**Architecture:** 采用“最小行为改动、逐层收口”的策略，先清理 Electron 入口主线，再给主进程大文件减重，随后收拢前端总控编排职责，最后统一类型与命名边界。每一阶段都以“行为不变、结构更清晰、验证可通过”为准。

**Tech Stack:** `Electron`, `React`, `TypeScript`, `Vite`, `Vitest`, `ESLint`

---

### Task 1: 收口 Electron 主入口

**Files:**
- Modify: `electron/main.ts`
- Reference: `electron/window.ts`
- Reference: `electron/ipc-handlers.ts`
- Test: `npm run test`
- Test: `npm run lint`

- [ ] **Step 1: 备份并阅读当前入口主线**

确认 `electron/main.ts` 中只保留三类职责：应用启动、协议注册、窗口生命周期。删除目标是“文件内重复逻辑”，不是删除文件。

- [ ] **Step 2: 将 `electron/main.ts` 改为只调用已抽出的模块**

将入口整理为只依赖：

```ts
import { app, BrowserWindow, ipcMain, protocol } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerLocalAudioProtocol } from "./protocols.js";
import { registerSoundboxIpcHandlers } from "./ipc-handlers.js";
import { createMainWindow, resolveWindowPaths } from "./window.js";
import { log } from "../src/lib/logger.js";
```

并在文件中定义：

```ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const windowPaths = resolveWindowPaths(__dirname);
```

- [ ] **Step 3: 删除入口里的重复 IPC 与窗口实现**

确保 `electron/main.ts` 不再保留以下自定义实现：

```ts
function registerIpcHandlers() { ... }
function createMainWindow() { ... }
```

入口应只保留：

```ts
app.whenReady().then(() => {
  log("info", "[main] app:ready");
  registerLocalAudioProtocol(protocol);
  registerSoundboxIpcHandlers(ipcMain);
  createMainWindow({
    devServerUrl: DEV_SERVER_URL,
    preloadPath: windowPaths.preloadPath,
    distIndexPath: windowPaths.distIndexPath,
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({
        devServerUrl: DEV_SERVER_URL,
        preloadPath: windowPaths.preloadPath,
        distIndexPath: windowPaths.distIndexPath,
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

- [ ] **Step 4: 运行测试验证未破坏主线**

Run: `cd d:/神奇妙妙工具/soundbox; npm run test`
Expected: 测试通过；至少不再出现 `electron/main.ts` 相关入口冲突。

- [ ] **Step 5: 运行 lint 验证入口文件干净**

Run: `cd d:/神奇妙妙工具/soundbox; npm run lint`
Expected: `electron/main.ts` 不应再出现未定义符号、重复实现导致的问题。

---

### Task 2: 给 `electron/library.ts` 减重并稳定职责边界

**Files:**
- Modify: `electron/library.ts`
- Create: `electron/library-scan.ts`（如果需要）
- Create: `electron/library-signature.ts`（如果需要）
- Reference: `electron/library-domain.ts`
- Reference: `electron/library-storage.ts`
- Test: `src/test/library-service.test.ts`
- Test: `npm run test`

- [ ] **Step 1: 锁定 `library.ts` 中的可拆职责**

拆分目标仅限两类纯能力：
1. 目录扫描 / 树构建
2. 签名计算 / 缓存新鲜度判断

不要修改对外导出：

```ts
export function createLibraryService(getAppDataDir: () => string)
```

- [ ] **Step 2: 提取扫描相关纯函数**

把以下函数迁出 `library.ts` 到更专注的文件（若拆分收益明确）：

```ts
async function buildDirectoryPreview(...)
function buildTreeFromFileIndex(...)
async function scanDirectoryWithIndex(...)
```

迁出后由 `library.ts` 通过 import 调用，保持返回值与调用方式不变。

- [ ] **Step 3: 提取签名与缓存判断相关纯函数**

把以下函数迁出 `library.ts` 到更专注的文件（若拆分收益明确）：

```ts
async function listAudioFilesForSignature(...)
async function computeLibrarySignature(...)
```

并把 `buildLibrarySnapshot()` 中缓存新鲜度判断整理为清晰的局部流程，避免大段内联。

- [ ] **Step 4: 保持 service API 完全不变**

确保以下调用仍然成立：

```ts
const service = createLibraryService(() => appDataDir);
await service.buildLibrarySnapshot(libraryDir);
await service.buildLibraryIndex(libraryDir);
```

- [ ] **Step 5: 运行聚焦测试**

Run: `cd d:/神奇妙妙工具/soundbox; npx vitest run src/test/library-service.test.ts`
Expected: `library service` 相关测试通过。

- [ ] **Step 6: 运行全量测试**

Run: `cd d:/神奇妙妙工具/soundbox; npm run test`
Expected: 全量测试通过，说明行为未变。

---

### Task 3: 收拢 `App.tsx` 编排职责

**Files:**
- Modify: `src/App.tsx`
- Create: `src/lib/app-constants.ts`（如果需要）
- Create: `src/lib/use-mini-waveform-preload.ts`（如果需要）
- Reference: `src/hooks/useLibraryDomain.ts`
- Reference: `src/hooks/usePlayerDomain.ts`
- Reference: `src/hooks/useTagDomain.ts`
- Test: `src/test/use-app-shell-view.test.ts`
- Test: `npm run test`

- [ ] **Step 1: 锁定应从 `App.tsx` 外移的非装配逻辑**

优先外移以下内容：

```ts
const TAG_GROUPS = ...
const LIBRARY_TYPES = ...
useEffect(() => { mini waveform preload ... })
```

`App.tsx` 应尽量只保留：状态装配、组件拼装、事件转接。

- [ ] **Step 2: 提取常量定义**

将 UI 常量收敛到独立文件，例如：

```ts
export const TAG_GROUPS = [...];
export const LIBRARY_TYPES = [...];
```

- [ ] **Step 3: 提取 mini waveform 预加载逻辑**

把如下逻辑移到独立 hook 或 lib 函数：

```ts
useEffect(() => {
  if (filteredFiles.length === 0) return;
  const missingFiles = buildMissingMiniWaveformFiles(...);
  ...
});
```

要求新抽出的单元只负责“计算缺失项 + 拉取波形 + 提交批量结果”，不处理页面 UI。

- [ ] **Step 4: 保留 `App.tsx` 行为不变**

以下页面装配关系必须保持：

```tsx
<LibrarySidebar ... />
<FileListPanel ... />
<WaveformPlayer ... />
<TagInspector ... />
<SettingsDialog ... />
```

- [ ] **Step 5: 运行测试验证页面编排未回归**

Run: `cd d:/神奇妙妙工具/soundbox; npm run test`
Expected: 相关 hook / app shell 测试继续通过。

---

### Task 4: 统一类型与命名边界

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/bridge-types.ts`（如果需要）
- Create: `src/lib/domain-types.ts`（如果需要）
- Modify: `src/lib/bridge-contract.ts`
- Modify: `src/lib/api.ts`
- Modify: `electron/*.ts`（仅限 import 调整）
- Test: `npm run test`
- Test: `npm run lint`

- [ ] **Step 1: 先做最小拆分，不做大规模改名**

优先把类型按用途分层：
1. 跨端桥接相关
2. 领域数据结构相关
3. renderer 视图相关

但不要一口气重命名所有类型，避免无谓风险。

- [ ] **Step 2: 调整 bridge 依赖只引用桥接所需类型**

例如 `src/lib/bridge-contract.ts` 应优先只引用桥接真正需要的类型，而不是整个类型全集。

- [ ] **Step 3: 清理命名漂移最明显的局部**

重点清理那些一眼就容易混淆的命名入口，而不是全项目强制统一。目标是降低维护者理解成本。

- [ ] **Step 4: 运行全量验证**

Run: `cd d:/神奇妙妙工具/soundbox; npm run test && npm run lint`
Expected: 全量验证通过，结构比之前更清晰，行为保持稳定。

---

### Task 5: 最终审阅与收口确认

**Files:**
- Review: `electron/main.ts`
- Review: `electron/library.ts`
- Review: `src/App.tsx`
- Review: `src/lib/types.ts`
- Review: `docs/superpowers/plans/2026-04-05-project-stabilization.md`

- [ ] **Step 1: 逐文件确认职责是否收口**

核对标准：
- `electron/main.ts` 是否只剩入口职责
- `electron/library.ts` 是否不再承担过多纯能力实现
- `src/App.tsx` 是否主要负责装配
- 类型文件是否比之前边界更清楚

- [ ] **Step 2: 记录未完成但可接受的残留项**

如果仍有非阻塞残留，只记录，不顺手扩展。保持本轮目标聚焦。

- [ ] **Step 3: 给出最终收口结论**

输出最终结论时，只回答：
1. 已完成的结构改进
2. 仍存在但不阻塞的残留问题
3. 项目成熟度相较起点的提升
