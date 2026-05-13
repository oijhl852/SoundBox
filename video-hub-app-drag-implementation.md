# Video Hub App 拖拽功能实现源代码分析

> 项目：Video Hub App (开源)
> GitHub: https://github.com/whyboris/Video-Hub-App
> PR: #532 - 拖拽视频到外部编辑器

---

## 架构概览

Video Hub App 使用 **Angular + Electron** 架构：

- **渲染进程**：Angular 应用（TypeScript）
- **主进程**：Electron 主进程（TypeScript）
- **通信方式**：IPC（Inter-Process Communication）

---

## 完整代码实现

### 1. 主进程 IPC 处理（`node/main-ipc.ts`）

```typescript
/**
 * Handle dragging a file out of VHA into a video editor (e.g. Vegas or Premiere)
 * if `imgPath` points to a file that does not exist, replace with default image
 */
ipc.on('drag-video-out-of-electron', (event, filePath, imgPath): void => {
  fs.access(imgPath, fs.constants.F_OK, (err: any) => {
    if (!err) {
      // 图标文件存在，使用指定图标
      event.sender.startDrag({
        file: filePath,
        icon: imgPath,
      });
    } else {
      // 图标文件不存在，使用默认应用图标
      const tempIcon: string = app.isPackaged 
        ? './resources/assets/logo.png' 
        : './src/assets/logo.png';
      event.sender.startDrag({
        file: filePath,
        icon: tempIcon,
      });
    }
  });
});
```

**关键点**：
- 使用 `event.sender.startDrag()` 实现原生拖拽
- 先检查图标文件是否存在，避免错误
- 支持打包和开发两种环境的不同路径

---

### 2. 渲染进程：组件逻辑（`src/app/components/home.component.ts`）

```typescript
/**
 * Tell Electron to drag a file out of the app into the system
 * Used for dragging videos into video editors like Vegas and Premiere
 */
draggingVideoFile(event, item: ImageElement): void {
    event.preventDefault();  // 关键：阻止默认行为
    
    // 获取视频文件的完整路径
    const fullPath = this.filePathService.getPathFromImageElement(item);
    
    // 构建缩略图路径（作为拖拽时显示的图标）
    const imgPath = path.join(
        this.appState.selectedOutputFolder, 
        'vha-' + this.appState.hubName, 
        'thumbnails', 
        item.hash + '.jpg'
    );
    
    // 发送 IPC 消息到主进程
    this.electronService.ipcRenderer.send('drag-video-out-of-electron', fullPath, imgPath);
}
```

**关键点**：
- 必须调用 `event.preventDefault()` 阻止默认拖拽行为
- 使用服务获取文件路径，解耦逻辑
- 将缩略图作为拖拽图标，提升用户体验

---

### 3. 渲染进程：HTML 模板（`src/app/components/home.component.html`）

```html
<!-- 缩略图视图 -->
<app-thumbnail
  [draggable]="settingsButtons['dragVideoOutOfApp'].toggled"
  (dragstart)="draggingVideoFile($event, item)"
  ...其他属性...
>
</app-thumbnail>

<!-- 胶片条视图 -->
<app-filmstrip
  [draggable]="settingsButtons['dragVideoOutOfApp'].toggled"
  (dragstart)="draggingVideoFile($event, item)"
  ...其他属性...
>
</app-filmstrip>
```

**关键点**：
- `draggable` 属性通过设置开关控制
- 绑定 `dragstart` 事件到处理方法
- 支持多种视图模式

---

### 4. 文件路径服务（`src/app/components/views/file-path.service.ts`）

```typescript
@Injectable()
export class FilePathService {
  
  constructor(
    public sourceFolderService: SourceFolderService,
  ) { }

  /**
   * 根据 ImageElement 对象获取视频文件的完整路径
   */
  getPathFromImageElement(item: ImageElement): string {
    // 构建完整文件路径逻辑
    // ... 具体实现 ...
    return fullPath;
  }

  /**
   * 创建浏览器友好的文件路径
   */
  createFilePath(
    folderPath: string, 
    hubName: string, 
    subfolder: FolderType, 
    hash: string, 
    video?: boolean
  ): string {
    // 返回 file:// 格式的路径
    // ... 具体实现 ...
  }
}
```

**关键点**：
- 集中管理文件路径逻辑
- 支持跨平台路径处理
- 自动处理 URL 编码

---

### 5. 国际化配置（`i18n/en.json`）

```json
{
  "dragVideoOutOfApp": "Drag video outside of app",
  "dragVideoOutOfAppDescription": "Allow dragging videos outside of app",
  "dragVideoOutOfAppHint": "Drag videos outside of app",
  "dragVideoOutOfAppMoreInfo": "Useful for dragging videos directly into a video editor"
}
```

---

### 6. 设置按钮配置（`src/app/common/settings-buttons.ts`）

