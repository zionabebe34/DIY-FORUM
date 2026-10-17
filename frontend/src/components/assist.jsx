// AI writing assistant (part 2 c) — the person always decides:
//  · ComposerAssist: "✨ תיקון כתיב" (before / after → replace) and "✨ הצע לי פוסט" (3 drafts → pick one)
//  · CommentSuggestions: "✨" next to the comment box → 3 short suggestions → pick one into the box
// When the assistant isn't available the buttons say so politely; nothing else breaks.
import React, { useState } from 'react';
import { I } from './icons.jsx';
import { api } from '../lib/api.js';
import { useAIEnabled } from '../lib/hooks.js';
import DOMPurify from 'dompurify';

const chip = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition disabled:opacity-50";

// Plain text → escaped HTML paragraphs (blank line = new <p>, newline = <br>).
export function textToHtml(text) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

// AI buttons in the post composer: spelling fix (before / after → replace) and 3 suggested drafts.
export function ComposerAssist({ bodyHtml, bodyText, allowSuggest, onReplace, onUseSuggestion }) {
  const enabled = useAIEnabled();
  const [mode, setMode] = useState(null);        // null | 'correct' | 'suggest'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [correction, setCorrection] = useState(null);
  const [topic, setTopic] = useState('');
  const [drafts, setDrafts] = useState(null);
  if (!enabled) return null;

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const correct = () => { setMode('correct'); setCorrection(null); run(async () => setCorrection(await api.ai.correct(bodyHtml))); };
  const suggest = (e) => { e?.preventDefault(); run(async () => setDrafts(await api.ai.suggestPost(topic))); };
  const close = () => { setMode(null); setError(''); setCorrection(null); setDrafts(null); };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2 space-y-2" aria-label="עוזר כתיבה">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-violet-800 inline-flex items-center gap-1"><I.Sparkles size={13}/> עוזר כתיבה</span>
        <button type="button" onClick={correct} disabled={busy || !bodyText.trim()}
          className={chip + " border-violet-200 bg-white text-violet-800 hover:bg-violet-100"}>✨ תיקון כתיב</button>
        {allowSuggest && (
          <button type="button" onClick={() => { setMode('suggest'); setDrafts(null); setError(''); }} disabled={busy}
            className={chip + " border-violet-200 bg-white text-violet-800 hover:bg-violet-100"}>✨ הצע לי פוסט</button>
        )}
        {mode && <button type="button" onClick={close} className="mr-auto text-xs text-slate-500 hover:text-slate-800">סגירה</button>}
      </div>

      {busy && <div className="text-xs text-violet-700" role="status">העוזר חושב…</div>}
      {error && <div className="text-xs text-rust-700" role="alert">{error}</div>}

      {mode === 'correct' && correction && (
        correction.changed ? (
          <div className="space-y-2">
            {correction.ai === false && (
              <p className="text-[11px] text-amber-800">תיקונים בסיסיים בלבד — העוזר החכם לא זמין כרגע.</p>
            )}
            <ul className="text-xs text-slate-700 space-y-0.5" aria-label="תיקונים">
              {correction.changes.map(c => <li key={c} dir="auto">• {c}</li>)}
            </ul>
            <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm">
              <div className="text-[11px] font-bold text-slate-500 mb-1">אחרי התיקון</div>
              <div className="rich" dir="auto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(correction.html) }} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { onReplace(correction.html); close(); }}
                className="px-3 py-1.5 rounded-full bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold">החלפה בטקסט המתוקן</button>
              <button type="button" onClick={close} className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100">ביטול</button>
            </div>
          </div>
        ) : <div className="text-xs text-emerald-800">✓ לא נמצאו שגיאות לתיקון.</div>
      )}

      {mode === 'suggest' && (
        <div className="space-y-2">
          <form onSubmit={suggest} className="flex gap-1.5">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} aria-label="נושא להצעה"
              placeholder="על מה? (לא חובה) למשל: שולחן לגינה"
              className="flex-1 min-w-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
            <button type="submit" disabled={busy}
              className="px-3 py-1.5 rounded-full bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold disabled:opacity-50">
              {drafts ? 'הצעות חדשות' : 'הצע'}
            </button>
          </form>
          {drafts && (
            <>
              <p className="text-[11px] text-slate-500">בחרו טיוטה — את מה שבסוגריים [כך] מחליפים בפרטים שלכם.</p>
              <ul className="space-y-1.5">
                {drafts.map((d, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => { onUseSuggestion(d); close(); }}
                      className="w-full text-right rounded-lg bg-white border border-slate-200 hover:border-violet-400 px-3 py-2 text-sm text-slate-800">
                      <span dir="auto">{d.body}</span>
                      {d.tags.length > 0 && <span className="block text-[11px] text-violet-700 mt-1">{d.tags.map(t => '#' + t).join(' ')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// AI button under a comment box: 3 suggested comments, a click puts one in the box.
export function CommentSuggestions({ postId, parentId, onPick }) {
  const enabled = useAIEnabled();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!enabled) return null;

  const load = async () => {
    setBusy(true);
    setError('');
    try { setItems(await api.ai.suggestComments(postId, parentId)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="mt-1.5 mr-10">
      {!items && (
        <button type="button" onClick={load} disabled={busy}
          className="text-[11px] font-bold text-violet-700 hover:underline disabled:opacity-50">
          {busy ? 'העוזר חושב…' : '✨ הצע לי תגובה'}
        </button>
      )}
      {error && <div className="text-[11px] text-rust-700" role="alert">{error}</div>}
      {items && (
        <div className="flex flex-wrap gap-1.5" aria-label="הצעות לתגובה">
          {items.map((s, i) => (
            <button key={i} type="button" onClick={() => { onPick(s); setItems(null); }} dir="auto"
              className="text-right text-xs rounded-2xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-900 px-3 py-1.5">
              {s}
            </button>
          ))}
          <button type="button" onClick={load} disabled={busy} className="text-[11px] font-bold text-violet-700 hover:underline disabled:opacity-50">
            {busy ? '…' : 'הצעות אחרות'}
          </button>
          <button type="button" onClick={() => setItems(null)} className="text-[11px] text-slate-500 hover:underline">סגירה</button>
        </div>
      )}
    </div>
  );
}
