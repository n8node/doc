"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Trash2, Save } from "lucide-react";

type BrandingResponse = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
};

export function BrandingSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<"logo" | "favicon" | null>(null);
  const [siteName, setSiteName] = useState("qoqon.ru");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/branding");
      const data = (await res.json()) as BrandingResponse;
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Не удалось загрузить брендинг");
      }
      setSiteName(data.siteName || "qoqon.ru");
      setLogoUrl(data.logoUrl || null);
      setFaviconUrl(data.faviconUrl || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить брендинг");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSiteName = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      toast.success("Брендинг сохранен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (kind: "logo" | "favicon", file: File) => {
    setUploadingKind(kind);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await fetch("/api/v1/admin/branding/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      const url = typeof data.url === "string" ? data.url : null;
      if (kind === "logo") setLogoUrl(url);
      if (kind === "favicon") setFaviconUrl(url);
      toast.success("Файл загружен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploadingKind(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    }
  };

  const removeAsset = async (kind: "logo" | "favicon") => {
    setSaving(true);
    try {
      const payload = kind === "logo" ? { removeLogo: true } : { removeFavicon: true };
      const res = await fetch("/api/v1/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      if (kind === "logo") setLogoUrl(null);
      if (kind === "favicon") setFaviconUrl(null);
      toast.success("Файл удален");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Брендинг</h2>
        <p className="mt-1 text-sm text-muted-foreground">Название сайта, логотип и favicon для интерфейса.</p>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Название сайта</h3>
        <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="qoqon.ru" className="max-w-md" />
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Логотип</h3>
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="h-12 w-auto rounded border border-border bg-background p-1" />
        ) : (
          <p className="text-sm text-muted-foreground">Логотип не загружен</p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={logoInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAsset("logo", file);
            }}
          />
          <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingKind !== null}>
            {uploadingKind === "logo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Загрузить логотип
          </Button>
          <Button type="button" variant="ghost" onClick={() => void removeAsset("logo")} disabled={saving || !logoUrl}>
            <Trash2 className="mr-2 h-4 w-4" />
            Удалить
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Favicon</h3>
        {faviconUrl ? (
          <img src={faviconUrl} alt="favicon" className="h-8 w-8 rounded border border-border bg-background p-1" />
        ) : (
          <p className="text-sm text-muted-foreground">Favicon не загружен</p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={faviconInputRef}
            type="file"
            accept=".ico,.png,.svg,image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAsset("favicon", file);
            }}
          />
          <Button type="button" variant="outline" onClick={() => faviconInputRef.current?.click()} disabled={uploadingKind !== null}>
            {uploadingKind === "favicon" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Загрузить favicon
          </Button>
          <Button type="button" variant="ghost" onClick={() => void removeAsset("favicon")} disabled={saving || !faviconUrl}>
            <Trash2 className="mr-2 h-4 w-4" />
            Удалить
          </Button>
        </div>
      </div>

      <div>
        <Button onClick={() => void saveSiteName()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
