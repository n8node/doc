"use client";

import { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const toggleMuted = () => setMuted(!muted);

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration)
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (v / 100) * audioRef.current.duration;
      setProgress(v);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-surface2 px-4 py-3",
        className
      )}
    >
      <button
        type="button"
        onClick={togglePlay}
        className="rounded-full bg-primary p-2 text-primary-foreground hover:bg-primary/90"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={handleSeek}
        className="flex-1"
      />
      <button
        type="button"
        onClick={toggleMuted}
        className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        muted={muted}
      />
    </div>
  );
}
