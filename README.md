# Soundbox

![version](https://img.shields.io/badge/version-1.0.0-blue) ![Electron](https://img.shields.io/badge/Electron-37+-47848F) ![React](https://img.shields.io/badge/React-19-61DAFB)

一款面向视频后期制作人员的本地音频素材管理桌面工具。

> 告别混乱的文件夹翻找，用波形预览 + 标签系统高效管理你的 BGM、音效素材库。

---

## ✨ 功能

| 功能 | 说明 |
|------|------|
| **波形预览** | 点击波形任意位置，从点击处开始播放 |
| **标签管理** | 情绪/能量/类型等多维度标签，支持分组筛选 |
| **文件搜索** | 按文件名、标签组合搜索 |
| **内容去重** | 自动识别重复音频文件（基于内容哈希） |
| **文件拖出** | 拖拽文件到 PR、剪映、桌面等外部应用 |
| **素材库** | 管理多个素材目录，切换即开 |
| **可调列宽** | 文件名/波形/标签列可拖拽调整宽度 |
| **表格视图** | 紧凑表格布局，一屏浏览大量素材 |

---

## 📦 下载安装

### 方式一：安装版（推荐）

下载 `Soundbox Setup 1.0.0.exe`，双击安装。

### 方式二：免安装版

下载 `Soundbox-v1.0.0-win64.zip`，解压后运行 `Soundbox.exe`。

> 需要 [ffmpeg](https://ffmpeg.org/) 生成波形，已内置在安装包中。

---

## 🔧 从源码构建

### 环境要求

- Node.js 18+
- npm

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run electron:dev

# 运行测试
npm run test

# 生产构建
npm run build

# 启动生产版
npm run electron:start

# 打包为 EXE 安装程序
npm run pack
```

---

## 🏗️ 技术栈

| 层面 | 技术 |
|------|------|
| 桌面框架 | Electron 37 |
| 前端框架 | React 19 + TypeScript 5.9 |
| 构建工具 | Vite 6 |
| 样式方案 | TailwindCSS v4 + shadcn/ui |
| 状态管理 | Zustand |
| 虚拟列表 | react-window |
| 波形方案 | ffmpeg + 波形缓存 (LRU) |
| 数据存储 | JSON 文件索引 |
| 测试 | Vitest + Testing Library |

---

## 🧠 架构

```
src/
├── App.tsx            # 顶层协调（70行）
├── stores/            # Zustand 状态管理
│   ├── libraryStore   # 素材库、索引
│   ├── playerStore    # 播放器控制
│   ├── tagStore       # 标签操作
│   └── uiStore        # 搜索、弹窗
├── components/        # React 组件
│   ├── FileListPanel  # 文件列表（表格视图）
│   ├── LibrarySidebar # 左侧栏
│   └── ...
├── lib/               # 纯函数 + 副作用
└── test/              # 测试
electron/              # Electron 主进程
```

核心设计：**组件通过 Zustand Store 自行订阅数据**，无 Props drilling。

---

## 📝 License

MIT
