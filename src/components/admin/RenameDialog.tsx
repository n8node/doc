"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Edit } from "lucide-react";

interface RenameDialogProps {
  open: boolean;
  onClose: () => void;
  itemType: "file" | "folder";
  itemId: string | null;
  currentName: string;
  onRename: (newName: string) => Promise<void>;
}

export function RenameDialog({
  open,
  onClose,
  itemType,
  itemId,
  currentName,
  onRename,
}: RenameDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    setLoading(true);
    try {
      await onRename(name.trim());
      onClose();
    } catch (error) {
      console.error("Rename failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !loading) {
      onClose();
    }
  };

  // Reset name when dialog opens
  if (open && name !== currentName) {
    setName(currentName);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Переименовать {itemType === "file" ? "файл" : "папку"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">
              Новое название:
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Введите название ${itemType === "file" ? "файла" : "папки"}...`}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName || loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  Переименовать
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}