# App Shell Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/App.tsx` 收口为页面壳与顶层装配器，把素材库、播放、标签、mini waveform、拖放调试与侧边栏拖拽的编排逻辑迁移到明确的 controller / hook 与纯逻辑模块中。

**Architecture:** 保留现有 `src/lib/*.ts` 纯逻辑层作为规则基础，在其之上新增少量顶层 hook 作为 orchestration 边界。实施顺序遵循“先 library flow，再 player flow，再 tag flow，最后补 mini waveform / drag debug / sidebar resize”的拆分路径，保证每一步都有测试与验证支撑。

**Tech Stack:** React 19、TypeScript、Electron、Vitest、Vite

---

## File Structure

### Create
- `src/lib/use-app-bootstrap.ts`
- `src/lib/use-library-controller.ts`
- `src/lib/use-player-controller.ts`
- `src/lib/use-tag-controller.ts`
- `src/lib/use-mini-waveforms.ts`
- `src/lib/use-drag-debug.ts`
- `src/lib/use-sidebar-resize.ts`
- `src/test/use-library-controller.test.ts`
- `src/test/use-player-controller.test.ts`
- `src/test/use-tag-controller.test.ts`
- `src/test/use-mini-waveforms.test.ts`
- `src/test/use-sidebar-resize.test.ts`

### Modify
- `src/App.tsx`
- `src/test/app-orchestration.test.ts`
- `src/test/app-shell-actions.test.ts`
- `src/test/library-management-actions.test.ts`

### Keep as shared boundaries
- `src/lib/app-orchestration.ts`
- `src/lib/app-shell-actions.ts`
- `src/lib/library-actions.ts`
- `src/lib/library-management-actions.ts`
- `src/lib/player-state.ts`
- `src/lib/player-actions.ts`
- `src/lib/tag-actions.ts`
- `src/lib/file-filtering.ts`
- `src/lib/file-list-state.ts`
- `src/lib/library-state.ts`
- `src/lib/drag-state.ts`

---

## Task 1: 收口 bootstrap 与 library flow

**Files:**
- Create: `src/lib/use-app-bootstrap.ts`
- Create: `src/lib/use-library-controller.ts`
- Modify: `src/App.tsx`
- Test: `src/test/use-library-controller.test.ts`
- Modify: `src/test/app-orchestration.test.ts`
- Modify: `src/test/library-management-actions.test.ts`

- [ ] **Step 1: 先写失败测试，定义 library controller 的核心行为**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 提取 bootstrap 逻辑到 `use-app-bootstrap.ts`**
- [ ] **Step 4: 提取切库 / 快照应用 / 增删库 / 背景索引到 `use-library-controller.ts`**
- [ ] **Step 5: 调整 `App.tsx`，改为消费 controller 输出**
- [ ] **Step 6: 运行相关测试确认通过**

---

## Task 2: 收口 player flow

**Files:**
- Create: `src/lib/use-player-controller.ts`
- Modify: `src/App.tsx`
- Test: `src/test/use-player-controller.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖音频资源加载与播放状态同步**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 提取音频事件绑定与资源加载到 `use-player-controller.ts`**
- [ ] **Step 4: 调整 `App.tsx` 与 `WaveformPlayer` 接线**
- [ ] **Step 5: 运行相关测试确认通过**

---

## Task 3: 收口 tag flow

**Files:**
- Create: `src/lib/use-tag-controller.ts`
- Modify: `src/App.tsx`
- Test: `src/test/use-tag-controller.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖添加标签、删除标签、采纳建议与刷新**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 提取标签编辑与动作编排到 `use-tag-controller.ts`**
- [ ] **Step 4: 调整 `App.tsx` 与 `TagInspector` 接线**
- [ ] **Step 5: 运行相关测试确认通过**

---

## Task 4: 收口 mini waveform / drag debug / sidebar resize

**Files:**
- Create: `src/lib/use-mini-waveforms.ts`
- Create: `src/lib/use-drag-debug.ts`
- Create: `src/lib/use-sidebar-resize.ts`
- Modify: `src/App.tsx`
- Test: `src/test/use-mini-waveforms.test.ts`
- Test: `src/test/use-sidebar-resize.test.ts`
- Modify: `src/test/app-shell-actions.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖 mini waveform 缺失补建规则**
- [ ] **Step 2: 写失败测试，覆盖 sidebar resize 生命周期行为**
- [ ] **Step 3: 运行测试确认失败**
- [ ] **Step 4: 提取 mini waveform、drag debug polling、sidebar resize 到独立 hook**
- [ ] **Step 5: 调整 `App.tsx` 接线**
- [ ] **Step 6: 运行相关测试确认通过**

---

## Task 5: 最终清理与验证

**Files:**
- Modify: `src/App.tsx`
- Test: `src/test/*.test.ts*`

- [ ] **Step 1: 清理 `App.tsx` 中不再需要的 import、ref、effect、callback**
- [ ] **Step 2: 检查 `App.tsx` 是否只剩页面壳与装配职责**
- [ ] **Step 3: 运行 `npm run test`**
- [ ] **Step 4: 运行 `npm run lint`**
- [ ] **Step 5: 运行 `npm run electron:build`**
- [ ] **Step 6: 根据验证结果做最后修正**

---

## Self-Review

- 计划覆盖了 `App.tsx` 彻底拆分所需的主要职责边界。
- 先设计，再分阶段执行，符合当前仓库的 Foundation First 主线。
- 任务顺序遵循先重后轻、先主流程后辅助流程的拆分策略。
- 最终包含完整验证步骤，避免在没有证据的情况下宣称完成。
