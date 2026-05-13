import { BrowserWindow, WebContents, dialog, nativeImage, type NativeImage } from "electron";




export async function selectFolder() {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(window ?? undefined, {
    properties: ["openDirectory"],
    title: "选择素材库文件夹",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

/**
 * 解析拖拽图标。
 * 使用 createFromDataURL 生成 NativeImage，避免文件系统路径问题。
 * 必须同步执行。
 */
export function resolveDragPayload(filePath: string, _iconPath?: string) {
  let iconImage: NativeImage;
  try {
    // 1×1 黑色像素 PNG（已知有效的极小 PNG）
    iconImage = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    );
    if (iconImage.isEmpty()) {
      iconImage = nativeImage.createEmpty();
    }
  } catch {
    iconImage = nativeImage.createEmpty();
  }

  return {
    file: filePath,
    icon: iconImage,
  };
}


export function getDragSourceWindow(sender: WebContents) {
  return BrowserWindow.fromWebContents(sender);
}






