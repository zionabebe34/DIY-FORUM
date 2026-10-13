// #/reset/<token> — choose a new password from the emailed link.
import React, { useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { Spinner } from './social.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export function ResetPassword({ token, onLogin, onView }) {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState('checking');   // checking | valid | invalid | done
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.checkResetToken(token)
      .then(r => { if (alive) { setStatus(r.valid ? 'valid' : 'invalid'); setUsername(r.username || ''); } })
      .catch(() => alive && setStatus('invalid'));
    return () => { alive = false; };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('הסיסמה חייבת להכיל לפחות 8 תווים'); return; }
    if (password !== confirm) { setError('הסיסמאות לא תואמות'); return; }
    setBusy(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      // The server logged out every session of this account — reflect that here too
      if (user) await logout();
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const card = "bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 max-w-md mx-auto";
  const input = "mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm";

  if (status === 'checking') return <div className={card}><Spinner label="בודק את הקישור…" /></div>;

  if (status === 'invalid') {
    return (
      <div className={card + " text-center"}>
        <div className="w-14 h-14 mx-auto rounded-full bg-rust-50 grid place-items-center mb-3"><I.X size={24} className="text-rust-600"/></div>
        <h1 className="font-display font-bold text-2xl text-slate-900">הקישור לא תקף</h1>
        <p className="text-sm text-slate-600 mt-2">ייתכן שפג תוקפו (30 דקות), שכבר השתמשתם בו, או שנשלח קישור חדש יותר.</p>
        <button onClick={() => onLogin('forgot')} className="mt-5 bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-5 py-2 rounded-full">
          שלחו לי קישור חדש
        </button>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className={card + " text-center"}>
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 grid place-items-center mb-3"><I.Check size={24} className="text-emerald-600"/></div>
        <h1 className="font-display font-bold text-2xl text-slate-900">הסיסמה עודכנה</h1>
        <p className="text-sm text-slate-600 mt-2">מטעמי אבטחה נותקנו מכל המכשירים. התחברו עם הסיסמה החדשה.</p>
        <div className="flex justify-center gap-2 mt-5">
          <button onClick={() => onLogin('login')} className="bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-5 py-2 rounded-full">התחברות</button>
          <button onClick={() => onView('feed')} className="text-sm font-bold text-slate-600 px-3 py-2">לפיד</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={card + " space-y-4"}>
      <div>
        <div className="inline-flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Hammer size={18} strokeWidth={2.5} /></span>
          <span className="font-display font-bold text-lg text-slate-900">HandyHub</span>
        </div>
        <h1 className="font-display font-bold text-3xl text-slate-900 mt-3">בחירת סיסמה חדשה</h1>
        <p className="text-sm text-slate-500 mt-1">לחשבון <b dir="ltr">@{username}</b></p>
      </div>
      <label className="block">
        <span className="text-xs font-bold text-slate-700">סיסמה חדשה</span>
        <div className="relative">
          <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} autoComplete="new-password" dir="ltr" autoFocus className={input + " pl-16"} />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute left-2 top-1/2 -translate-y-1/2 mt-0.5 text-xs font-bold text-slate-500 hover:text-slate-800">
            {show ? 'הסתר' : 'הצג'}
          </button>
        </div>
        <span className="text-[11px] text-slate-500">לפחות 8 תווים.</span>
      </label>
      <label className="block">
        <span className="text-xs font-bold text-slate-700">אימות סיסמה</span>
        <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
          required autoComplete="new-password" dir="ltr" className={input} />
      </label>
      {error && <div role="alert" className="rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}
      <button type="submit" disabled={busy}
        className="w-full bg-rust-600 hover:bg-rust-700 disabled:opacity-60 text-white font-bold rounded-lg py-2.5">
        {busy ? 'שומר…' : 'שמירת סיסמה'}
      </button>
    </form>
  );
}
