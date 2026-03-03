"use client";

import { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export function VideoPlayer({ src, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  const toggleMuted = () => setMuted(!muted);

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration)
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = (v / 100) * videoRef.current.duration;
      setProgress(v);
    }
  };

  const handleFullscreen = () => videoRef.current?.requestFullscreen?.();

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-black", className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        muted={muted}
      />
      <div className="flex items-center gap-2 border-t border-border bg-surface2/90 px-3 py-2">
        <button type="button" onClick={togglePlay} className="rounded-lg p-2 hover:bg-surface">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <input type="range" min={0} max={100} value={progress} onChange={handleSeek} className="flex-1" />
        <button type="button" onClick={toggleMuted} className="rounded-lg p-2 hover:bg-surface">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button type="button" onClick={handleFullscreen} className="rounded-lg p-2 hover:bg-surface">
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
