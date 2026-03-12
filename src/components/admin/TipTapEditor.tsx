"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Link2,
  ImageIcon,
  TableIcon,
  Minus,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Superscript as SupIcon,
  Subscript as SubIcon,
  CheckSquare,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const Toolbar = ({
  editor,
  onImageUpload,
}: {
  editor: Editor | null;
  onImageUpload: () => void;
}) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 border-b border-border bg-surface2/30 p-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("bold") ? "bg-primary/20 text-primary" : ""}`}
        title="Жирный"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("italic") ? "bg-primary/20 text-primary" : ""}`}
        title="Курсив"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("underline") ? "bg-primary/20 text-primary" : ""}`}
        title="Подчёркнутый"
      >
        <UnderlineIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("highlight") ? "bg-primary/20 text-primary" : ""}`}
        title="Выделение"
      >
        <Highlighter className="h-4 w-4" />
      </button>
      <span className="mx-1 w-px self-stretch bg-border" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("heading", { level: 1 }) ? "bg-primary/20 text-primary" : ""}`}
        title="Заголовок 1"
      >
        <Heading1 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("heading", { level: 2 }) ? "bg-primary/20 text-primary" : ""}`}
        title="Заголовок 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("heading", { level: 3 }) ? "bg-primary/20 text-primary" : ""}`}
        title="Заголовок 3"
      >
        <Heading3 className="h-4 w-4" />
      </button>
      <span className="mx-1 w-px self-stretch bg-border" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("bulletList") ? "bg-primary/20 text-primary" : ""}`}
        title="Маркированный список"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("orderedList") ? "bg-primary/20 text-primary" : ""}`}
        title="Нумерованный список"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("taskList") ? "bg-primary/20 text-primary" : ""}`}
        title="Чеклист"
      >
        <CheckSquare className="h-4 w-4" />
      </button>
      <span className="mx-1 w-px self-stretch bg-border" />
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive({ textAlign: "left" }) ? "bg-primary/20 text-primary" : ""}`}
        title="По левому краю"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive({ textAlign: "center" }) ? "bg-primary/20 text-primary" : ""}`}
        title="По центру"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive({ textAlign: "right" }) ? "bg-primary/20 text-primary" : ""}`}
        title="По правому краю"
      >
        <AlignRight className="h-4 w-4" />
      </button>
      <span className="mx-1 w-px self-stretch bg-border" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("codeBlock") ? "bg-primary/20 text-primary" : ""}`}
        title="Блок кода"
      >
        <Code className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("superscript") ? "bg-primary/20 text-primary" : ""}`}
        title="Надстрочный"
      >
        <SupIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("subscript") ? "bg-primary/20 text-primary" : ""}`}
        title="Подстрочный"
      >
        <SubIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt("URL ссылки:");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("link") ? "bg-primary/20 text-primary" : ""}`}
        title="Ссылка"
      >
        <Link2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="rounded px-2 py-1 text-sm hover:bg-surface2"
        title="Горизонтальная линия"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className="rounded px-2 py-1 text-sm hover:bg-surface2"
        title="Таблица"
      >
        <TableIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onImageUpload}
        className="rounded px-2 py-1 text-sm hover:bg-surface2"
        title="Вставить изображение"
      >
        <ImageIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

type TipTapEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** URL для загрузки изображений. По умолчанию /api/v1/admin/docs/upload */
  uploadUrl?: string;
};

export function TipTapEditor({
  content,
  onChange,
  placeholder = "Начните писать...",
  uploadUrl = "/api/v1/admin/docs/upload",
}: TipTapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Superscript,
      Subscript,
      Typography,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: content || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] px-4 py-3 text-foreground focus:outline-none [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_pre]:bg-surface2 [&_pre]:rounded [&_pre]:p-2 [&_a]:text-primary [&_a]:underline [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:p-2 [&_td]:p-2",
      },
    },
  });

  const handleUpdate = useCallback(() => {
    if (editor) {
      onChange(editor.getHTML());
    }
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, handleUpdate]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      e.target.value = "";

      const fd = new FormData();
      fd.set("file", file);
      try {
        const res = await fetch(uploadUrl, {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
        editor.chain().focus().setImage({ src: data.url }).run();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки изображения");
      }
    },
    [editor, uploadUrl]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={onFileChange}
      />
      <Toolbar editor={editor} onImageUpload={handleImageUpload} />
      <EditorContent editor={editor} />
    </div>
  );
}
