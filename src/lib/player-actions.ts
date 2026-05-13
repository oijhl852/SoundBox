export function computeSeekTime(duration: number, percent: number): number {
  if (!isFinite(duration) || duration <= 0) {
    return 0;
  }

  const safePercent = Math.min(1, Math.max(0, percent));
  return safePercent * duration;
}

export function computeVolumeForAudio(volume: number, isMuted: boolean): number {
  return isMuted ? 0 : volume;
}

export function shouldAutoplayNextSource(currentJobId: number, activeJobId: number): boolean {
  return currentJobId === activeJobId;
}
