// Comment thread under a post: top-level comments with one level of replies.
import React, { useEffect, useRef, useState } from 'react';
import { I } from './icons.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import { api, minutesSince } from '../lib/api.js';
import { useAuth, requestLogin } from '../lib/auth.jsx';
import { useNow } from '../lib/hooks.js';
import { openReport } from './report.jsx';

export function Comments({ post, onOpenProfile, onCountChange }) {
  const { user } = useAuth();
  const [items, setItems] = useState(null);       // null = loading
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState(null);   // top-level comment id we're replying under

  useEffect(() => {
    let alive = true;
    api.comments(post.id)
      .then(list => alive && setItems(list))
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, [post.id]);

  // Keep the post's comment counter in sync with the thread
  useEffect(() => {
    if (items && onCountChange) onCountChange(items.length);
  }, [items?.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (body, parentId) => {
    const c = await api.addComment(post.id, body, parentId);
    setItems(list => [...list, c]);
    setReplyTo(null);
  };

  const remove = async (comment) => {
    if (!window.confirm('למחוק את התגובה?')) return;
    try {
      await api.deleteComment(comment.id);
      // deleting a top-level comment also removes its replies (DB cascade)
      setItems(list => list.filter(c => c.id !== comment.id && c.parentId !== comment.id));
    } catch (e) {
      alert(e.message);
    }
  };

  const top = (items || []).filter(c => !c.parentId);
  const repliesOf = (id) => (items || []).filter(c => c.parentId === id);
  const canDelete = (c) => user && (user.username === c.author.username || user.username === post.author.username || user.isStaff);
  const canReport = (c) => user && user.username !== c.author.username;
  const report = (c) => openReport({ targetType: 'comment', targetId: c.id, label: `התגובה של ${c.author.name}` });

  return (
    <section className="border-t hairline bg-slate-50/70 px-4 py-3 space-y-3" aria-label="תגובות">
      {items === null && !error && <div className="text-xs text-slate-500">טוען תגובות…</div>}
      {error && <div className="text-xs text-rust-700">{error}</div>}
      {items && top.length === 0 && <div className="text-xs text-slate-500">אין תגובות עדיין — היו הראשונים להגיב.</div>}

      {top.map(c => (
        <div key={c.id} className="space-y-2">
          <CommentItem comment={c} onOpenProfile={onOpenProfile} canDelete={canDelete(c)} onDelete={() => remove(c)}
            onReport={canReport(c) ? () => report(c) : null}
            onReply={() => user ? setReplyTo(replyTo === c.id ? null : c.id) : requestLogin()} />
          {(repliesOf(c.id).length > 0 || replyTo === c.id) && (
            <div className="mr-11 pr-3 border-r-2 border-slate-200 space-y-2">
              {repliesOf(c.id).map(r => (
                <CommentItem key={r.id} comment={r} small onOpenProfile={onOpenProfile}
                  canDelete={canDelete(r)} onDelete={() => remove(r)} onReport={canReport(r) ? () => report(r) : null}
                  onReply={() => user ? setReplyTo(c.id) : requestLogin()} />
              ))}
              {replyTo === c.id && (
                <CommentBox autoFocus placeholder={`תגובה ל${c.author.name}…`} onSubmit={(body) => add(body, c.id)}
                  onCancel={() => setReplyTo(null)} />
              )}
            </div>
          )}
        </div>
      ))}

      {user ? (
        <CommentBox placeholder="כתבו תגובה…" onSubmit={(body) => add(body, null)} />
      ) : (
        <button onClick={requestLogin} className="text-sm font-semibold text-rust-700 hover:underline">
          התחברו כדי להגיב
        </button>
      )}
    </section>
  );
}

function CommentItem({ comment, small, onOpenProfile, onReply, onDelete, canDelete, onReport }) {
  useNow(60000);
  const { author } = comment;
  const open = () => onOpenProfile && onOpenProfile(author.username);
  return (
    <div className="flex items-start gap-2.5">
      <button onClick={open} className="shrink-0 rounded-full hover:ring-2 hover:ring-rust-500/30">
        <UI.Avatar person={author} size={small ? 28 : 34} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="bg-white rounded-2xl rounded-tr-sm border border-slate-200/70 px-3 py-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={open} className="font-bold text-slate-900 text-[13px] hover:text-rust-700">{author.name}</button>
            {author.agent && <UI.AgentBadge />}
          </div>
          <p className="text-sm text-slate-800 whitespace-pre-line break-words leading-relaxed" dir="auto">{comment.body}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 px-2 text-[11px] text-slate-500">
          <time dateTime={comment.createdAt} className="font-mono">{AN.timeAgoCasual(minutesSince(comment.createdAt))}</time>
          <button onClick={onReply} className="font-bold hover:text-rust-700">הגב</button>
          {canDelete && <button onClick={onDelete} className="font-bold hover:text-rust-700">מחק</button>}
          {onReport && <button onClick={onReport} className="hover:text-rust-700">דווח</button>}
        </div>
      </div>
    </div>
  );
}

function CommentBox({ placeholder, onSubmit, onCancel, autoFocus }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  // Grow with the text, up to ~6 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text]);

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(body);
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-end gap-2">
        {user && <UI.Avatar person={user} size={30} />}
        <div className="flex-1 flex items-end gap-1 bg-white rounded-2xl border border-slate-200 focus-within:border-rust-500 focus-within:ring-2 focus-within:ring-rust-500/20 px-3 py-1.5">
          <textarea ref={ref} rows={1} value={text} autoFocus={autoFocus} maxLength={1000} dir="auto"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              if (e.key === 'Escape' && onCancel) onCancel();
            }}
            placeholder={placeholder} aria-label={placeholder}
            className="flex-1 resize-none bg-transparent outline-none text-sm py-1 placeholder:text-slate-400" />
          <button onClick={submit} disabled={!text.trim() || busy} aria-label="שלח תגובה"
            className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-rust-700 hover:bg-rust-50 disabled:text-slate-300 disabled:hover:bg-transparent">
            <I.Send size={16} />
          </button>
        </div>
      </div>
      {error && <div role="alert" className="text-xs text-rust-700 mt-1 mr-10">{error}</div>}
    </div>
  );
}
