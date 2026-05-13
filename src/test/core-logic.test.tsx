import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileListPanel } from "@/components/FileListPanel";
import { getDragStateSummary } from "@/lib/drag-state";
import { useLibraryStore } from "@/stores/libraryStore";
import { useUiStore } from "@/stores/uiStore";
import { useTagStore } from "@/stores/tagStore";

describe("FileListPanel", () => {
  beforeEach(() => {
    // 重置所有 Store 到空状态
    useLibraryStore.setState({
      folderTree: [],
      selectedFolderPath: null,
      contentIndex: null,
      tags: {},
      nameSuggestions: {},
      allFiles: [],
      libraries: [{ name: "测试库", path: "/test", lib_type: "music" }],
      libraryLoadState: { status: "ready" },
    });
    useUiStore.setState({ searchQuery: "" });
    useTagStore.setState({ tagFilters: new Set() });
  });

  it("renders empty state when there are no files", () => {
    render(<FileListPanel onSelectFile={vi.fn()} />);

    expect(screen.getByPlaceholderText("搜索文件名、标签或氛围...")).toBeInTheDocument();
    expect(screen.getByText("未找到匹配的素材")).toBeInTheDocument();
  });

  it("formats drag summary through derived helper", () => {
    expect(getDragStateSummary(null)).toBe("waiting");
    expect(getDragStateSummary({ detail: "ready", error: null } as never)).toBe("ready");
  });
});
