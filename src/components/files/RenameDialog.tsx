"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RenameDialogProps {
  open: boolean;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
  itemType: "file" | "folder";
}

export function RenameDialog({
  open,
  onClose,
  onRename,
  currentName,
  itemType,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setRenaming(false);
      setTimeout(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        if (itemType === "file") {
          const dotIdx = currentName.lastIndexOf(".");
          input.setSelectionRange(0, dotIdx > 0 ? dotIdx : currentName.length);
        } else {
          input.select();
        }
      }, 50);
    }
  }, [open, currentName, itemType]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== currentName && !renaming;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setRenaming(true);
    try {
      await onRename(trimmed);
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Переименовать {itemType === "file" ? "файл" : "папку"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            disabled={renaming}
            placeholder={itemType === "file" ? "Имя файла" : "Имя папки"}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={renaming}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
              {renaming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
