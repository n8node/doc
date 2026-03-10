"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Code,
  Link2,
} from "lucide-react";
import { useCallback, useEffect } from "react";

const Toolbar = ({ editor }: { editor: Editor | null }) => {
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
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`rounded px-2 py-1 text-sm hover:bg-surface2 ${editor.isActive("codeBlock") ? "bg-primary/20 text-primary" : ""}`}
        title="Блок кода"
      >
        <Code className="h-4 w-4" />
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
    </div>
  );
};

type TipTapEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export function TipTapEditor({ content, onChange, placeholder = "Начните писать..." }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] px-4 py-3 text-foreground focus:outline-none [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_pre]:bg-surface2 [&_pre]:rounded [&_pre]:p-2 [&_a]:text-primary [&_a]:underline",
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

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
