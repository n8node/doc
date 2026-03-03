"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ShareDialogProps {
  targetType: "FILE" | "FOLDER";
  targetId: string;
  targetName: string;
  onClose: () => void;
}

export function ShareDialog({
  targetType,
  targetId,
  targetName,
  onClose,
}: ShareDialogProps) {
  const [expiresIn, setExpiresIn] = useState("7");
  const [oneTime, setOneTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    try {
      let expiresAt: string | null = null;
      if (expiresIn && expiresIn !== "0") {
        const d = new Date();
        const days = parseInt(expiresIn, 10) || 7;
        d.setDate(d.getDate() + days);
        expiresAt = d.toISOString();
      }
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          fileId: targetType === "FILE" ? targetId : undefined,
          folderId: targetType === "FOLDER" ? targetId : undefined,
          expiresAt,
          oneTime,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setUrl(data.url);
        toast.success("Ссылка создана");
      } else {
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success("Скопировано");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Поделиться: {targetName}</DialogTitle>
        </DialogHeader>
        {!url ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Срок действия (дней)</label>
              <Input
                type="number"
                min={0}
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                placeholder="0 = без срока"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={oneTime}
                onChange={(e) => setOneTime(e.target.checked)}
              />
              <span className="text-sm">Одноразовая ссылка</span>
            </label>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Создание..." : "Создать ссылку"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input readOnly value={url} className="font-mono text-sm" />
            <Button onClick={handleCopy}>Копировать</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
