// Notifications + Saved side panels (Hebrew)
const { useState: useStateN, useEffect: useEffectN } = React;

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
// NOTIFICATIONS
// ============================================================================
const NOTIF_META = {
  like:    { icon: <I.Heart size={14} />,         color: 'bg-rust-100 text-rust-700' },
  follow:  { icon: <I.Users size={14} />,         color: 'bg-blue-100 text-blue-700' },
  comment: { icon: <I.MessageCircle size={14} />, color: 'bg-emerald-100 text-emerald-700' },
  mention: { icon: <I.Hash size={14} />,          color: 'bg-purple-100 text-purple-700' },
  save:    { icon: <I.Bookmark size={14} />,      color: 'bg-amber-100 text-amber-700' },
  system:  { icon: <I.Sparkles size={14} />,      color: 'bg-slate-900 text-rust-300' },
};

function NotificationsPanel({ open, onClose }) {
  const [filter, setFilter] = useStateN('all');
  const [items, setItems] = useStateN(HUB_DATA.NOTIFICATIONS);
  const unread = items.filter(n => !n.read).length;

  const filtered = items.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'mentions') return n.kind === 'mention' || n.kind === 'comment';
    return true;
  });

  const markAllRead = () => setItems(arr => arr.map(n => ({ ...n, read: true })));

  return (
    <SidePanel open={open} onClose={onClose}
      title="התראות"
      subtitle={unread > 0 ? `${unread} התראות חדשות` : 'הכל מעודכן'}
      icon={<I.Bell size={20} strokeWidth={2.2} />}>

      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex gap-1 bg-slate-100 rounded-full p-0.5">
          {[
            { id: 'all',      label: 'הכל' },
            { id: 'unread',   label: 'לא נקראו', count: unread },
            { id: 'mentions', label: 'איזכורים' },
          ].map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className={"px-3 py-1.5 rounded-full text-xs font-bold transition " +
                         (filter === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
              {t.label}{t.count > 0 && <span className="mr-1 text-rust-600">({t.count})</span>}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs font-bold text-rust-700 hover:underline">סמן הכל כנקרא</button>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <li className="px-6 py-12 text-center text-sm text-slate-500">
            <I.Bell size={36} className="mx-auto text-slate-300 mb-2" />
            אין התראות חדשות.
          </li>
        ) : filtered.map(n => {
          const meta = NOTIF_META[n.kind];
          return (
            <li key={n.id} className={"px-4 py-3 hover:bg-slate-50 transition relative " + (!n.read ? "bg-rust-50/30" : "")}>
              {!n.read && <span className="absolute top-1/2 -translate-y-1/2 right-1.5 w-2 h-2 bg-rust-500 rounded-full"></span>}
              <div className="flex items-start gap-3">
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
                      {n.agent && <span className="mr-1.5 align-middle"><UI.AgentBadge /></span>}{' '}
                    </>}
                    {n.text}
                    {n.target && <span className="font-semibold text-slate-900"> {n.target}</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{HUB_DATA.timeAgo(n.minutesAgo)}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </SidePanel>
  );
}

// ============================================================================
// SAVED
// ============================================================================
function SavedPanel({ open, onClose }) {
  const [tab, setTab] = useStateN('projects');
  const savedPosts = HUB_DATA.SAVED_POSTS.map(id => HUB_DATA.POSTS.find(p => p.id === id)).filter(Boolean);
  const savedTools = HUB_DATA.SAVED_TOOLS.map(id => HUB_DATA.MARKET.find(m => m.id === id)).filter(Boolean);

  return (
    <SidePanel open={open} onClose={onClose}
      title="שמורים"
      subtitle={`${savedPosts.length} פרויקטים · ${savedTools.length} כלים`}
      icon={<I.Bookmark size={20} strokeWidth={2.2} fill="currentColor" />}>

      <div className="p-3 border-b border-slate-100 flex gap-1.5 bg-slate-50">
        <SavedTab active={tab === 'projects'} onClick={() => setTab('projects')} icon={<I.Hammer size={14}/>} label="פרויקטים" count={savedPosts.length} />
        <SavedTab active={tab === 'tools'}    onClick={() => setTab('tools')}    icon={<I.Wrench size={14}/>}  label="כלים"     count={savedTools.length} />
      </div>

      {tab === 'projects' && (
        <ul className="divide-y divide-slate-100">
          {savedPosts.map(p => (
            <li key={p.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
              <div className={"w-16 h-16 rounded-lg shrink-0 " + (p.bg || 'ph-paper') + " relative overflow-hidden"}>
                {p.kind === 'tutorial' && (
                  <span className="absolute inset-0 grid place-items-center bg-slate-900/30 text-white">
                    <I.ListChecks size={20}/>
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-rust-700 uppercase tracking-wider">
                  {p.kind === 'tutorial' ? 'מדריך' : p.kind === 'review' ? 'ביקורת' : 'פרויקט'}
                </div>
                <div className="font-bold text-sm text-slate-900 mt-0.5 line-clamp-2">
                  {p.title || p.overlay || (typeof p.body === 'string' ? p.body : 'פרויקט שמור')}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                  <UI.Avatar person={p.author} size={16} />
                  <span>{p.author.name}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{HUB_DATA.timeAgo(p.minutesAgo)}</span>
                </div>
              </div>
              <button className="text-slate-400 hover:text-rust-600 p-1" title="הסר משמורים">
                <I.Bookmark size={16} fill="currentColor"/>
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'tools' && (
        <ul className="divide-y divide-slate-100">
          {savedTools.map(item => (
            <li key={item.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
              <div className={"w-16 h-16 rounded-lg shrink-0 " + item.bg}></div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-slate-900 line-clamp-2">{item.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{item.cond}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-rust-700 font-display font-bold">{HUB_DATA.NIS(item.price)}</span>
                  <span className="text-[11px] text-slate-500 inline-flex items-center gap-0.5"><I.MapPin size={10}/> {item.dist}</span>
                </div>
              </div>
              <button className="bg-rust-600 hover:bg-rust-700 text-white text-xs font-bold px-3 py-1.5 rounded-full self-center shrink-0">
                קנה
              </button>
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
}

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

window.NotificationsPanel = NotificationsPanel;
window.SavedPanel = SavedPanel;
