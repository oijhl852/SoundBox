import { Button } from "@/components/ui/button";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { usePlayerStore, audioRef, progressRef } from "@/stores/playerStore";
import { buildProgressPercent } from "@/lib/waveform-player-state";

export function WaveformPlayer() {
  const currentFile = usePlayerStore((s) => s.currentFile);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const volume = usePlayerStore((s) => s.volume);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const handleProgressClick = usePlayerStore((s) => s.handleProgressClick);
  const formatTime = usePlayerStore((s) => s.formatTime);

  const handleSkipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const handleSkipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
    }
  };

  return (
    <>
      {/* 隐藏的 audio 元素 */}
      <audio ref={audioRef as React.RefObject<HTMLAudioElement>} preload="metadata" />

      <div className="border-t px-4 py-3 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay} disabled={!currentFile || isLoading}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!currentFile} onClick={handleSkipBack}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!currentFile} onClick={handleSkipForward}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 px-2 text-sm text-muted-foreground truncate">
            {currentFile?.name ?? "选择一个音频文件"}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
          <div
            ref={progressRef as React.RefObject<HTMLDivElement>}
            className="flex-1 h-2 bg-muted rounded-full cursor-pointer"
            onClick={handleProgressClick}
          >
            {duration > 0 && (
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${buildProgressPercent(currentTime, duration)}%` }}
              />
            )}
          </div>
          <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
        </div>
      </div>
    </>
  );
}
