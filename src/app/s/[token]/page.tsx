"use client";

import { useState, useEffect } from "react";
import { Download, File as FileIcon, FolderOpen, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    fetch(`/api/s/${token}`)
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
    const res = await fetch(`/api/s/${token}/download?fileId=${fileId}`);
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, "_blank");
  };

  const streamUrl = (fileId: string) =>
    `/api/s/${token}/stream?fileId=${fileId}`;

  const renderTree = (node: FolderNode) => (
    <div key={node.id} className="ml-4 border-l border-border pl-4">
      <div className="flex items-center gap-2 py-1 text-sm font-medium">
        <FolderOpen className="h-4 w-4 text-primary" />
        {node.name}
      </div>
      {node.files.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-3 py-2"
        >
          {f.mimeType.startsWith("video/") ? (
            <Video className="h-4 w-4" />
          ) : f.mimeType.startsWith("audio/") ? (
            <Music className="h-4 w-4" />
          ) : (
            <FileIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 truncate">{f.name}</span>
          <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
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
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === "FILE" && file) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="p-6">
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
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === "FOLDER" && folder && tree) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="p-6">
            <h1 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <FolderOpen className="h-5 w-5 text-primary" />
              {folder.name}
            </h1>
            {renderTree(tree)}
          </CardContent>
        </Card>

        {mediaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-surface p-4">
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
