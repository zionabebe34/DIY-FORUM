// Moderation dashboard (#/admin) — report cases, content removal, bans and roles.
import React, { useCallback, useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import { REASON_LABEL } from './report.jsx';
import { Spinner, ErrorRow } from './social.jsx';
import { api, minutesSince, toPerson } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useDebounced } from '../lib/hooks.js';
import { toast } from '../lib/toast.jsx';

const TARGET_LABEL = { post: 'פוסט', comment: 'תגובה', user: 'משתמש' };
const RESOLUTION_LABEL = { content_deleted: 'התוכן נמחק', user_banned: 'המשתמש נחסם', dismissed: 'נסגר ללא הפרה' };
const ROLE_LABEL = { user: 'משתמש', moderator: 'מודרטור', admin: 'מנהל' };
// ISO date → a casual Hebrew time-ago label.
const ago = (iso) => AN.timeAgoCasual(minutesSince(iso));

// The #/admin page (staff only): stats header + tabs for open reports, handled reports and users.
export function AdminDashboard({ onOpenProfile, onView }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('open');
  const [stats, setStats] = useState(null);
  const [version, setVersion] = useState(0);            // bump → reload stats + current tab
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!user?.isStaff) return;
    api.admin.stats().then(setStats).catch(() => {});
  }, [user, version]);

  if (!user?.isStaff) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3"><I.Shield size={24} className="text-slate-400"/></div>
        <div className="font-display font-bold text-slate-900">העמוד הזה מיועד לצוות הניהול</div>
        <button onClick={() => onView('feed')} className="mt-4 bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-full">חזרה לפיד</button>
      </div>
    );
  }

  const TABS = [
    { id: 'open',   label: 'דיווחים פתוחים', icon: <I.Flag size={14}/>, count: stats?.open_cases },
    { id: 'closed', label: 'טופלו',          icon: <I.Check size={14}/> },
    { id: 'users',  label: 'משתמשים',        icon: <I.Users size={14}/> },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-rust-500/20 text-rust-400 grid place-items-center"><I.Shield size={22}/></span>
            <div>
              <h1 className="font-display font-bold text-2xl">לוח ניהול</h1>
              <p className="text-xs text-slate-300">מחובר/ת כ{ROLE_LABEL[user.role]} · {user.handle}</p>
            </div>
          </div>
          <button onClick={refresh} className="text-xs font-bold text-slate-200 hover:text-white inline-flex items-center gap-1">
            <I.TrendUp size={13}/> רענון
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <StatTile label="מקרים פתוחים" value={stats?.open_cases} accent />
          <StatTile label="משתמשים" value={stats?.users} />
          <StatTile label="חסומים" value={stats?.banned_users} />
          <StatTile label="פוסטים" value={stats?.posts} />
        </div>
      </section>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5" role="tablist">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id}
            className={"flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition " +
                       (tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {t.icon}<span>{t.label}</span>
            {t.count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rust-500 text-white">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab !== 'users'
        ? <CaseList key={tab + version} status={tab} onOpenProfile={onOpenProfile} onChanged={refresh} />
        : <UserAdmin key={'users' + version} onOpenProfile={onOpenProfile} onChanged={refresh} />}
    </div>
  );
}

// One number in the dashboard header.
function StatTile({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
      <div className={"font-display font-bold text-2xl " + (accent ? "text-rust-400" : "text-white")}>{value ?? '—'}</div>
      <div className="text-[11px] text-slate-300 font-mono">{label}</div>
    </div>
  );
}

// ── Report cases ────────────────────────────────────────────────────────────
// The report cases (open or handled), each as a CaseCard; opens the ban dialog.
function CaseList({ status, onOpenProfile, onChanged }) {
  const [cases, setCases] = useState(null);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState(null);

  const load = useCallback(() => {
    setError('');
    api.admin.cases(status).then(setCases).catch(e => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const done = (msg) => { toast(msg); load(); onChanged(); };

  if (error) return <ErrorRow message={error} onRetry={load} />;
  if (cases === null) return <Spinner />;
  if (cases.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 grid place-items-center mb-3"><I.Check size={24} className="text-emerald-600"/></div>
        <div className="font-display font-bold text-slate-900">{status === 'open' ? 'אין דיווחים פתוחים 🎉' : 'עוד לא טופלו דיווחים'}</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {cases.map(c => (
        <CaseCard key={c.target_type + c.target_id} c={c} onOpenProfile={onOpenProfile} onDone={done}
                  onBan={(u) => setBanTarget(u)} />
      ))}
      {banTarget && <BanDialog person={banTarget} onClose={() => setBanTarget(null)}
                               onDone={() => { setBanTarget(null); done(`@${banTarget.username} נחסם/ה`); }} />}
    </div>
  );
}

// One reported post / comment / user: its reports and the actions (delete content, ban author, dismiss).
function CaseCard({ c, onOpenProfile, onDone, onBan }) {
  const [showReports, setShowReports] = useState(false);
  const [busy, setBusy] = useState(false);
  const author = c.target_user ? toPerson(c.target_user) : null;
  const open = c.status === 'open';

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); onDone(msg); } catch (e) { toast(e.message, 'error'); setBusy(false); }
  };
  const deleteContent = () => {
    if (!window.confirm(`למחוק את ה${TARGET_LABEL[c.target_type]}? לא ניתן לבטל.`)) return;
    act(() => c.target_type === 'post' ? api.deletePost(c.target_id) : api.deleteComment(c.target_id), 'התוכן נמחק');
  };

  return (
    <article className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill bg-slate-900 text-white">{TARGET_LABEL[c.target_type]}</span>
            <span className={"pill " + (c.count > 1 ? "bg-rust-600 text-white" : "bg-rust-50 text-rust-700")}>
              <I.Flag size={11}/> {c.count} דיווחים
            </span>
            {Object.entries(c.reasons).map(([r, n]) => (
              <span key={r} className="pill bg-slate-100 text-slate-700">{REASON_LABEL[r] || r}{n > 1 ? ` ×${n}` : ''}</span>
            ))}
          </div>
          <span className="text-[11px] font-mono text-slate-500">{ago(c.last_reported_at)}</span>
        </div>

        <blockquote className={"rounded-xl border px-3 py-2 text-sm leading-relaxed " +
                               (c.target_exists ? "border-slate-200 bg-slate-50 text-slate-800" : "border-dashed border-slate-300 text-slate-500")}>
          {!c.target_exists && <div className="text-[11px] font-bold text-slate-500 mb-1">התוכן כבר לא קיים · כך הוא נראה בזמן הדיווח:</div>}
          <span dir="auto" className="whitespace-pre-line break-words">{c.snapshot || '—'}</span>
        </blockquote>

        {author && (
          <div className="flex items-center gap-2">
            <button onClick={() => onOpenProfile(author.username)} className="inline-flex items-center gap-2 hover:text-rust-700">
              <UI.Avatar person={author} size={28} />
              <span className="text-sm font-bold">{author.name}</span>
              <span className="text-xs text-slate-500" dir="ltr">{author.handle}</span>
            </button>
            {author.isBanned && <span className="pill bg-rust-700 text-white"><I.Ban size={11}/> חסום</span>}
            {author.isStaff && <span className="pill bg-slate-100 text-slate-700"><I.Shield size={11}/> {ROLE_LABEL[author.role]}</span>}
          </div>
        )}

        <button onClick={() => setShowReports(s => !s)} className="text-xs font-bold text-slate-600 hover:text-rust-700 inline-flex items-center gap-1">
          <I.ChevronDown size={13} className={showReports ? 'rotate-180' : ''}/> {showReports ? 'הסתר' : 'הצג'} את הדיווחים
        </button>
        {showReports && (
          <ul className="space-y-1.5">
            {c.reports.map(r => (
              <li key={r.id} className="text-xs text-slate-700 flex items-start gap-2 flex-wrap">
                <span className="font-bold">{r.automatic ? '🤖 סינון אוטומטי' : r.reporter ? `@${r.reporter.username}` : 'משתמש שנמחק'}</span>
                <span className="text-slate-500">· {REASON_LABEL[r.reason]} · {ago(r.created_at)}</span>
                {r.details && <span className="basis-full text-slate-600 pr-3">"{r.details}"</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {open ? (
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          {c.target_exists && c.target_type !== 'user' && (
            <button onClick={deleteContent} disabled={busy}
              className="inline-flex items-center gap-1.5 bg-rust-600 hover:bg-rust-700 disabled:opacity-60 text-white text-sm font-bold px-3.5 py-1.5 rounded-full">
              <I.Trash size={14}/> מחק תוכן
            </button>
          )}
          {author && !author.isBanned && (
            <button onClick={() => onBan(author)} disabled={busy}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold px-3.5 py-1.5 rounded-full">
              <I.Ban size={14}/> חסום את <bdi dir="ltr">{author.handle}</bdi>
            </button>
          )}
          <button onClick={() => act(() => api.admin.dismiss(c.target_type, c.target_id), 'המקרה נסגר')} disabled={busy}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-60 text-slate-700 text-sm font-bold px-3.5 py-1.5 rounded-full">
            <I.Check size={14}/> אין הפרה — סגור
          </button>
        </div>
      ) : (
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-600">
          <b>{RESOLUTION_LABEL[c.resolution] || c.resolution}</b>
          {c.resolved_by && <> · ע״י @{c.resolved_by}</>}
          {c.resolved_at && <> · {ago(c.resolved_at)}</>}
        </div>
      )}
    </article>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────
// Users tab: search / filter users, ban or unban them, and (admins) change their role.
function UserAdmin({ onOpenProfile, onChanged }) {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const query = useDebounced(q.trim(), 250);

  const load = useCallback(() => {
    setError('');
    api.admin.users(query, filter).then(setUsers).catch(e => setError(e.message));
  }, [query, filter]);
  useEffect(load, [load]);

  const after = (msg) => { toast(msg); load(); onChanged(); };
  const unban = async (u) => {
    try { await api.admin.unban(u.username); after(`החסימה של @${u.username} הוסרה`); }
    catch (e) { toast(e.message, 'error'); }
  };
  const setRole = async (u, role) => {
    try { await api.admin.setRole(u.username, role); after(`@${u.username} עכשיו ${ROLE_LABEL[role]}`); }
    catch (e) { toast(e.message, 'error'); }
  };
  const rank = { user: 0, moderator: 1, admin: 2 };
  const canAct = (u) => u.username !== me.username && (me.role === 'admin' || rank[me.role] > rank[u.role]);

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="p-3 flex items-center gap-2 border-b border-slate-100 flex-wrap">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-slate-100 rounded-full px-3 h-9">
          <I.Search size={15} className="text-slate-500"/>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם, משתמש או אימייל" aria-label="חיפוש משתמשים"
            className="bg-transparent outline-none flex-1 text-sm" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="סינון"
          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold">
          <option value="all">כולם</option>
          <option value="banned">חסומים</option>
          <option value="staff">צוות ניהול</option>
        </select>
      </div>
      {error && <ErrorRow message={error} onRetry={load} />}
      {users === null && !error && <Spinner />}
      {users && users.length === 0 && <div className="p-6 text-center text-sm text-slate-500">לא נמצאו משתמשים</div>}
      <ul className="divide-y divide-slate-100">
        {(users || []).map(raw => {
          const u = { ...toPerson(raw), emailAddr: raw.email, banReason: raw.ban_reason,
                      posts: raw.posts_count, reports: raw.reports_count };
          return (
            <li key={u.username} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <button onClick={() => onOpenProfile(u.username)} className="shrink-0"><UI.Avatar person={u} size={40}/></button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => onOpenProfile(u.username)} className="font-bold text-sm text-slate-900 hover:text-rust-700">{u.name}</button>
                  {u.agent && <UI.AgentBadge />}
                  {u.isBanned && <span className="pill bg-rust-700 text-white"><I.Ban size={11}/> חסום</span>}
                  {u.isStaff && <span className="pill bg-slate-100 text-slate-700"><I.Shield size={11}/> {ROLE_LABEL[u.role]}</span>}
                </div>
                <div className="text-xs text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>{u.handle} · {u.emailAddr}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {u.posts} פוסטים · <span className={u.reports ? 'text-rust-700 font-bold' : ''}>{u.reports} דיווחים</span>
                  {u.isBanned && u.banReason && <> · סיבת חסימה: {u.banReason}</>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {me.role === 'admin' && u.username !== me.username && (
                  <select value={u.role} onChange={(e) => setRole(u, e.target.value)} aria-label={`תפקיד של ${u.username}`}
                    className="h-8 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold">
                    <option value="user">משתמש</option>
                    <option value="moderator">מודרטור</option>
                    <option value="admin">מנהל</option>
                  </select>
                )}
                {canAct(u) && (u.isBanned
                  ? <button onClick={() => unban(u)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700">הסר חסימה</button>
                  : <button onClick={() => setBanTarget(u)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-rust-700 inline-flex items-center gap-1"><I.Ban size={12}/> חסום</button>)}
              </div>
            </li>
          );
        })}
      </ul>
      {banTarget && <BanDialog person={banTarget} onClose={() => setBanTarget(null)}
                               onDone={() => { setBanTarget(null); after(`@${banTarget.username} נחסם/ה`); }} />}
    </section>
  );
}

// ── Ban dialog ──────────────────────────────────────────────────────────────
// Ban a user with a reason, optionally deleting all their posts and comments.
export function BanDialog({ person, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [purge, setPurge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.admin.ban(person.username, reason.trim(), purge);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-pop w-full max-w-md p-5 space-y-3">
        <h3 className="font-display font-bold text-xl text-slate-900 inline-flex items-center gap-2"><I.Ban size={18} className="text-rust-700"/> חסימת {person.name}</h3>
        <p className="text-sm text-slate-600">
          המשתמש ינותק מיד, לא יוכל להתחבר, והתוכן שלו יוסתר מהאתר. אפשר לבטל את החסימה בכל רגע מלשונית "משתמשים".
        </p>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="סיבת החסימה (תוצג לצוות בלבד)"
          className="w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} className="accent-rust-600" />
          למחוק לצמיתות גם את כל הפוסטים והתגובות שלו
        </label>
        {error && <div role="alert" className="rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm font-bold text-slate-600 px-3 py-2">ביטול</button>
          <button type="submit" disabled={busy} className="bg-rust-700 hover:bg-rust-800 disabled:opacity-60 text-white text-sm font-bold px-5 py-2 rounded-full">
            {busy ? 'חוסם…' : 'חסום'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
