'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Heading2, Quote, Undo, Redo } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors duration-100"
      style={{
        background: active ? 'var(--color-primary-light)' : 'transparent',
        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, placeholder = 'Açıklama yazın...', minHeight = 120 }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none outline-none',
        style: `min-height: ${minHeight}px; padding: 12px 16px; color: var(--color-text-primary); font-family: var(--font-body); font-size: 14px; line-height: 1.6;`,
      },
    },
  });

  if (!editor) return null;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 border-b px-2 py-1.5"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Kalın">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="İtalik">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px" style={{ background: 'var(--color-border)' }} />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Başlık">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Madde listesi">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numaralı liste">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Alıntı">
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px" style={{ background: 'var(--color-border)' }} />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Geri al">
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Yinele">
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