```typescript
export type SettingsButtonKey = 
  | 'dragVideoOutOfApp'
  | ...其他按钮...;

export const SettingsButtonsGroups: SettingsButtonGroup[] = [
  {
    title: 'Basic settings',
    buttons: [
      'darkMode',
      'doubleClickMode',
      'dragVideoOutOfApp',  // 新增的拖拽功能按钮
    ],
  },
  // ...其他分组...
];

export const SettingsButtons: { [key: string]: SettingsButton } = {
  'dragVideoOutOfApp': {
    description: 'dragVideoOutOfAppDescription',
    hidden: true,  // 默认隐藏
    iconName: 'drag',
    moreInfo: 'dragVideoOutOfAppMoreInfo',
    title: 'dragVideoOutOfApp',
    toggled: false,  // 默认关闭
  },
  // ...其他按钮...
};
```

---

## 实现流程图

```
用户开始拖拽视频缩略图
         ↓
   触发 dragstart 事件
         ↓
   home.component.ts
   draggingVideoFile() 方法
         ↓
   1. event.preventDefault()
   2. 获取视频文件完整路径
   3. 构建缩略图路径
         ↓
   发送 IPC 消息：
   'drag-video-out-of-electron'
   参数：(filePath, imgPath)
         ↓
   主进程 main-ipc.ts
   接收 IPC 消息
         ↓
   检查图标文件是否存在
         ↓
   event.sender.startDrag({
     file: filePath,
     icon: imgPath
   })
         ↓
   Electron 接管拖拽
         ↓
   用户可将视频拖到：
   - 桌面
   - Premiere / Vegas
   - 文件夹
   - 任何支持文件拖拽的应用
```

---

## 与官方文档的差异

### 官方文档示例
```javascript
// 简单示例
ipcMain.on('ondragstart', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: '/path/to/icon.png'
  })
})
```

### Video Hub App 实现
```typescript
// 生产级实现
ipc.on('drag-video-out-of-electron', (event, filePath, imgPath): void => {
  fs.access(imgPath, fs.constants.F_OK, (err: any) => {
    if (!err) {
      event.sender.startDrag({ file: filePath, icon: imgPath });
    } else {
      // 容错处理：使用默认图标
      const tempIcon = app.isPackaged 
        ? './resources/assets/logo.png' 
        : './src/assets/logo.png';
      event.sender.startDrag({ file: filePath, icon: tempIcon });
    }
  });
});
```

**改进点**：
1. ✅ 图标文件存在性检查
2. ✅ 容错处理（使用默认图标）
3. ✅ 区分打包/开发环境
4. ✅ 使用视频缩略图作为拖拽图标（更好的用户体验）

---

## 技术亮点

### 1. 用户体验优化
- 拖拽时显示视频缩略图，直观明了
- 功能可通过设置开关控制
- 支持多种视图模式（缩略图、胶片条等）

### 2. 代码架构
- 服务化设计（FilePathService）
- 职责分离清晰
- IPC 通信集中管理

### 3. 容错处理
- 图标文件不存在时使用默认图标
- 区分打包和开发环境
- 错误处理完善

### 4. 可配置性
- 功能可通过设置开启/关闭
- 支持国际化
- 默认隐藏，不影响普通用户

---

## 实际应用场景

1. **视频编辑工作流**
   - 从 Video Hub App 浏览视频库
   - 直接拖拽视频到 Premiere/Vegas 时间线
   - 无需先导出或复制文件

2. **文件管理**
   - 拖拽到文件夹进行整理
   - 拖拽到其他应用进行分享

3. **快速预览**
   - 拖拽到播放器快速查看
   - 拖拽到转换工具处理

---

## 相关文件列表

| 文件路径 | 作用 |
|---------|------|
| `node/main-ipc.ts` | 主进程 IPC 处理 |
| `src/app/components/home.component.ts` | 主组件逻辑 |
| `src/app/components/home.component.html` | 主组件模板 |
| `src/app/components/views/file-path.service.ts` | 文件路径服务 |
| `src/app/common/settings-buttons.ts` | 设置按钮配置 |
| `i18n/en.json` | 国际化文本 |

---

## 总结

Video Hub App 的拖拽功能实现展示了 Electron 应用如何正确处理原生文件拖拽：

1. **使用官方 API**：`webContents.startDrag()`
2. **阻止默认行为**：`event.preventDefault()`
3. **IPC 通信机制**：渲染进程 ↔ 主进程
4. **良好的用户体验**：拖拽时显示缩略图
5. **完善的错误处理**：图标文件不存在时自动降级

这是一个生产级实现，比官方文档示例更加健壮和用户友好。

---

**整理时间**：2026年4月3日  
**源代码版本**：Video Hub App v3.2.0+  
**PR 合并时间**：2020年8月29日
