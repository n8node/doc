"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatBytes } from "@/lib/utils";
import { 
  Info, 
  Loader2, 
  User, 
  FolderOpen, 
  Share2, 
  Calendar,
  Files,
  Link,
  Clock,
} from "lucide-react";

interface FileDetails {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  s3Key: string;
  userId: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
  folderId: string | null;
  folder: {
    id: string;
    name: string;
  } | null;
  hasEmbedding: boolean;
  aiMetadata: Record<string, unknown> | null;
  mediaMetadata: Record<string, unknown> | null;
  shareLinks: Array<{
    id: string;
    token: string;
    expiresAt: string | null;
    oneTime: boolean;
    usedAt: string | null;
    createdAt: string;
  }>;
  createdAt: string;
}

interface FolderDetails {
  id: string;
  name: string;
  parentId: string | null;
  parent: {
    id: string;
    name: string;
  } | null;
  userId: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
  directFilesCount: number;
  childFoldersCount: number;
  shareLinksCount: number;
  totalSize: number;
  totalFilesRecursive: number;
  createdAt: string;
}

interface ItemDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  itemType: "file" | "folder";
  itemId: string | null;
}

export function ItemDetailsDialog({
  open,
  onClose,
  itemType,
  itemId,
}: ItemDetailsDialogProps) {
  const [details, setDetails] = useState<FileDetails | FolderDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !itemId) return;

    const loadDetails = async () => {
      setLoading(true);
      try {
        const endpoint = itemType === "file"
          ? `/api/v1/admin/files/${itemId}`
          : `/api/v1/admin/folders/${itemId}`;

        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        }
      } catch (error) {
        console.error("Failed to load details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [open, itemId, itemType]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru");
  };

  const getMimeTypeCategory = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "Изображение";
    if (mimeType.startsWith("video/")) return "Видео";
    if (mimeType.startsWith("audio/")) return "Аудио";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("document") || mimeType.includes("word")) return "Документ";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Таблица";
    if (mimeType.includes("text")) return "Текст";
    return "Другое";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Детали {itemType === "file" ? "файла" : "папки"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : details ? (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{details.name}</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Владелец:</span>
                  <span className="font-medium">
                    {details.user.email || details.user.name || details.userId}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Создано:</span>
                  <span className="font-medium">
                    {formatDate(details.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {itemType === "file" && "mimeType" in details && (
              <>
                {/* File-specific details */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Files className="h-4 w-4" />
                    Информация о файле
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Размер:</span>
                      <div className="font-medium">{formatBytes(details.size)}</div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Тип:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getMimeTypeCategory(details.mimeType)}</span>
                        <Badge variant="outline" className="text-xs">{details.mimeType}</Badge>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">S3 Key:</span>
                      <div className="font-mono text-xs break-all">{details.s3Key}</div>
                    </div>
                    
                    {details.folder && (
                      <div>
                        <span className="text-muted-foreground">Папка:</span>
                        <div className="flex items-center gap-1 font-medium">
                          <FolderOpen className="h-3 w-3" />
                          {details.folder.name}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI/Media Metadata */}
                  {(details.hasEmbedding || details.aiMetadata || details.mediaMetadata) && (
                    <div className="space-y-2">
                      <span className="text-muted-foreground text-sm">Метаданные:</span>
                      <div className="flex gap-2 flex-wrap">
                        {details.hasEmbedding && (
                          <Badge variant="secondary">AI Embedding</Badge>
                        )}
                        {details.aiMetadata && (
                          <Badge variant="secondary">AI Metadata</Badge>
                        )}
                        {details.mediaMetadata && (
                          <Badge variant="secondary">Media Metadata</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Share Links */}
                  {details.shareLinks.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h5 className="font-medium flex items-center gap-2">
                          <Share2 className="h-4 w-4" />
                          Ссылки для доступа ({details.shareLinks.length})
                        </h5>
                        
                        <div className="space-y-2">
                          {details.shareLinks.map((link) => (
                            <div key={link.id} className="p-3 border rounded-lg space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Link className="h-3 w-3" />
                                <span className="font-mono text-xs">{link.token}</span>
                                <div className="flex gap-1 ml-auto">
                                  {link.oneTime && <Badge variant="outline">Одноразовая</Badge>}
                                  {link.usedAt && <Badge variant="secondary">Использована</Badge>}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Создана: {formatDate(link.createdAt)}
                                </div>
                                
                                {link.expiresAt ? (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Истекает: {formatDate(link.expiresAt)}
                                  </div>
                                ) : (
                                  <div className="text-green-600">Без срока</div>
                                )}
                                
                                {link.usedAt && (
                                  <div className="flex items-center gap-1 col-span-2">
                                    <Clock className="h-3 w-3" />
                                    Использована: {formatDate(link.usedAt)}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {itemType === "folder" && "directFilesCount" in details && (
              <>
                {/* Folder-specific details */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Информация о папке
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Общий размер:</span>
                      <div className="font-medium">{formatBytes(details.totalSize)}</div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Всего файлов:</span>
                      <div className="font-medium">{details.totalFilesRecursive}</div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Прямых файлов:</span>
                      <div className="font-medium">{details.directFilesCount}</div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Подпапок:</span>
                      <div className="font-medium">{details.childFoldersCount}</div>
                    </div>
                    
                    {details.parent && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Родительская папка:</span>
                        <div className="flex items-center gap-1 font-medium">
                          <FolderOpen className="h-3 w-3" />
                          {details.parent.name}
                        </div>
                      </div>
                    )}
                  </div>

                  {details.shareLinksCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      <span>Расшаренных ссылок:</span>
                      <Badge variant="outline">{details.shareLinksCount}</Badge>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Не удалось загрузить детали
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}