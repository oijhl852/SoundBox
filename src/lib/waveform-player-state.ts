export function clampSeekTarget(duration: number, currentTime: number, delta: number): number {
  return Math.min(duration, Math.max(0, currentTime + delta));
}

export function buildProgressPercent(currentTime: number, duration: number): number {
  if (!duration || Number.isNaN(duration)) {
    return 0;
  }

  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}
