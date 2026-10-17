// Account security: two-factor login with an authenticator app (TOTP).
// Off → setup (QR + secret) → confirm a code → backup codes (shown once) → on.
// On → new backup codes / turn off (both need the password + a current code).
import React, { useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { Spinner, ErrorRow } from './social.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { toast } from '../lib/toast.jsx';

const input = "w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm";

// The 2FA settings dialog: set up with a QR code, confirm a code, backup codes, regenerate or turn off.
export function SecurityModal({ onClose }) {
  const { updateUser } = useAuth();
  const [status, setStatus] = useState(null);       // { enabled, recovery_codes_left }
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState('status');       // status | setup | codes | disable | regenerate
  const [setup, setSetup] = useState(null);         // { secret, qr }
  const [codes, setCodes] = useState(null);         // freshly generated backup codes
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoadError('');
    api.twoFactor.status().then(setStatus).catch(e => setLoadError(e.message));
  };
  useEffect(load, []);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const go = (next) => { setStep(next); setCode(''); setPassword(''); setError(''); };
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const refreshUser = () => api.me().then(u => u && updateUser(u)).catch(() => {});

  const startSetup = () => run(async () => { setSetup(await api.twoFactor.setup()); go('setup'); });
  const confirmSetup = (e) => { e.preventDefault(); run(async () => {
    const r = await api.twoFactor.enable(code);
    setCodes(r.recovery_codes);
    setStatus({ enabled: true, recovery_codes_left: r.recovery_codes.length });
    refreshUser();
    go('codes');
  }); };
  const disable = (e) => { e.preventDefault(); run(async () => {
    await api.twoFactor.disable(password, code);
    setStatus({ enabled: false, recovery_codes_left: 0 });
    refreshUser();
    toast('אימות דו-שלבי כובה');
    go('status');
  }); };
  const regenerate = (e) => { e.preventDefault(); run(async () => {
    const r = await api.twoFactor.newRecoveryCodes(password, code);
    setCodes(r.recovery_codes);
    setStatus(s => ({ ...s, recovery_codes_left: r.recovery_codes.length }));
    go('codes');
  }); };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div role="dialog" aria-label="אבטחת חשבון" onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-pop w-full max-w-md my-4">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Shield size={18}/></span>
              <h3 className="font-display font-bold text-xl text-slate-900">אבטחת חשבון</h3>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="סגור"><I.X size={18}/></button>
          </div>

          <div className="p-4 space-y-4">
            {loadError && <ErrorRow message={loadError} onRetry={load} />}
            {!status && !loadError && <Spinner />}

            {status && step === 'status' && (
              <>
                <div className="flex items-start gap-3">
                  <span className={"mt-0.5 shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full " +
                                   (status.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                    {status.enabled ? 'פעיל' : 'כבוי'}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900">אימות דו-שלבי (2FA)</div>
                    <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
                      {status.enabled
                        ? 'בכל התחברות נבקש, בנוסף לסיסמה, קוד מאפליקציית האימות בטלפון.'
                        : 'שכבת הגנה נוספת: גם מי שיודע את הסיסמה שלכם לא יוכל להתחבר בלי הקוד מהטלפון.'}
                    </p>
                    {status.enabled && (
                      <p className="text-xs text-slate-500 mt-1.5">נותרו {status.recovery_codes_left} קודי גיבוי</p>
                    )}
                  </div>
                </div>
                {status.enabled ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => go('regenerate')} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-700">
                      קודי גיבוי חדשים
                    </button>
                    <button onClick={() => go('disable')} className="px-3 py-2 rounded-lg border border-rust-200 hover:bg-rust-50 text-sm font-bold text-rust-700">
                      כיבוי אימות דו-שלבי
                    </button>
                  </div>
                ) : (
                  <button onClick={startSetup} disabled={busy}
                    className="w-full bg-rust-600 hover:bg-rust-700 disabled:opacity-60 text-white font-bold rounded-lg py-2.5">
                    {busy ? 'רגע…' : 'הפעלת אימות דו-שלבי'}
                  </button>
                )}
              </>
            )}

            {step === 'setup' && setup && (
              <form onSubmit={confirmSetup} className="space-y-3">
                <ol className="text-sm text-slate-700 space-y-1.5 list-decimal pr-5">
                  <li>התקינו אפליקציית אימות (Google Authenticator, Microsoft Authenticator וכד׳).</li>
                  <li>סרקו את הקוד, או הקלידו את המפתח ידנית.</li>
                  <li>הזינו את הקוד בן 6 הספרות שמופיע באפליקציה.</li>
                </ol>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <img src={setup.qr} alt="QR לאפליקציית האימות" className="w-40 h-40 rounded-lg border border-slate-200 bg-white shrink-0" />
                  <div className="min-w-0 w-full">
                    <div className="text-xs font-bold text-slate-700">מפתח להקלדה ידנית</div>
                    <code dir="ltr" className="mt-1 block font-mono text-sm bg-slate-100 rounded-md px-2 py-1.5 break-all select-all">
                      {setup.secret.match(/.{1,4}/g).join(' ')}
                    </code>
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">קוד מהאפליקציה</span>
                  <input value={code} onChange={(e) => setCode(e.target.value)} required inputMode="numeric" maxLength={7}
                    autoComplete="one-time-code" placeholder="123456" dir="ltr" aria-label="קוד מהאפליקציה"
                    className={input + " mt-1 text-center font-mono text-lg tracking-[0.4em]"} />
                </label>
                <Actions busy={busy} onCancel={() => go('status')} label="אישור והפעלה" />
              </form>
            )}

            {step === 'codes' && codes && (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2.5">
                  <b>שמרו את קודי הגיבוי במקום בטוח.</b> כל קוד עובד פעם אחת, למקרה שאין לכם גישה לטלפון. הם לא יוצגו שוב.
                </div>
                <ul dir="ltr" className="grid grid-cols-2 gap-1.5 font-mono text-sm" aria-label="קודי גיבוי">
                  {codes.map(c => <li key={c} className="bg-slate-100 rounded-md px-2 py-1.5 text-center select-all">{c}</li>)}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => navigator.clipboard?.writeText(codes.join('\n')).then(() => toast('הקודים הועתקו'), () => {})}
                    className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <I.Copy size={14}/> העתקה
                  </button>
                  <button onClick={() => { setCodes(null); go('status'); }}
                    className="flex-1 bg-rust-600 hover:bg-rust-700 text-white font-bold rounded-lg py-2">שמרתי אותם</button>
                </div>
              </div>
            )}

            {(step === 'disable' || step === 'regenerate') && (
              <form onSubmit={step === 'disable' ? disable : regenerate} className="space-y-3">
                <p className="text-sm text-slate-600">
                  {step === 'disable' ? 'כדי לכבות את האימות הדו-שלבי, אשרו שזה אתם:' : 'הקודים הישנים יפסיקו לעבוד. אשרו שזה אתם:'}
                </p>
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">סיסמה</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr"
                    autoComplete="current-password" aria-label="סיסמה" className={input + " mt-1"} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">קוד מהאפליקציה או קוד גיבוי</span>
                  <input value={code} onChange={(e) => setCode(e.target.value)} required dir="ltr" autoComplete="one-time-code"
                    aria-label="קוד אימות" className={input + " mt-1 font-mono"} />
                </label>
                <Actions busy={busy} onCancel={() => go('status')} danger={step === 'disable'}
                  label={step === 'disable' ? 'כיבוי' : 'יצירת קודים חדשים'} />
              </form>
            )}

            {error && <div role="alert" className="rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Cancel + submit buttons at the bottom of each step's form.
function Actions({ busy, onCancel, label, danger }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">ביטול</button>
      <button type="submit" disabled={busy}
        className={"disabled:opacity-60 text-white font-bold text-sm px-5 py-2 rounded-full " +
                   (danger ? "bg-slate-900 hover:bg-slate-800" : "bg-rust-600 hover:bg-rust-700")}>
        {busy ? 'רגע…' : label}
      </button>
    </div>
  );
}
