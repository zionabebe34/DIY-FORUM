// "Report" dialog — opened from anywhere with openReport({ targetType, targetId, label }).
import React, { useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast.jsx';

const EVENT = 'hh:report';

// Open the report dialog for a post / comment / user from anywhere (a window event).
export function openReport(target) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: target }));
}

export const REASONS = [
  { id: 'spam',           label: 'ספאם או פרסומת' },
  { id: 'harassment',     label: 'הטרדה או בריונות' },
  { id: 'hate',           label: 'שנאה או גזענות' },
  { id: 'violence',       label: 'אלימות או איומים' },
  { id: 'misinformation', label: 'מידע מסוכן או שגוי' },
  { id: 'other',          label: 'אחר' },
];

export const REASON_LABEL = Object.fromEntries(REASONS.map(r => [r.id, r.label]));

/** Mounted once in App; listens for openReport() calls. */
export function ReportHost() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    const h = (e) => setTarget(e.detail);
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  if (!target) return null;
  return <ReportModal target={target} onClose={() => setTarget(null)} />;
}

// The report dialog: pick a reason, add details, send it to the moderators.
function ReportModal({ target, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) { setError('בחרו סיבה'); return; }
    setBusy(true);
    setError('');
    try {
      await api.report(target.targetType, target.targetId, reason, details.trim());
      toast('תודה! הדיווח הועבר לצוות הניהול');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-pop w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="inline-flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-rust-50 text-rust-700 grid place-items-center"><I.Flag size={16}/></span>
            <h3 className="font-display font-bold text-xl text-slate-900">דיווח על {target.label}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><I.X size={18}/></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600">מה הבעיה? הדיווח אנונימי למשתמש המדווח, וצוות הניהול יבדוק אותו.</p>
          <div className="space-y-1.5" role="radiogroup" aria-label="סיבת הדיווח">
            {REASONS.map(r => (
              <label key={r.id}
                className={"flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition " +
                           (reason === r.id ? "border-rust-500 bg-rust-50" : "border-slate-200 hover:bg-slate-50")}>
                <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)}
                  className="accent-rust-600" />
                <span className="text-sm font-semibold text-slate-800">{r.label}</span>
              </label>
            ))}
          </div>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2}
            placeholder="פרטים נוספים (לא חובה)"
            className="w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm resize-none" />
          {error && <div role="alert" className="rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <button type="button" onClick={onClose} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">ביטול</button>
          <button type="submit" disabled={busy}
            className="bg-rust-600 hover:bg-rust-700 disabled:opacity-60 text-white font-bold text-sm px-5 py-2 rounded-full">
            {busy ? 'שולח…' : 'שלח דיווח'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
