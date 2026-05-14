import { describe, expect, it, vi } from "vitest";
import { createAudioElementBindings } from "@/lib/audio-element-effects";

import { createInitialPlayerState } from "@/lib/player-state";

describe("audio-element-effects", () => {

  it("binds and unbinds audio events", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const audio = {
      currentTime: 0,
      duration: 12,
      paused: true,
      ended: false,
      addEventListener,
      removeEventListener,
    } as unknown as HTMLAudioElement;

    const cleanup = createAudioElementBindings({
      audio,
      requestAnimationFrameImpl: vi.fn((cb) => {
        cb(0);
        return 1;
      }) as unknown as typeof requestAnimationFrame,
      cancelAnimationFrameImpl: vi.fn(),
      setPlayerState: vi.fn(),
      playheadRafRef: { current: null },
    });

    expect(addEventListener).toHaveBeenCalledTimes(8);
    cleanup();
    expect(removeEventListener).toHaveBeenCalledTimes(8);
  });

  it("updates state through handlers without throwing", () => {
    const handlers = new Map<string, EventListener>();
    const audio = {
      currentTime: 5,
      duration: 20,
      paused: false,
      ended: false,
      addEventListener: vi.fn((name: string, handler: EventListener) => handlers.set(name, handler)),
      removeEventListener: vi.fn(),
    } as unknown as HTMLAudioElement;

    const updates: Array<ReturnType<typeof createInitialPlayerState>> = [];
    createAudioElementBindings({
      audio,
      requestAnimationFrameImpl: vi.fn(() => 1) as unknown as typeof requestAnimationFrame,
      cancelAnimationFrameImpl: vi.fn(),
      setPlayerState: (updater) => updates.push(updater(createInitialPlayerState())),
      playheadRafRef: { current: null },
    });

    handlers.get("loadedmetadata")?.(new Event("loadedmetadata"));
    handlers.get("play")?.(new Event("play"));
    handlers.get("pause")?.(new Event("pause"));
    handlers.get("ended")?.(new Event("ended"));
    handlers.get("error")?.(new Event("error"));

    expect(updates.length).toBeGreaterThan(0);
  });
});
