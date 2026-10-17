import React from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import { Spinner, ErrorRow } from './social.jsx';
import { api, minutesSince } from '../lib/api.js';
import { useSaved, SAVED_EVENT } from '../lib/saved.js';
// Notifications + Saved side panels (Hebrew)
const { useState: useStateN, useEffect: useEffectN } = React;

// A slide-in side panel shell: title, close on Esc or a click outside.
function SidePanel({ open, onClose, title, subtitle, icon, children }) {
  useEffectN(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <aside className="fixed z-50 right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white shadow-pop flex flex-col overflow-hidden animate-in-rtl">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-slate-900 text-rust-400 grid place-items-center shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-bold text-slate-900 text-lg leading-none">{title}</h2>
            <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><I.X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </aside>
      <style>{`
        @keyframes slideRTL { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-in-rtl { animation: slideRTL .22s ease-out; }
      `}</style>
    </>
  );
}

// ============================================================================
// NOTIFICATIONS — /api/notifications (likes, comments, replies, @mentions, follows, saves)
// ============================================================================
const NOTIF_META = {
  like:    { icon: <I.Heart size={14} />,         color: 'bg-rust-100 text-rust-700',       text: 'אהב/ה את הפוסט שלך' },
  follow:  { icon: <I.Users size={14} />,         color: 'bg-blue-100 text-blue-700',       text: 'התחיל/ה לעקוב אחריך' },
  comment: { icon: <I.MessageCircle size={14} />, color: 'bg-emerald-100 text-emerald-700', text: 'הגיב/ה על הפוסט שלך:' },
  reply:   { icon: <I.MessageCircle size={14} />, color: 'bg-emerald-100 text-emerald-700', text: 'השיב/ה לתגובה שלך:' },
  mention: { icon: <I.Hash size={14} />,          color: 'bg-purple-100 text-purple-700',   text: 'הזכיר/ה אותך:' },
  save:    { icon: <I.Bookmark size={14} />,      color: 'bg-amber-100 text-amber-700',     text: 'שמר/ה את הפוסט שלך' },
  share:   { icon: <I.Share size={14} />,         color: 'bg-sky-100 text-sky-700',         text: 'שיתף/ה את הפוסט שלך' },
  system:  { icon: <I.Sparkles size={14} />,      color: 'bg-slate-900 text-rust-300',      text: '' },
};
const QUOTED = new Set(['comment', 'reply', 'mention', 'share']);   // show their words, not the post title

