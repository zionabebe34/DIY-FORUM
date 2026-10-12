// WYSIWYG editor (TipTap) — bold, italic, underline, links and bullet lists.
// Emits sanitized-by-the-server HTML through onChange(html, plainText).
import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { I } from './icons.jsx';

export function RichEditor({ placeholder, onChange, resetKey, minHeight = '6rem' }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, codeBlock: false, code: false, blockquote: false,
        horizontalRule: false, strike: false, orderedList: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https',
                HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { class: 'rich text-[15px] leading-relaxed text-slate-800', dir: 'auto' } },
    onUpdate: ({ editor }) => onChange && onChange(editor.isEmpty ? '' : editor.getHTML(), editor.getText()),
  });

  // Clear the editor when the composer is reopened
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.clearContent(true);
  }, [resetKey, editor]);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'),
      link: e.isActive('link'), list: e.isActive('bulletList'),
    } : {},
  }) || {};

  if (!editor) return null;

  const openLink = () => {
    setLinkUrl(editor.getAttributes('link').href || '');
    setLinkOpen(true);
  };
  const applyLink = (e) => {
    e.preventDefault();
    let url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      if (!/^(https?:|mailto:)/i.test(url)) url = 'https://' + url;
      const chain = editor.chain().focus().extendMarkRange('link');
      if (editor.state.selection.empty && !editor.isActive('link')) {
        chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
      } else {
        chain.setLink({ href: url }).run();
      }
    }
    setLinkOpen(false);
  };

  return (
    <div className="rich-editor rounded-xl border border-slate-200 bg-white focus-within:border-rust-500 focus-within:ring-2 focus-within:ring-rust-500/20 transition">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-100">
        <ToolBtn on={active.bold}      title="מודגש (Ctrl+B)"  onClick={() => editor.chain().focus().toggleBold().run()}><I.Bold size={15} strokeWidth={2.5}/></ToolBtn>
        <ToolBtn on={active.italic}    title="נטוי (Ctrl+I)"   onClick={() => editor.chain().focus().toggleItalic().run()}><I.Italic size={15} strokeWidth={2.5}/></ToolBtn>
        <ToolBtn on={active.underline} title="קו תחתון (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><I.Underline size={15} strokeWidth={2.5}/></ToolBtn>
        <span className="w-px h-5 bg-slate-200 mx-1"></span>
        <ToolBtn on={active.link || linkOpen} title="קישור" onClick={openLink}><I.Link size={15} strokeWidth={2.5}/></ToolBtn>
        {active.link && (
          <ToolBtn title="הסר קישור" onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}><I.Unlink size={15} strokeWidth={2.5}/></ToolBtn>
        )}
        <ToolBtn on={active.list} title="רשימה" onClick={() => editor.chain().focus().toggleBulletList().run()}><I.List size={15} strokeWidth={2.5}/></ToolBtn>
      </div>

      {linkOpen && (
        <form onSubmit={applyLink} className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50/60">
          <I.Link size={13} className="text-slate-500 shrink-0"/>
          <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} dir="ltr"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setLinkOpen(false); } }}
            placeholder="https://example.com"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-left"/>
          <button type="submit" className="text-xs font-bold text-white bg-rust-600 hover:bg-rust-700 rounded-md px-2.5 py-1">החל</button>
          <button type="button" onClick={() => setLinkOpen(false)} className="p-1 text-slate-400 hover:text-slate-700"><I.X size={13}/></button>
        </form>
      )}

      <div className="px-3 py-2.5" style={{ minHeight }} onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolBtn({ on, title, onClick, children }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={!!on}
      onMouseDown={(e) => e.preventDefault()}  // keep the editor selection
      onClick={onClick}
      className={"w-8 h-8 grid place-items-center rounded-md transition " +
                 (on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
      {children}
    </button>
  );
}
