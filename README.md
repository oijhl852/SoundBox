# Soundbox

一个以 `Electron + React + TypeScript` 为当前唯一主线的本地音频素材管理桌面应用。

## 当前状态

- 主线宿主：`Electron`
- 前端：`React` + `Vite` + `TypeScript`
- 项目已彻底移除 `Tauri` 主线，仅保留 `Electron` 方案

## 常用命令

```bash
npm run electron:dev
npm run electron:build
npm run electron:start
npm run test
npm run lint
```

## 目录说明

- `src/`：前端界面与业务逻辑
- `electron/`：Electron 主进程与桥接逻辑
- `src/test/`：前端逻辑测试