// The notifications panel: all / unread / mentions, load more, mark read, click → open the post / profile.
function NotificationsPanel({ open, onClose, onOpenPost, onOpenProfile, onUnreadChange }) {
  const [filter, setFilter] = useStateN('all');
  const [items, setItems] = useStateN([]);
  const [cursor, setCursor] = useStateN(null);
  const [unread, setUnread] = useStateN(0);
  const [loading, setLoading] = useStateN(false);
  const [error, setError] = useStateN(null);

  const setUnreadCount = (n) => { setUnread(n); onUnreadChange && onUnreadChange(n); };
  const load = async (before) => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.notifications({ filter, before });
      setItems(prev => before ? [...prev, ...page.items] : page.items);
      setCursor(page.nextCursor);
      setUnreadCount(page.unread);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffectN(() => { if (open) load(); }, [open, filter]);

  const markRead = async (ids) => {
    setItems(arr => arr.map(n => (!ids || ids.includes(n.id)) ? { ...n, read: true } : n));
    try { setUnreadCount(await api.markNotificationsRead(ids)); } catch { /* the next load shows the truth */ }
  };
  const openItem = (n) => {
    if (!n.read) markRead([n.id]);
    if (n.kind === 'follow' && n.actor) { onOpenProfile && onOpenProfile(n.actor.username); onClose(); }
    else if (n.post) { onOpenPost && onOpenPost(n.post.id); onClose(); }
  };

  return (
    <SidePanel open={open} onClose={onClose}
      title="התראות"
      subtitle={unread > 0 ? `${unread} התראות חדשות` : 'הכל מעודכן'}
      icon={<I.Bell size={20} strokeWidth={2.2} />}>

      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex gap-1 bg-slate-100 rounded-full p-0.5" role="tablist">
          {[
            { id: 'all',      label: 'הכל' },
            { id: 'unread',   label: 'לא נקראו', count: unread },
            { id: 'mentions', label: 'תגובות ואיזכורים' },
          ].map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)} role="tab" aria-selected={filter === t.id}
              className={"px-3 py-1.5 rounded-full text-xs font-bold transition " +
                         (filter === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
              {t.label}{t.count > 0 && <span className="mr-1 text-rust-600">({t.count})</span>}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button onClick={() => markRead()} className="text-xs font-bold text-rust-700 hover:underline shrink-0">סמן הכל כנקרא</button>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {!loading && !error && items.length === 0 && (
          <li className="px-6 py-12 text-center text-sm text-slate-500">
            <I.Bell size={36} className="mx-auto text-slate-300 mb-2" />
            {filter === 'unread' ? 'אין התראות שלא נקראו.' : filter === 'mentions' ? 'אין תגובות או איזכורים עדיין.' : 'אין התראות עדיין.'}
          </li>
        )}
        {items.map(n => {
          const meta = NOTIF_META[n.kind] || NOTIF_META.system;
          const clickable = (n.kind === 'follow' && n.actor) || n.post;
          return (
            <li key={n.id} className={"relative transition " + (!n.read ? "bg-rust-50/30" : "")}>
              {!n.read && <span className="absolute top-1/2 -translate-y-1/2 right-1.5 w-2 h-2 bg-rust-500 rounded-full" aria-label="לא נקרא"></span>}
              <button onClick={() => openItem(n)} disabled={!clickable && n.read}
                className="w-full text-right px-4 py-3 flex items-start gap-3 hover:bg-slate-50 disabled:hover:bg-transparent disabled:cursor-default">
                <div className="relative shrink-0">
                  {n.actor ? <UI.Avatar person={n.actor} size={40} /> : (
                    <span className="w-10 h-10 rounded-full bg-slate-900 text-rust-400 grid place-items-center">
                      <I.Sparkles size={18} />
                    </span>
                  )}
                  <span className={"absolute -bottom-1 -left-1 w-6 h-6 rounded-full grid place-items-center ring-2 ring-white " + meta.color}>
                    {meta.icon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800 leading-snug">
                    {n.actor && <>
                      <span className="font-bold">{n.actor.name}</span>
                      {n.actor.agent && <span className="mr-1.5 align-middle"><UI.AgentBadge /></span>}{' '}
                    </>}
                    {n.kind === 'system' ? n.text : meta.text}
                    {QUOTED.has(n.kind) && n.text && <span className="font-semibold text-slate-900" dir="auto"> "{n.text}"</span>}
                    {!QUOTED.has(n.kind) && n.post?.title && <span className="font-semibold text-slate-900" dir="auto"> {n.post.title}</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{AN.timeAgoCasual(minutesSince(n.createdAt))}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {loading && <Spinner />}
      {error && <ErrorRow message={error} onRetry={() => load(cursor ?? undefined)} />}
      {!loading && !error && cursor && (
        <div className="p-3 text-center">
          <button onClick={() => load(cursor)} className="text-sm font-bold text-rust-700 hover:underline">טען עוד</button>
        </div>
      )}
    </SidePanel>
  );
}

// ============================================================================
// SAVED — /api/saved (my bookmarked posts and marketplace listings)
// ============================================================================
function SavedPanel({ open, onClose, onOpenPost, onContact }) {
  const [tab, setTab] = useStateN('projects');
  const [data, setData] = useStateN(null);
  const [error, setError] = useStateN(null);

  const load = () => {
    setError(null);
    api.saved().then(setData).catch(e => setError(e.message));
  };
  useEffectN(() => { if (open) { setData(null); load(); } }, [open]);

  // Unsaving (here or on any card) drops the item from the list
  useEffectN(() => {
    const onChange = ({ detail }) => {
      if (detail.saved) return;
      const key = detail.type === 'post' ? 'posts' : 'listings';
      setData(d => d && { ...d, [key]: d[key].filter(x => x.id !== detail.id) });
    };
    window.addEventListener(SAVED_EVENT, onChange);
    return () => window.removeEventListener(SAVED_EVENT, onChange);
  }, []);

  const posts = data?.posts || [];
  const tools = data?.listings || [];
  return (
    <SidePanel open={open} onClose={onClose}
      title="שמורים"
      subtitle={`${posts.length} פרויקטים · ${tools.length} כלים`}
      icon={<I.Bookmark size={20} strokeWidth={2.2} fill="currentColor" />}>

      <div className="p-3 border-b border-slate-100 flex gap-1.5 bg-slate-50" role="tablist">
        <SavedTab active={tab === 'projects'} onClick={() => setTab('projects')} icon={<I.Hammer size={14}/>} label="פרויקטים" count={posts.length} />
        <SavedTab active={tab === 'tools'}    onClick={() => setTab('tools')}    icon={<I.Wrench size={14}/>}  label="כלים"     count={tools.length} />
      </div>

      {error && <ErrorRow message={error} onRetry={load} />}
      {!data && !error && <Spinner />}

      {data && tab === 'projects' && (posts.length === 0 ? (
        <SavedEmpty text="עוד לא שמרת פרויקטים. לחצו על &quot;שמירה&quot; בפוסט כדי לחזור אליו אחר כך." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {posts.map(p => <SavedPostRow key={p.id} post={p} onOpen={() => { onOpenPost && onOpenPost(p.id); onClose(); }} />)}
        </ul>
      ))}

      {data && tab === 'tools' && (tools.length === 0 ? (
        <SavedEmpty text="עוד לא שמרת כלים מהשוק." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {tools.map(item => <SavedToolRow key={item.id} item={item} onContact={() => { onContact && onContact(item); onClose(); }} />)}
        </ul>
      ))}
    </SidePanel>
  );
}

// Empty state of a saved tab.
function SavedEmpty({ text }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-slate-500">
      <I.Bookmark size={36} className="mx-auto text-slate-300 mb-2" />
      {text}
    </div>
  );
}

// A saved post row: thumbnail and title (opens it), remove from saved.
function SavedPostRow({ post: p, onOpen }) {
  const [, toggleSave] = useSaved('post', p.id, true);
  const label = p.title || htmlText(p.bodyHtml) || 'פרויקט שמור';
  return (
    <li className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
      <button onClick={onOpen} className="flex items-start gap-3 min-w-0 flex-1 text-right">
        <div className={"w-16 h-16 rounded-lg shrink-0 relative overflow-hidden " + (p.images.length ? 'bg-slate-100' : 'ph-paper')}>
          {p.images[0] && <img src={p.images[0]} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
          {p.kind === 'tutorial' && (
            <span className="absolute inset-0 grid place-items-center bg-slate-900/30 text-white">
              <I.ListChecks size={20}/>
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-rust-700 uppercase tracking-wider">{p.kind === 'tutorial' ? 'מדריך' : 'פרויקט'}</div>
          <div className="font-bold text-sm text-slate-900 mt-0.5 line-clamp-2" dir="auto">{label}</div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
            <UI.Avatar person={p.author} size={16} />
            <span>{p.author.name}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>{AN.timeAgoCasual(minutesSince(p.createdAt))}</span>
          </div>
        </div>
      </button>
      <button onClick={toggleSave} className="text-rust-600 hover:text-slate-400 p-1" title="הסר משמורים" aria-label="הסר משמורים">
        <I.Bookmark size={16} fill="currentColor"/>
      </button>
    </li>
  );
}

// A saved listing row: photo, price, remove, buy / borrow (opens a chat).
function SavedToolRow({ item, onContact }) {
  const [, toggleSave] = useSaved('listing', item.id, true);
  const isLend = item.listingType === 'lend';
  return (
    <li className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
      <div className={"w-16 h-16 rounded-lg shrink-0 relative overflow-hidden " + (item.image ? 'bg-slate-100' : item.bg)}>
        {item.image && <img src={item.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm text-slate-900 line-clamp-2" dir="auto">{item.name}</div>
        <div className="text-xs text-slate-500 mt-0.5">{item.seller.name}{item.seller.loc && ` · ${item.seller.loc}`}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-rust-700 font-display font-bold">
            {isLend ? `${HUB_DATA.NIS(item.dailyPrice)} / יום` : HUB_DATA.NIS(item.price)}
          </span>
          <button onClick={toggleSave} className="text-[11px] text-slate-500 hover:text-rust-700 inline-flex items-center gap-0.5"
                  aria-label="הסר משמורים">
            <I.X size={10}/> הסר
          </button>
        </div>
      </div>
      <button onClick={onContact}
        className={"text-white text-xs font-bold px-3 py-1.5 rounded-full self-center shrink-0 " +
                   (isLend ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rust-600 hover:bg-rust-700")}>
        {isLend ? 'השאל' : 'קנה'}
      </button>
    </li>
  );
}

// HTML → plain text (for row titles).
const htmlText = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// A tab button (posts / tools) with its count.
function SavedTab({ active, onClick, icon, label, count }) {
  return (
    <button onClick={onClick}
      className={"flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition " +
                 (active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
      {icon}<span>{label}</span>
      <span className={"text-[10px] font-bold px-1.5 rounded-full " + (active ? "bg-rust-100 text-rust-700" : "bg-slate-200 text-slate-600")}>{count}</span>
    </button>
  );
}

export { NotificationsPanel as NotificationsPanel };
export { SavedPanel as SavedPanel };
