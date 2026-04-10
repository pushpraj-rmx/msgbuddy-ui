"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-0.5 border-b border-base-300 p-1.5">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
        className={`btn btn-xs ${editor.isActive("bold") ? "btn-primary" : "btn-ghost"}`}
      >
        B
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleItalic().run();
        }}
        className={`btn btn-xs italic ${editor.isActive("italic") ? "btn-primary" : "btn-ghost"}`}
      >
        I
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleCode().run();
        }}
        className={`btn btn-xs font-mono ${editor.isActive("code") ? "btn-primary" : "btn-ghost"}`}
      >
        {"<>"}
      </button>
      <div className="mx-1 w-px bg-base-300" />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBulletList().run();
        }}
        className={`btn btn-xs ${editor.isActive("bulletList") ? "btn-primary" : "btn-ghost"}`}
      >
        •—
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleOrderedList().run();
        }}
        className={`btn btn-xs ${editor.isActive("orderedList") ? "btn-primary" : "btn-ghost"}`}
      >
        1—
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBlockquote().run();
        }}
        className={`btn btn-xs ${editor.isActive("blockquote") ? "btn-primary" : "btn-ghost"}`}
      >
        ❝
      </button>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
    ],
    content: value ?? "",
    editable: !readOnly,
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
  });

  // Sync external value changes (e.g. reset after submit)
  useEffect(() => {
    if (!editor) return;
    if (value !== undefined && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  return (
    <div
      className={`rounded-box border border-base-300 bg-base-100 focus-within:border-primary transition-colors ${className}`}
    >
      {!readOnly && editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 focus:outline-none min-h-[100px]"
      />
    </div>
  );
}
