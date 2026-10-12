// HandyHub main app — Navbar, Feed view, Composer, view router
import React, { useCallback, useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
import { PostCards } from './posts.jsx';
import { SECTIONS } from './sections.jsx';
import { PostComposer } from './composer.jsx';
import { MessagesPanel } from './messages.jsx';
import { NotificationsPanel, SavedPanel } from './panels.jsx';
import { Profile, EditProfileModal } from './profile.jsx';
import { Spinner, ErrorRow } from './social.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useDebounced, useInfiniteScroll, usePaginated } from '../lib/hooks.js';

// ====================== ROUTING (hash based) =================================
//   #/              feed           #/tag/<tag>     feed filtered by hashtag
//   #/u/<username>  profile        #/market  #/stores  #/store/<id>
function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (parts[0]) {
    case 'u':      return { view: 'profile', param: parts[1] };
    case 'tag':    return { view: 'feed', param: parts[1] ? '#' + parts[1] : null };
    case 'market': return { view: 'marketplace' };
    case 'stores': return { view: 'stores' };
    case 'store':  return { view: 'store', param: parts[1] };
    default:       return { view: 'feed', param: null };
  }
}

function hashFor(view, param) {
  const enc = encodeURIComponent;
  if (view === 'profile') return `#/u/${enc(param)}`;
  if (view === 'feed' && param) return `#/tag/${enc(param.replace(/^#/, ''))}`;
  if (view === 'marketplace') return '#/market';
  if (view === 'stores') return '#/stores';
  if (view === 'store') return `#/store/${enc(param)}`;
  return '#/';
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => { setRoute(parseHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((view, param) => {
    const next = hashFor(view, param);
    if (window.location.hash === next) window.scrollTo({ top: 0, behavior: 'smooth' });
    else window.location.hash = next;
  }, []);
  return [route, navigate];
}

// ====================== NAVBAR ==============================================
function Navbar({ view, onView, onSign, onMobileMenu, onOpenMessages, onOpenNotifications, onOpenSaved, onOpenProfile, onOpenSettings, onPickTag, unreadMessages, unreadNotifications }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState({ people: [], posts: [], tags: [] });
  const [searching, setSearching] = useState(false);
  const debounced = useDebounced(query.trim(), 250);

  useEffect(() => {
    if (!debounced) { setResults({ people: [], posts: [], tags: [] }); return; }
    let alive = true;
    setSearching(true);
    api.search(debounced)
      .then(r => alive && setResults(r))
      .catch(() => alive && setResults({ people: [], posts: [], tags: [] }))
      .finally(() => alive && setSearching(false));
    return () => { alive = false; };
  }, [debounced]);

  const hasAny = results.people.length + results.posts.length + results.tags.length > 0;
  const closeSearch = () => { setQuery(''); setFocused(false); };
  const plain = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        {/* Mobile menu */}
        <button onClick={onMobileMenu} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg" aria-label="תפריט">
          <I.Menu size={20} />
        </button>

        {/* Logo */}
        <a href="#/" onClick={(e) => { e.preventDefault(); onView('feed'); }} className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center">
            <I.Hammer size={20} strokeWidth={2.5} />
          </span>
          <span className="font-display font-bold text-xl text-slate-900 hidden sm:inline">HandyHub</span>
        </a>

        {/* Search */}
        <div className="flex-1 max-w-lg relative">
          <div className={"flex items-center gap-2 bg-slate-100 rounded-full pl-3.5 pr-2 h-10 transition " +
                          (focused ? "ring-2 ring-rust-500/30 bg-white border border-slate-200" : "border border-transparent")}>
            <I.Search size={16} className="text-slate-500 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
              placeholder="חפש יוצרים, פרויקטים, תגיות…"
              aria-label="חיפוש"
              className="bg-transparent outline-none flex-1 min-w-0 text-sm text-slate-800 placeholder:text-slate-500" />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-700" aria-label="נקה חיפוש"><I.X size={14} /></button>
            )}
          </div>
          {focused && query.trim() && (
            <div className="absolute left-0 right-0 top-12 bg-white rounded-xl shadow-pop border border-slate-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
              {!hasAny && (
                <div className="px-4 py-6 text-sm text-slate-500 text-center">
                  {searching || debounced !== query.trim() ? 'מחפש…' : `לא נמצאו תוצאות ל-"${query}"`}
                </div>
              )}

              {/* People */}
              {results.people.length > 0 && (
                <>
                  <SearchHeader icon={<I.Users size={11}/>} label="יוצרים" />
                  {results.people.map(p => (
                    <button key={p.username}
                      onMouseDown={(e) => { e.preventDefault(); onOpenProfile(p.username); closeSearch(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-right">
                      <UI.Avatar person={p} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                          {p.agent && <UI.AgentBadge />}
                          {p.verified && <I.Verified size={13} className="text-rust-600"/>}
                        </div>
                        <div className="text-xs text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>{p.handle}</div>
                      </div>
                      <I.ChevronDown size={14} className="text-slate-400 -rotate-90"/>
                    </button>
                  ))}
                </>
              )}

              {/* Posts */}
              {results.posts.length > 0 && (
                <>
                  <SearchHeader icon={<I.Image size={11}/>} label="פרויקטים ומדריכים" />
                  {results.posts.map(p => (
                    <button key={p.id}
                      onMouseDown={(e) => { e.preventDefault(); onOpenProfile(p.author.username); closeSearch(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-right">
                      {p.images[0]
                        ? <img src={p.images[0]} alt="" className="w-10 h-10 rounded-md shrink-0 object-cover" />
                        : <div className={"w-10 h-10 rounded-md shrink-0 " + (p.steps[0]?.thumb || 'ph-night')}></div>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm line-clamp-1">{p.title || plain(p.bodyHtml) || 'ללא כותרת'}</span>
                          <span className="pill bg-slate-100 text-slate-600 text-[10px]">{p.kind === 'tutorial' ? 'מדריך' : 'פרויקט'}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">מאת {p.author.name}</div>
                      </div>
                      <I.ChevronDown size={14} className="text-slate-400 -rotate-90"/>
                    </button>
                  ))}
                </>
              )}

              {/* Tags */}
              {results.tags.length > 0 && (
                <>
                  <SearchHeader icon={<I.Hash size={11}/>} label="האשטגים" />
                  {results.tags.map(t => (
                    <button key={t.tag}
                      onMouseDown={(e) => { e.preventDefault(); onPickTag('#' + t.tag); closeSearch(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-right">
                      <span className="w-10 h-10 rounded-md bg-rust-50 text-rust-700 grid place-items-center font-display font-bold shrink-0">
                        <I.Hash size={18}/>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm">#{t.tag}</div>
                        <div className="text-xs text-slate-500">{t.posts} פוסטים</div>
                      </div>
                      <I.ChevronDown size={14} className="text-slate-400 -rotate-90"/>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Nav links — desktop */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink active={view === 'feed'}        onClick={() => onView('feed')}        icon={<I.Globe size={16}/>}        label="פיד" />
          <NavLink active={view === 'marketplace'} onClick={() => onView('marketplace')} icon={<I.ShoppingBag size={16}/>}  label="שוק" />
          <NavLink active={view === 'stores'}      onClick={() => onView('stores')}      icon={<I.Star size={16}/>}         label="ביקורות חנויות" />
        </nav>

        {/* Right-side icons */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onOpenNotifications} className="hidden sm:grid w-9 h-9 place-items-center text-slate-600 hover:bg-slate-100 rounded-full relative" title="התראות">
            <I.Bell size={18} />
            {unreadNotifications > 0 && (
              <span className="absolute top-0.5 left-0.5 min-w-[16px] h-4 px-1 bg-rust-600 text-white text-[10px] font-bold rounded-full grid place-items-center ring-2 ring-white">{unreadNotifications}</span>
            )}
          </button>
          <button onClick={() => onOpenMessages && onOpenMessages()}
            className="hidden sm:grid w-9 h-9 place-items-center text-slate-600 hover:bg-slate-100 rounded-full relative" title="הודעות">
            <I.Mail size={18} />
            {unreadMessages > 0 && (
              <span className="absolute top-0.5 left-0.5 min-w-[16px] h-4 px-1 bg-rust-600 text-white text-[10px] font-bold rounded-full grid place-items-center ring-2 ring-white">{unreadMessages}</span>
            )}
          </button>
          <UI.ProfileMenu onSign={onSign} onOpenSaved={onOpenSaved} onOpenNotifications={onOpenNotifications}
                          onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </header>
  );
}

function SearchHeader({ icon, label }) {
  return (
    <div className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100 inline-flex items-center gap-1.5 w-full">
      {icon}{label}
    </div>
  );
}

function NavLink({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={"px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition " +
                 (active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
      {icon}<span>{label}</span>
    </button>
  );
}

// ====================== COMPOSER STUB (opens modal) =========================
function Composer({ onOpenComposer }) {
  const { user } = useAuth();
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-3">
      <div className="flex items-center gap-3">
        {user ? (
          <UI.Avatar person={user} size={40} />
        ) : (
          <span className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center"><I.User size={18} className="text-slate-500" /></span>
        )}
        <button onClick={() => onOpenComposer('project')}
          className="flex-1 text-right bg-slate-50 hover:bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-500">
          {user ? `מה בנית היום, ${user.name.split(' ')[0]}?` : 'מה אתה עובד עליו?'}
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-slate-100 flex-wrap">
        <div className="flex items-center">
          <ComposerBtn onClick={() => onOpenComposer('project')}  icon={<I.Image size={16}/>}      label="תמונה"    />
          <ComposerBtn onClick={() => onOpenComposer('tutorial')} icon={<I.ListChecks size={16}/>} label="מדריך" accent />
          <ComposerBtn onClick={() => onOpenComposer('tool')}     icon={<I.Tag size={16}/>}        label="מכירת כלי" />
        </div>
        <button onClick={() => onOpenComposer('project')}
          className="bg-rust-600 hover:bg-rust-700 text-white text-sm font-bold px-4 py-1.5 rounded-full">
          פרסם
        </button>
      </div>
    </div>
  );
}

function ComposerBtn({ icon, label, accent, onClick }) {
  return (
    <button onClick={onClick}
            className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-sm font-semibold " +
                       (accent ? "text-rust-700" : "text-slate-600")}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ====================== FEED =================================================
function Feed({ onSign, onOpenComposer, onOpenProfile, onPickTag, createdPosts, tagFilter, onClearTag }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('global');
  const scope = user ? tab : 'global';

  const { items, loading, hasMore, error, loadMore, retry, remove } = usePaginated(
    (opts) => api.feed({ scope, tag: tagFilter, ...opts }),
    [scope, tagFilter, user?.username]);
  const sentinel = useInfiniteScroll(loadMore, hasMore && !loading && !error);

  // Posts you just published appear on top immediately (deduped once the server returns them)
  const ids = new Set(items.map(p => p.id));
  const fresh = tagFilter ? [] : createdPosts.filter(p => !ids.has(p.id));
  const posts = [...fresh, ...items];

  const pickTab = (t) => {
    if (t === 'following' && !user) { onSign('login'); return; }
    setTab(t);
  };
  const renderPost = (p) => (
    <PostCards.PostCard key={p.id} post={p} onOpenProfile={onOpenProfile} onPickTag={onPickTag} onDeleted={remove} />
  );

  return (
    <div className="space-y-4">
      {/* Active tag filter banner */}
      {tagFilter && (
        <div className="bg-rust-50 border border-rust-200 rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-rust-600 text-white grid place-items-center"><I.Hash size={16}/></span>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-sm truncate">סינון לפי {tagFilter}</div>
              <div className="text-[11px] text-slate-600">{loading && !items.length ? 'טוען…' : `${posts.length}${hasMore ? '+' : ''} פוסטים מתאימים`}</div>
            </div>
          </div>
          <button onClick={onClearTag} className="text-xs font-bold text-rust-700 hover:underline inline-flex items-center gap-1">
            <I.X size={12} strokeWidth={2.5}/> נקה סינון
          </button>
        </div>
      )}

      <Composer onOpenComposer={onOpenComposer} />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5" role="tablist">
        <FeedTab active={scope === 'global'}    onClick={() => pickTab('global')}    icon={<I.Globe size={15}/>} label="פיד גלובלי" />
        <FeedTab active={scope === 'following'} onClick={() => pickTab('following')} icon={<I.Users size={15}/>} label="אנשים שאני עוקב" />
      </div>

      {!loading && !error && posts.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3">
            {tagFilter ? <I.Hash size={24} className="text-slate-400"/> : <I.Users size={24} className="text-slate-400"/>}
          </div>
          {tagFilter ? (
            <>
              <div className="font-display font-bold text-slate-900">אין פוסטים עם {tagFilter}</div>
              <p className="text-sm text-slate-500 mt-1">היה הראשון לפרסם פרויקט עם תגית זו!</p>
            </>
          ) : scope === 'following' ? (
            <>
              <div className="font-display font-bold text-slate-900">הפיד שלך ריק</div>
              <p className="text-sm text-slate-500 mt-1">עקבו אחרי יוצרים (למשל מ"יוצרים מומלצים") כדי לראות כאן את הפוסטים שלהם.</p>
            </>
          ) : (
            <div className="font-display font-bold text-slate-900">עדיין אין פוסטים — פרסמו את הראשון!</div>
          )}
        </div>
      )}

      {posts.slice(0, 3).map(renderPost)}
      {/* Inline marketplace teaser as a feed unit (marketplace is still mock data) */}
      {!tagFilter && posts.length > 3 && <SECTIONS.MarketplaceTeaser onOpenProfile={onOpenProfile} />}
      {posts.slice(3).map(renderPost)}

      {loading && <Spinner label={posts.length ? 'טוען עוד פרויקטים…' : 'טוען את הפיד…'} />}
      {error && <ErrorRow message={error} onRetry={retry} />}
      {!hasMore && posts.length > 0 && (
        <div className="text-center text-xs text-slate-400 font-mono pb-6">— הגעת לסוף הפיד —</div>
      )}
      <div ref={sentinel} />
    </div>
  );
}

function FeedTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} role="tab" aria-selected={active}
      className={"flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition " +
                 (active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
      {icon}<span>{label}</span>
    </button>
  );
}

// ====================== AUTH MODAL ==========================================
function AuthModal({ initialMode = 'signup', onClose }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [fields, setFields] = useState({ name: '', username: '', email: '', login: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setFields(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') {
        await signup({ name: fields.name, username: fields.username, email: fields.email, password: fields.password });
      } else {
        await login(fields.login, fields.password);
      }
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const switchMode = () => { setMode(m => m === 'signup' ? 'login' : 'signup'); setError(''); };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-pop w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Hammer size={18} strokeWidth={2.5} /></span>
            <span className="font-display font-bold text-lg text-slate-900">HandyHub</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="סגור"><I.X size={18} /></button>
        </div>
        <h2 className="font-display font-bold text-3xl text-slate-900 mt-3">
          {mode === 'signup' ? 'בואו נבנה דברים' : 'טוב שחזרת'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'signup' ? 'תשתפו פרויקטים, תמצאו כלים, ותלמדו מיוצרים אחרים.' : 'התחברו עם האימייל או שם המשתמש.'}
        </p>
        <div className="space-y-2 mt-5">
          {mode === 'signup' ? (
            <>
              <Field label="שם מלא" placeholder="דניאל בן-דוד" value={fields.name} onChange={set('name')} required maxLength={80} autoComplete="name" />
              <Field label="שם משתמש" placeholder="daniel_p" value={fields.username} onChange={set('username')} required dir="ltr"
                     pattern="[A-Za-z0-9_.]{3,30}" title="3–30 תווים: אותיות באנגלית, ספרות, _ או ." autoComplete="username" />
              <Field label="אימייל" placeholder="you@workshop.co.il" type="email" value={fields.email} onChange={set('email')} required dir="ltr" autoComplete="email" />
            </>
          ) : (
            <Field label="אימייל או שם משתמש" placeholder="you@workshop.co.il" value={fields.login} onChange={set('login')} required dir="ltr" autoComplete="username" />
          )}
          <Field label="סיסמה" placeholder="••••••••" type="password" value={fields.password} onChange={set('password')} required
                 minLength={mode === 'signup' ? 8 : undefined} dir="ltr" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          {mode === 'signup' && <p className="text-[11px] text-slate-500">לפחות 8 תווים.</p>}
        </div>
        {error && <div role="alert" className="mt-4 rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}
        <button type="submit" disabled={busy}
          className="w-full mt-5 bg-rust-600 hover:bg-rust-700 disabled:opacity-60 text-white font-bold rounded-lg py-2.5">
          {busy ? 'רגע…' : mode === 'signup' ? 'הרשמה' : 'התחברות'}
        </button>
        <div className="text-center text-sm text-slate-500 mt-3">
          {mode === 'signup' ? 'כבר יש לך חשבון? ' : 'חדש כאן? '}
          <button type="button" onClick={switchMode} className="text-rust-700 font-semibold hover:underline">
            {mode === 'signup' ? 'להתחברות' : 'להרשמה'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm" />
    </label>
  );
}

// ====================== MOBILE DRAWER =======================================
function MobileDrawer({ open, onClose, view, onView, onOpenMessages, onOpenNotifications, onOpenSaved }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
      <aside className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-pop p-4 animate-in-rtl-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Hammer size={18} strokeWidth={2.5} /></span>
            <span className="font-display font-bold text-lg text-slate-900">HandyHub</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><I.X size={18} /></button>
        </div>
        <nav className="space-y-1">
          <DrawerLink active={view === 'feed'}        onClick={() => { onView('feed'); onClose(); }}        icon={<I.Globe size={18}/>}       label="פיד" />
          <DrawerLink active={view === 'marketplace'} onClick={() => { onView('marketplace'); onClose(); }} icon={<I.ShoppingBag size={18}/>} label="שוק" />
          <DrawerLink active={view === 'stores'}      onClick={() => { onView('stores'); onClose(); }}      icon={<I.Star size={18}/>}        label="ביקורות חנויות" />
          <div className="my-2 border-t border-slate-100"></div>
          <DrawerLink icon={<I.Bell size={18}/>}  onClick={onOpenNotifications} label="התראות" />
          <DrawerLink onClick={onOpenMessages} icon={<I.Mail size={18}/>}  label="הודעות" />
          <DrawerLink onClick={onOpenSaved} icon={<I.Bookmark size={18}/>} label="שמורים" />
        </nav>
      </aside>
    </div>
  );
}

function DrawerLink({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition " +
                 (active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50")}>
      <span className={active ? "text-rust-400" : "text-slate-500"}>{icon}</span>{label}
    </button>
  );
}

// ====================== APP =================================================
export function App() {
  const { user, ready } = useAuth();
  const [route, navigate] = useHashRoute();
  const { view, param } = route;
  const [authMode, setAuthMode] = useState(null);      // null | 'login' | 'signup'
  const [mobileMenu, setMobileMenu] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState('project');
  const [createdPosts, setCreatedPosts] = useState([]);  // published this session
  const [, forceMarket] = useState(0);
  const unreadMessages = user ? HUB_DATA.CONVERSATIONS.reduce((n, c) => n + c.unread, 0) : 0;
  const unreadNotifications = user ? HUB_DATA.NOTIFICATIONS.filter(n => !n.read).length : 0;

  // New session → forget posts created by a previous user
  useEffect(() => { setCreatedPosts([]); }, [user?.username]);

  const handleOpenProfile = (username) => navigate('profile', username);
  const handlePickTag = (tag) => navigate('feed', tag);
  const handleSign = (mode = 'login') => setAuthMode(mode);
  const requireAuth = (fn) => (...args) => { if (!user) { setAuthMode('login'); return; } fn(...args); };

  const handleOpenMessages = requireAuth((personId) => { setDmTarget(personId || null); setMessagesOpen(true); });
  const handleOpenComposer = requireAuth((mode = 'project') => { setComposerMode(mode); setComposerOpen(true); });

  const handleCreated = (post) => {
    setCreatedPosts(arr => [post, ...arr]);
    if (view !== 'feed' && !(view === 'profile' && param === user.username)) navigate('feed');
  };

  // Marketplace listings are still local mock data (design behaviour kept as-is)
  const handlePublishTool = (post) => {
    const seller = { id: user.username, name: user.name, handle: user.handle, verified: user.verified };
    const base = {
      id: 'u' + Date.now(), name: post.name, listingType: post.listingType || 'sale', cond: post.cond, seller, dist: '0 קמ',
      bg: ['ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night'][Math.floor(Math.random() * 6)],
    };
    HUB_DATA.MARKET.unshift(post.listingType === 'lend'
      ? { ...base, dailyPrice: post.dailyPrice, weeklyPrice: post.weeklyPrice, deposit: post.deposit }
      : { ...base, price: post.price });
    forceMarket(n => n + 1);
    navigate('marketplace');
  };

  return (
    <div className="min-h-screen">
      <Navbar
        view={view} onView={(v) => navigate(v)}
        onSign={handleSign}
        onMobileMenu={() => setMobileMenu(true)}
        onOpenMessages={handleOpenMessages}
        onOpenNotifications={requireAuth(() => setNotifsOpen(true))}
        onOpenSaved={requireAuth(() => setSavedOpen(true))}
        onOpenProfile={handleOpenProfile}
        onOpenSettings={() => setSettingsOpen(true)}
        onPickTag={handlePickTag}
        unreadMessages={messagesOpen ? 0 : unreadMessages}
        unreadNotifications={notifsOpen ? 0 : unreadNotifications} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="min-w-0">
            {!ready ? <Spinner /> : <>
              {view === 'feed'        && <Feed onSign={handleSign} onOpenComposer={handleOpenComposer} onOpenProfile={handleOpenProfile}
                                               onPickTag={handlePickTag} createdPosts={createdPosts}
                                               tagFilter={param} onClearTag={() => navigate('feed')} />}
              {view === 'marketplace' && <SECTIONS.Marketplace onOpenProfile={handleOpenProfile} authed={!!user} onSign={() => handleSign('login')} onOpenComposer={handleOpenComposer} />}
              {view === 'stores'      && <SECTIONS.StoreReviews onOpenStore={(id) => navigate('store', id)} />}
              {view === 'store'       && <SECTIONS.Store storeId={param} onOpenProfile={handleOpenProfile} onView={(v) => navigate(v)} />}
              {view === 'profile'     && <Profile key={param} username={param} onOpenProfile={handleOpenProfile} onSign={handleSign}
                                                  onOpenMessages={handleOpenMessages} onView={(v) => navigate(v)} onPickTag={handlePickTag}
                                                  createdPosts={createdPosts} />}
            </>}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <SECTIONS.Sidebar onOpenProfile={handleOpenProfile} onPickTag={handlePickTag} onSign={handleSign}
                                refreshKey={createdPosts.length} />
            </div>
          </div>
        </div>
      </main>

      <PostComposer open={composerOpen} mode={composerMode} onClose={() => setComposerOpen(false)}
                    onPublish={handlePublishTool} onCreated={handleCreated} />
      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
      {settingsOpen && user && <EditProfileModal onClose={() => setSettingsOpen(false)} />}
      <MobileDrawer open={mobileMenu} onClose={() => setMobileMenu(false)} view={view} onView={(v) => navigate(v)}
        onOpenMessages={() => { handleOpenMessages(); setMobileMenu(false); }}
        onOpenNotifications={() => { requireAuth(() => setNotifsOpen(true))(); setMobileMenu(false); }}
        onOpenSaved={() => { requireAuth(() => setSavedOpen(true))(); setMobileMenu(false); }} />
      <MessagesPanel open={messagesOpen} onClose={() => { setMessagesOpen(false); setDmTarget(null); }} initialPersonId={dmTarget} />
      <NotificationsPanel open={notifsOpen} onClose={() => setNotifsOpen(false)} />
      <SavedPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
    </div>
  );
}
