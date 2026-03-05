"use client";

import { useState, useEffect } from "react";
import { Download, File as FileIcon, FolderOpen, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { formatBytes } from "@/lib/utils";

interface FileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  mediaMetadata?: { durationSeconds?: number };
}

interface FolderNode {
  id: string;
  name: string;
  files: FileInfo[];
  folders: FolderNode[];
}

export default function SharePage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"FILE" | "FOLDER" | null>(null);
  const [file, setFile] = useState<FileInfo | null>(null);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [tree, setTree] = useState<FolderNode | null>(null);
  const [mediaModal, setMediaModal] = useState<{
    type: "video" | "audio";
    id: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/s/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setType(data.type);
        setFile(data.file ?? null);
        setFolder(data.folder ?? null);
        setTree(data.tree ?? null);
      })
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = async (fileId: string) => {
    const res = await fetch(`/api/v1/s/${token}/download?fileId=${fileId}`);
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, "_blank");
  };

  const streamUrl = (fileId: string) =>
    `/api/v1/s/${token}/stream?fileId=${fileId}`;

  const renderTree = (node: FolderNode) => (
    <div key={node.id} className="mt-3 space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm font-medium">
        <FolderOpen className="h-4 w-4 text-primary" />
        {node.name}
      </div>
      {node.files.map((f) => (
        <div
          key={f.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-background/80 p-3 shadow-[0_12px_32px_-24px_hsl(var(--foreground)/0.45)]"
        >
          {f.mimeType.startsWith("video/") ? (
            <Video className="h-4 w-4 shrink-0" />
          ) : f.mimeType.startsWith("audio/") ? (
            <Music className="h-4 w-4 shrink-0" />
          ) : (
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
          <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
          <div className="flex shrink-0 gap-2">
            {f.mimeType.startsWith("video/") && (
              <Button size="sm" variant="outline" onClick={() => setMediaModal({ type: "video", id: f.id })}>
                Смотреть
              </Button>
            )}
            {f.mimeType.startsWith("audio/") && (
              <Button size="sm" variant="outline" onClick={() => setMediaModal({ type: "audio", id: f.id })}>
                Слушать
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => handleDownload(f.id)}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      {node.folders.map((child) => renderTree(child))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl modal-glass p-6">
          <p className="text-center text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (type === "FILE" && file) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl modal-glass p-6">
          <h1 className="mb-4 text-lg font-semibold">{file.name}</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {formatBytes(file.size)}
          </p>
          {file.mimeType.startsWith("video/") && (
            <VideoPlayer src={streamUrl(file.id)} />
          )}
          {file.mimeType.startsWith("audio/") && (
            <AudioPlayer src={streamUrl(file.id)} />
          )}
          <Button className="mt-4" onClick={() => handleDownload(file.id)}>
            <Download className="mr-2 h-4 w-4" /> Скачать
          </Button>
        </div>
      </div>
    );
  }

  if (type === "FOLDER" && folder && tree) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl modal-glass overflow-hidden p-6">
          <h1 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FolderOpen className="h-5 w-5 text-primary" />
            {folder.name}
          </h1>
          {renderTree(tree)}
        </div>

        {mediaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl modal-glass overflow-hidden p-4">
              {mediaModal.type === "video" && (
                <VideoPlayer src={streamUrl(mediaModal.id)} />
              )}
              {mediaModal.type === "audio" && (
                <AudioPlayer src={streamUrl(mediaModal.id)} />
              )}
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() => setMediaModal(null)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
