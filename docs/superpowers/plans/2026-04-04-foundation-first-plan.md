# Soundbox Foundation First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Soundbox 从迁移后修补态推进到“底层成熟态”，优先打牢底层代码与整体框架，让后续功能恢复和功能新增都建立在清晰、稳定、可测试的底层基础之上。


**Architecture:** 以当前 Electron + React 主线为基础，不再重复已完成的迁移建制工作，而是围绕 `App.tsx`、前端业务逻辑层和 Electron 宿主层继续做结构重整。通过“先校准文档与真实状态 → 已落地纯逻辑继续扩展 → 行为模块化 → 顶层编排收口 → 宿主服务化 → 模块级测试体系”这一顺序推进，避免再次回到随机修补状态。

**Tech Stack:** Electron、React 19、TypeScript、Vitest、react-window、Vite

> 2026-04-04 审查补充：仓库已完成 Tauri 主线清理、新阶段设计文档建立、`file-filtering`/`library-state` 等底层模块落地，以及一批真实测试。本计划后续任务以“继续深化底层成熟度与稳定性”为准，而不是以功能恢复为第一驱动。


---

## File Structure

### Existing files to modify
- `electron-migration-plan.md`
  - 改为历史留档定位说明。
- `electron-migration-log.md`
  - 改为历史留档定位说明，并明确新阶段已切换。
- `src/App.tsx`
  - 继续收口为编排层。
- `src/lib/api.ts`
  - 保持稳定桥接协议；必要时补测试驱动的小幅清理。
- `electron/main.ts`
  - 后续阶段继续减重，逐步让其更像入口和路由层。
- `src/components/FileListPanel.tsx`
  - 已虚拟化，后续只做与新结构的适配。
- `src/components/TagInspector.tsx`
  - 后续配合标签动作层拆分。
- `src/components/WaveformPlayer.tsx`
  - 后续配合播放行为层拆分。
- `src/test/p0-bridge-and-race.test.ts`
- `src/test/p0-app-logic.test.ts`
- `src/test/file-filtering.test.ts`
- `src/test/library-state.test.ts`
- `src/test/core-logic.test.tsx`

### Existing files already stable enough to keep as boundaries
- `electron/audio.ts`
- `electron/ffmpeg.ts`
- `electron/system.ts`
- `electron/preload.ts`
- `src/electron-env.d.ts`
- `src/lib/file-filtering.ts`
- `src/lib/library-state.ts`
- `src/lib/types.ts`

### New files already created in this phase
- `src/lib/player-state.ts`
- `src/lib/player-actions.ts`
- `src/lib/tag-actions.ts`
- `src/lib/library-actions.ts`
- `src/lib/file-list-state.ts`
- `src/lib/drag-state.ts`
- `src/lib/tag-inspector-state.ts`
- `src/lib/drop-inspector-state.ts`
- `electron/library.ts`
- `electron/tags.ts`
- `electron/protocols.ts`
- `src/test/player-state.test.ts`
- `src/test/library-actions.test.ts`
- `src/test/tag-and-drag-state.test.ts`
- `src/test/tag-inspector-state.test.ts`
- `src/test/drop-inspector-state.test.ts`
- `docs/superpowers/specs/2026-04-04-foundation-first-design.md`


---

## Task 1: 归档旧迁移文档并建立新阶段入口

**Files:**
- Modify: `electron-migration-plan.md`
- Modify: `electron-migration-log.md`
- Create: `docs/superpowers/specs/2026-04-04-foundation-first-design.md`

- [ ] **Step 1: 在 `electron-migration-plan.md` 顶部增加“历史留档”说明**

补入说明，明确该文档现在的角色是：
- 迁移背景档案
- 历史方案参考
- 不再是当前主线设计文档

- [ ] **Step 2: 在 `electron-migration-log.md` 顶部增加“阶段切换”说明**

补入说明，明确该文档现在的角色是：
- 迁移与修复历史记录
- 不再作为当前阶段实施主文档
- 新阶段以 `Foundation First` 设计文档为准

- [ ] **Step 3: 运行最小验证**

Run: `npm test -- src/test/core-logic.test.tsx`
Expected: PASS

- [ ] **Step 4: 更新 todo / 阶段说明**

确认仓库里存在并可引用：
- `docs/superpowers/specs/2026-04-04-foundation-first-design.md`

---

## Task 2: 将播放链路从 `App.tsx` 抽离为独立模块

