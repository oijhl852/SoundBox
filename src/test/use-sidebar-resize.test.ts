import { describe, expect, it } from "vitest";
import { buildSidebarResizeEndState, buildSidebarResizeState } from "@/lib/sidebar-resize-state";


describe("sidebar-resize-state", () => {

  it("builds clamped sidebar width while resizing", () => {
    expect(buildSidebarResizeState(true, 100)).toEqual({ isResizingSidebar: true, sidebarWidth: 180 });
    expect(buildSidebarResizeState(true, 260)).toEqual({ isResizingSidebar: true, sidebarWidth: 260 });
  });

  it("finishes resize state cleanly", () => {
    expect(buildSidebarResizeEndState()).toEqual({ isResizingSidebar: false });
  });

});
