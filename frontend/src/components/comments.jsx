// Comment thread under a post: top-level comments with one level of replies.
import React, { useEffect, useRef, useState } from 'react';
import { I } from './icons.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import { api, minutesSince } from '../lib/api.js';
import { useAuth, requestLogin } from '../lib/auth.jsx';
import { useNow } from '../lib/hooks.js';
import { openReport } from './report.jsx';
import { CommentSuggestions } from './assist.jsx';

// A post's comment thread: loads it, shows replies under their comment, add / delete / report.
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

  const add = async (body, parentId, confirm) => {
    const c = await api.addComment(post.id, body, parentId, confirm);
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
                <CommentBox autoFocus placeholder={`תגובה ל${c.author.name}…`} postId={post.id} parentId={c.id}
                  onSubmit={(body, confirm) => add(body, c.id, confirm)}
                  onCancel={() => setReplyTo(null)} />
              )}
            </div>
          )}
        </div>
      ))}

      {user ? (
        <CommentBox placeholder="כתבו תגובה…" postId={post.id} onSubmit={(body, confirm) => add(body, null, confirm)} />
      ) : (
        <button onClick={requestLogin} className="text-sm font-semibold text-rust-700 hover:underline">
          התחברו כדי להגיב
        </button>
      )}
    </section>
  );
}

// One comment bubble: author, text, time and reply / delete / report links.
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

// The comment / reply box: grows with the text, AI suggestions, the toxicity warning.
function CommentBox({ placeholder, onSubmit, onCancel, autoFocus, postId, parentId }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(null);   // toxicity check said "warn": { reason }
  const ref = useRef(null);

  // Grow with the text, up to ~6 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text]);

  const submit = async (confirm = false) => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    setWarning(null);
    try {
      await onSubmit(body, confirm);
      setText('');
    } catch (e) {
      // 409 = the toxicity check warned: let the author edit or publish anyway; 422 = blocked
      if (e.status === 409 && e.data?.moderation) setWarning({ reason: e.data.moderation.reason });
      else setError(e.status === 422 && e.data?.moderation ? `🚫 ${e.message}` : e.message);
    } finally {
      setBusy(false);
    }
  };
  const edit = () => { setWarning(null); ref.current?.focus(); };

  return (
    <div>
      <div className="flex items-end gap-2">
        {user && <UI.Avatar person={user} size={30} />}
        <div className="flex-1 flex items-end gap-1 bg-white rounded-2xl border border-slate-200 focus-within:border-rust-500 focus-within:ring-2 focus-within:ring-rust-500/20 px-3 py-1.5">
          <textarea ref={ref} rows={1} value={text} autoFocus={autoFocus} maxLength={1000} dir="auto"
            onChange={(e) => { setText(e.target.value); setWarning(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              if (e.key === 'Escape' && onCancel) onCancel();
            }}
            placeholder={placeholder} aria-label={placeholder}
            className="flex-1 resize-none bg-transparent outline-none text-sm py-1 placeholder:text-slate-400" />
          <button onClick={() => submit()} disabled={!text.trim() || busy} aria-label="שלח תגובה"
            className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-rust-700 hover:bg-rust-50 disabled:text-slate-300 disabled:hover:bg-transparent">
            <I.Send size={16} />
          </button>
        </div>
      </div>
      {error && <div role="alert" className="text-xs text-rust-700 mt-1 mr-10">{error}</div>}
      {!text.trim() && postId && (
        <CommentSuggestions postId={postId} parentId={parentId}
          onPick={(s) => { setText(s); setWarning(null); ref.current?.focus(); }} />
      )}
      {warning && (
        <div role="alertdialog" aria-label="אזהרת תוכן" className="mt-2 mr-10 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
          <div className="font-bold text-amber-900">⚠️ התגובה עלולה להיות פוגענית</div>
          {warning.reason && <p className="text-amber-900/90 mt-0.5">{warning.reason}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={edit} className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
              עריכת התגובה
            </button>
            <button onClick={() => submit(true)} disabled={busy}
              className="px-3 py-1.5 rounded-full border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 disabled:opacity-50">
              פרסום בכל זאת
            </button>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-1.5">פרסום בכל זאת יעביר את התגובה לבדיקה של צוות הניהול.</p>
        </div>
      )}
    </div>
  );
}