**Files:**
- Create: `src/lib/player-state.ts`
- Create: `src/lib/player-actions.ts`
- Modify: `src/App.tsx`
- Modify: `src/test/core-logic.test.tsx`

- [ ] **Step 1: 写失败测试，定义播放状态纯逻辑接口**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 在 `player-state.ts` 中承载播放状态结构与纯转换**
- [ ] **Step 4: 在 `player-actions.ts` 中承载播放行为动作（如切换文件、seek、安全播放切换）**
- [ ] **Step 5: `App.tsx` 改为调用新模块而不是内联处理**
- [ ] **Step 6: 跑测试并确认通过**

---

## Task 3: 将标签行为从 `App.tsx` 抽离为独立模块

**Files:**
- Create: `src/lib/tag-actions.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TagInspector.tsx`
- Test: `src/test/library-state.test.ts`

- [ ] **Step 1: 写失败测试，定义标签动作接口**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 抽出添加标签、删除标签、采纳建议等行为**
- [ ] **Step 4: `App.tsx` 与 `TagInspector.tsx` 改为消费该动作层**
- [ ] **Step 5: 跑测试并确认通过**

---

## Task 4: 将素材库行为从 `App.tsx` 抽离为独立模块

**Files:**
- Create: `src/lib/library-actions.ts`
- Modify: `src/App.tsx`
- Test: `src/test/p0-app-logic.test.ts`

- [ ] **Step 1: 写失败测试，约束素材库切换与后台索引行为**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 抽出素材库选择、删除、快照刷新等行为**
- [ ] **Step 4: 保留 `App.tsx` 仅负责装配和少量状态持有**
- [ ] **Step 5: 跑测试并确认通过**

---

## Task 5: 将文件列表派生状态继续模块化

**Files:**
- Create: `src/lib/file-list-state.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/FileListPanel.tsx`
- Test: `src/test/file-filtering.test.ts`

- [ ] **Step 1: 写失败测试，定义列表派生状态接口**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 把当前列表所需的组合状态继续从 `App.tsx` 下沉**
- [ ] **Step 4: `FileListPanel.tsx` 只消费已派生的数据**
- [ ] **Step 5: 跑测试并确认通过**

---

## Task 6: 建立拖放状态与调试的独立边界

**Files:**
- Create: `src/lib/drag-state.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/DropInspectorWindow.tsx`
- Test: `src/test/p0-bridge-and-race.test.ts`

- [ ] **Step 1: 写失败测试，约束拖放状态读取与空值处理**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 抽出拖放调试状态读取与展示映射逻辑**
- [ ] **Step 4: 让 `App.tsx` 和 `DropInspectorWindow.tsx` 只消费该层结果**
- [ ] **Step 5: 跑测试并确认通过**

---

## Task 7: 继续减重 `electron/main.ts`

**Files:**
- Modify: `electron/main.ts`
- Optional Create: `electron/library.ts`
- Optional Create: `electron/tags.ts`
- Optional Create: `electron/protocols.ts`

- [ ] **Step 1: 识别 `main.ts` 中仍适合下沉的职责**
- [ ] **Step 2: 优先抽离索引/标签/协议注册中的纯宿主服务逻辑**
- [ ] **Step 3: 保持 `main.ts` 更像入口和路由层**
- [ ] **Step 4: 运行 `npm run electron:build` 验证通过**

---

## Task 8: 建立 Foundation First 阶段验收

**Files:**
- Modify: `electron-migration-log.md`
- Modify: `P0-P1-fix-summary.md`
- Test: all current test files

- [ ] **Step 1: 汇总本阶段新增模块和边界**
- [ ] **Step 2: 记录哪些逻辑已从 `App.tsx` 下沉**
- [ ] **Step 3: 记录哪些能力已拥有测试护栏**
- [ ] **Step 4: 运行最终验收命令**

Run: `npm test && npm run electron:build`
Expected:
- 全部测试通过
- Electron 编译通过

- [ ] **Step 5: 用以下标准判定 Foundation First 阶段完成**
- `App.tsx` 已明显成为编排层
- 核心业务逻辑已模块化归位
- 宿主层职责更清晰
- 测试已围绕模块边界建立基础护栏
- 后续功能开发已具备清晰模板

---

## Self-Review

- 已覆盖旧文档归档、新阶段建制、前端行为层拆分、宿主层继续减重、阶段验收。
- 没有使用 TBD/TODO 等占位描述来代替任务目标。
- 计划明确服务于“Foundation First”，而不是继续迁移期修补。
