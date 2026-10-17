// HandyHub main app — Navbar, Feed view, Composer, view router
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { I } from './icons.jsx';
import { UI } from './ui.jsx';
import { PostCards } from './posts.jsx';
import { SECTIONS } from './sections.jsx';
import { PostComposer } from './composer.jsx';
import { MessagesPanel } from './messages.jsx';
import { NotificationsPanel, SavedPanel } from './panels.jsx';
import { Profile, EditProfileModal } from './profile.jsx';
import { Spinner, ErrorRow } from './social.jsx';
import { AdminDashboard } from './admin.jsx';
import { ResetPassword } from './reset.jsx';
import { SecurityModal } from './security.jsx';
import { ReportHost } from './report.jsx';
import { Toaster, toast } from '../lib/toast.jsx';
import { inquiryText } from './market.jsx';

const MESSAGE_POLL_MS = 10000;
import { api } from '../lib/api.js';
import { useAuth, NEED_LOGIN_EVENT } from '../lib/auth.jsx';
import { MESSAGE_EVENT, SHARE_EVENT } from '../lib/intents.js';
import { useDebounced, useInfiniteScroll, usePaginated } from '../lib/hooks.js';

// ====================== ROUTING (hash based) =================================
//   #/              feed           #/tag/<tag>     feed filtered by hashtag
//   #/u/<username>  profile        #/market  #/stores  #/store/<id>   #/admin (staff)
//   #/post/<id>     a single post with its comments (from notifications / saved items)
// location.hash → { view, param }: which page to show.
function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (parts[0]) {
    case 'u':      return { view: 'profile', param: parts[1] };
    case 'tag':    return { view: 'feed', param: parts[1] ? '#' + parts[1] : null };
    case 'market': return { view: 'marketplace' };
    case 'stores': return { view: 'stores' };
    case 'store':  return { view: 'store', param: parts[1] };
    case 'post':   return { view: 'post', param: parts[1] };
    case 'admin':  return { view: 'admin' };
    case 'reset':  return { view: 'reset', param: parts[1] };
    default:       return { view: 'feed', param: null };
  }
}

// { view, param } → its #/… address (the reverse of parseHash).
function hashFor(view, param) {
  const enc = encodeURIComponent;
  if (view === 'profile') return `#/u/${enc(param)}`;
  if (view === 'feed' && param) return `#/tag/${enc(param.replace(/^#/, ''))}`;
  if (view === 'marketplace') return '#/market';
  if (view === 'stores') return '#/stores';
  if (view === 'store') return `#/store/${enc(param)}`;
  if (view === 'post') return `#/post/${enc(param)}`;
  if (view === 'admin') return '#/admin';
  if (view === 'reset') return `#/reset/${enc(param)}`;
  return '#/';
}

// The current route + navigate(view, param), kept in sync with the address bar.
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
// Sticky top bar: logo, live search (people / posts / tags), page links, messages, notifications, profile menu.
function Navbar({ view, onView, onSign, onMobileMenu, onOpenMessages, onOpenNotifications, onOpenSaved, onOpenProfile, onOpenSettings, onOpenSecurity, onPickTag, unreadMessages, unreadNotifications }) {
  const { user } = useAuth();
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
        <button onClick={onMobileMenu} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg relative" aria-label="תפריט">
          <I.Menu size={20} />
          {/* the bell / mail icons are hidden on phones → a dot says something new is waiting in the menu */}
          {(unreadMessages > 0 || unreadNotifications > 0) && (
            <span className="sm:hidden absolute top-1 left-1 w-2.5 h-2.5 bg-rust-600 rounded-full ring-2 ring-white" aria-label="יש עדכונים חדשים"></span>
          )}
        </button>

        {/* Logo */}
        <a href="#/" onClick={(e) => { e.preventDefault(); onView('feed'); }} className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center">
            <I.Hammer size={20} strokeWidth={2.5} />
          </span>
          <span className="font-display font-bold text-xl text-slate-900 hidden sm:inline">HandyHub</span>
        </a>

        {/* Search */}
        <div className="flex-1 min-w-0 max-w-lg relative">
          <div className={"flex items-center gap-2 bg-slate-100 rounded-full pl-3.5 pr-2 h-10 transition " +
                          (focused ? "ring-2 ring-rust-500/30 bg-white border border-slate-200" : "border border-transparent")}>
            <I.Search size={16} className="text-slate-500 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocused(true); }}
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
          {user?.isStaff && (
            <button onClick={() => onView('admin')} title="לוח ניהול" aria-label="לוח ניהול"
              className={"hidden sm:grid w-9 h-9 place-items-center rounded-full " +
                         (view === 'admin' ? "bg-slate-900 text-rust-300" : "text-slate-600 hover:bg-slate-100")}>
              <I.Shield size={18} />
            </button>
          )}
          <UI.ProfileMenu onSign={onSign} onOpenSaved={onOpenSaved} onOpenNotifications={onOpenNotifications}
                          onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} onOpenSecurity={onOpenSecurity}
                          onOpenAdmin={() => onView('admin')} />
        </div>
      </div>
    </header>
  );
}

// A section title in the search results dropdown.
function SearchHeader({ icon, label }) {
  return (
    <div className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100 inline-flex items-center gap-1.5 w-full">
      {icon}{label}
    </div>
  );
}

// A navbar page button (feed / market / stores …), dark when active.
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
// The "what did you build today?" box on top of the feed; opens the post composer.
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

// A shortcut button in that box (photo / tutorial / sell a tool).
function ComposerBtn({ icon, label, accent, onClick }) {
  return (
    <button onClick={onClick}
            className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-sm font-semibold " +
                       (accent ? "text-rust-700" : "text-slate-600")}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ====================== SINGLE POST ==========================================
// The #/post/<id> page: one post with its comments open.
function SinglePost({ postId, onOpenProfile, onPickTag, onView }) {
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    api.post(postId).then(setPost).catch(e => setError(e.message));
  }, [postId]);
  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <button onClick={() => onView('feed')} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-rust-700">
        <I.ArrowRight size={16} /> חזרה לפיד
      </button>
      {error && <ErrorRow message={error} onRetry={load} />}
      {!post && !error && <Spinner />}
      {post && <PostCards.PostCard post={post} openComments onOpenProfile={onOpenProfile} onPickTag={onPickTag}
                                   onDeleted={() => onView('feed')} />}
    </div>
  );
}

// ====================== FEED =================================================
// The home feed: global / following tabs, hashtag filter, infinite scroll and the marketplace teaser.
function Feed({ onSign, onOpenComposer, onOpenProfile, onPickTag, createdPosts, tagFilter, onClearTag, onContact, onView }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('global');
  const scope = user ? tab : 'global';

  const { items, loading, hasMore, error, loadMore, retry, remove } = usePaginated(
    (opts) => api.feed({ scope, tag: tagFilter, ...opts }),
    [scope, tagFilter, user?.username]);
  const sentinel = useInfiniteScroll(loadMore, hasMore && !loading && !error, items.length);

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
      {!tagFilter && posts.length > 3 && <SECTIONS.MarketplaceTeaser onOpenProfile={onOpenProfile} onContact={onContact} onView={onView} />}
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

// A feed tab button (global / following).
function FeedTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} role="tab" aria-selected={active}
      className={"flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition " +
                 (active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
      {icon}<span>{label}</span>
    </button>
  );
}

const OAUTH_ERRORS = {
  not_configured: 'התחברות עם Google עדיין לא הוגדרה בשרת (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
  cancelled: 'ההתחברות עם Google בוטלה.',
  banned: 'החשבון נחסם על ידי צוות הניהול.',
  failed: 'ההתחברות עם Google נכשלה — נסו שוב.',
};

// ====================== AUTH MODAL ==========================================
// The login / signup / forgot-password / 2FA-code dialog (+ Login with Google).
function AuthModal({ initialMode = 'signup', initialChallenge = null, initialError = '', onClose }) {
  const { login, loginWithCode, signup } = useAuth();
  const [mode, setMode] = useState(initialChallenge ? 'twofa' : initialMode);      // signup | login | forgot | twofa
  const [fields, setFields] = useState({ name: '', username: '', email: '', login: '', password: '', code: '' });
  const [challenge, setChallenge] = useState(initialChallenge);   // 2FA: step 1 passed, waiting for the code
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [sentMessage, setSentMessage] = useState('');   // forgot-password confirmation
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
      if (mode === 'forgot') {
        const r = await api.forgotPassword(fields.email);
        setSentMessage(r.message);
        setBusy(false);
        return;
      }
      if (mode === 'twofa') {
        const r = await loginWithCode(challenge, fields.code);
        if (r.recoveryCodesLeft !== undefined) {
          toast(`התחברת עם קוד גיבוי — נותרו ${r.recoveryCodesLeft}. אפשר ליצור חדשים ב"אבטחת חשבון".`);
        }
      } else if (mode === 'signup') {
        await signup({ name: fields.name, username: fields.username, email: fields.email, password: fields.password });
      } else {
        const r = await login(fields.login, fields.password);
        if (r.challenge) {        // right password, the account has 2FA → ask for the code
          setChallenge(r.challenge);
          setFields(f => ({ ...f, code: '' }));
          setUseBackup(false);
          setMode('twofa');
          setBusy(false);
          return;
        }
      }
      onClose();
    } catch (err) {
      // the challenge expired / too many wrong codes → start over from the password
      if (mode === 'twofa' && (err.status === 429 || /^(פג תוקף|יותר מדי)/.test(err.message))) {
        setChallenge(null);
        setMode('login');
      }
      setError(err.message);
      setBusy(false);
    }
  };

  const goTo = (m) => { setMode(m); setError(''); setSentMessage(''); };
  const switchMode = () => goTo(mode === 'signup' ? 'login' : 'signup');
  const TITLES = {
    signup: ['בואו נבנה דברים', 'תשתפו פרויקטים, תמצאו כלים, ותלמדו מיוצרים אחרים.'],
    login:  ['טוב שחזרת', 'התחברו עם האימייל או שם המשתמש.'],
    forgot: ['שכחתם סיסמה?', 'הזינו את האימייל של החשבון ונשלח אליו קישור לבחירת סיסמה חדשה.'],
    twofa:  ['אימות דו-שלבי', 'פתחו את אפליקציית האימות בטלפון והזינו את הקוד בן 6 הספרות.'],
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-pop w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Hammer size={18} strokeWidth={2.5} /></span>
            <span className="font-display font-bold text-lg text-slate-900">HandyHub</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="סגור"><I.X size={18} /></button>
        </div>
        <h2 className="font-display font-bold text-3xl text-slate-900 mt-3">{TITLES[mode][0]}</h2>
        <p className="text-sm text-slate-500 mt-1">{TITLES[mode][1]}</p>
        {mode === 'twofa' ? (
          <div className="space-y-2 mt-5">
            {useBackup ? (
              <Field key="backup" label="קוד גיבוי" placeholder="a1b2-c3d4-e5f6" value={fields.code} onChange={set('code')}
                     required dir="ltr" autoComplete="off" autoFocus />
            ) : (
              <Field key="totp" label="קוד אימות" placeholder="123456" value={fields.code} onChange={set('code')}
                     required dir="ltr" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7}
                     autoComplete="one-time-code" autoFocus className="tracking-[0.4em] text-center text-lg font-mono" />
            )}
            <button type="button" onClick={() => { setUseBackup(b => !b); setFields(f => ({ ...f, code: '' })); setError(''); }}
              className="text-xs font-semibold text-rust-700 hover:underline">
              {useBackup ? 'שימוש בקוד מהאפליקציה' : 'אין לי גישה לטלפון — שימוש בקוד גיבוי'}
            </button>
          </div>
        ) : mode === 'forgot' ? (
          <div className="space-y-2 mt-5">
            {sentMessage ? (
              <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-3 py-3 flex gap-2">
                <I.Mail size={18} className="shrink-0 mt-0.5"/> <span>{sentMessage}</span>
              </div>
            ) : (
              <Field label="אימייל" placeholder="you@workshop.co.il" type="email" value={fields.email} onChange={set('email')}
                     required dir="ltr" autoComplete="email" autoFocus />
            )}
          </div>
        ) : (
        <>
          <a href="/api/auth/google"
             className="w-full mt-5 flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg py-2.5 text-sm font-bold text-slate-700 transition shadow-sm">
            <I.Google size={18} />
            <span>המשך עם Google</span>
          </a>
          <div className="flex items-center gap-3 my-4 text-xs text-slate-400">
            <div className="h-px bg-slate-200 flex-1" />
            <span>או עם אימייל</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>
          <div className="space-y-2">
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
            {mode === 'login' && (
              <button type="button" onClick={() => goTo('forgot')} className="text-xs font-semibold text-rust-700 hover:underline">
                שכחתי סיסמה
              </button>
            )}
          </div>
        </>
        )}
        {error && <div role="alert" className="mt-4 rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}
        {!(mode === 'forgot' && sentMessage) && (
          <button type="submit" disabled={busy}
            className="w-full mt-5 bg-rust-600 hover:bg-rust-700 disabled:opacity-60 text-white font-bold rounded-lg py-2.5">
            {busy ? 'רגע…' : { signup: 'הרשמה', login: 'התחברות', forgot: 'שלחו לי קישור', twofa: 'אימות והתחברות' }[mode]}
          </button>
        )}
        {mode === 'forgot' || mode === 'twofa' ? (
          <div className="text-center text-sm text-slate-500 mt-3">
            <button type="button" onClick={() => goTo('login')} className="text-rust-700 font-semibold hover:underline">חזרה להתחברות</button>
          </div>
        ) : (
        <div className="text-center text-sm text-slate-500 mt-3">
          {mode === 'signup' ? 'כבר יש לך חשבון? ' : 'חדש כאן? '}
          <button type="button" onClick={switchMode} className="text-rust-700 font-semibold hover:underline">
            {mode === 'signup' ? 'להתחברות' : 'להרשמה'}
          </button>
        </div>
        )}
      </form>
      </div>
    </div>
  );
}

// A labeled text input for the auth forms.
function Field({ label, className = '', ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
      <input {...rest} className={"mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm " + className} />
    </label>
  );
}

// ====================== MOBILE DRAWER =======================================
// The phone / tablet side menu: page links, notifications, messages, saved and the sidebar boxes.
function MobileDrawer({ open, onClose, view, onView, onOpenMessages, onOpenNotifications, onOpenSaved,
                       onOpenProfile, onPickTag, onSign, unreadMessages, unreadNotifications }) {
  const { user } = useAuth();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
      <aside className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-pop p-4 overflow-y-auto overscroll-contain animate-in-rtl-drawer"
             onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Hammer size={18} strokeWidth={2.5} /></span>
            <span className="font-display font-bold text-lg text-slate-900">HandyHub</span>
          </div>
          <button onClick={onClose} aria-label="סגור תפריט" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><I.X size={18} /></button>
        </div>
        <nav className="space-y-1">
          <DrawerLink active={view === 'feed'}        onClick={() => { onView('feed'); onClose(); }}        icon={<I.Globe size={18}/>}       label="פיד" />
          <DrawerLink active={view === 'marketplace'} onClick={() => { onView('marketplace'); onClose(); }} icon={<I.ShoppingBag size={18}/>} label="שוק" />
          <DrawerLink active={view === 'stores'}      onClick={() => { onView('stores'); onClose(); }}      icon={<I.Star size={18}/>}        label="ביקורות חנויות" />
          <div className="my-2 border-t border-slate-100"></div>
          <DrawerLink icon={<I.Bell size={18}/>}  onClick={onOpenNotifications} label="התראות" badge={unreadNotifications} />
          <DrawerLink onClick={onOpenMessages} icon={<I.Mail size={18}/>}  label="הודעות" badge={unreadMessages} />
          <DrawerLink onClick={onOpenSaved} icon={<I.Bookmark size={18}/>} label="שמורים" />
          {user?.isStaff && (
            <DrawerLink active={view === 'admin'} onClick={() => { onView('admin'); onClose(); }} icon={<I.Shield size={18}/>} label="לוח ניהול" />
          )}
        </nav>
        {/* On wide screens these live in the side column; on phones / tablets, here */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <SECTIONS.Sidebar onOpenProfile={(u) => { onOpenProfile(u); onClose(); }}
                            onPickTag={(t) => { onPickTag(t); onClose(); }} onSign={(m) => { onSign(m); onClose(); }} />
        </div>
      </aside>
    </div>
  );
}

// A row in the mobile menu (with an optional unread badge).
function DrawerLink({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick}
      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition " +
                 (active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50")}>
      <span className={active ? "text-rust-400" : "text-slate-500"}>{icon}</span>
      <span className="flex-1 text-right">{label}</span>
      {badge > 0 && <span className="min-w-[20px] h-5 px-1.5 bg-rust-600 text-white text-[11px] font-bold rounded-full grid place-items-center">{badge}</span>}
    </button>
  );
}

// ====================== APP =================================================
// The root component: routing, navbar, the current page and every modal / side panel.
export function App() {
  const { user, ready } = useAuth();
  const [route, navigate] = useHashRoute();
  const { view, param } = route;
  const [authMode, setAuthMode] = useState(null);      // null | 'login' | 'signup' | 'twofa'
  const [oauthState, setOauthState] = useState({ challenge: null, error: '' });
  const [mobileMenu, setMobileMenu] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);       // { username, draft?, listing? } to open a chat with
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [listingsVersion, setListingsVersion] = useState(0);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState('project');
  const [sharing, setSharing] = useState(null);           // post being shared in the composer
  const [createdPosts, setCreatedPosts] = useState([]);  // published this session

  // Google OAuth callback lands with ?twofa=<challenge> or ?oauth_error=<code>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('oauth_error');
    const twofa = params.get('twofa');
    if (err || twofa) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      setOauthState({ challenge: twofa || null, error: err ? (OAUTH_ERRORS[err] || OAUTH_ERRORS.failed) : '' });
      setAuthMode(twofa ? 'twofa' : 'login');
    }
  }, []);

  // Buttons deep inside posts (♥, comment) ask for the login dialog via an event
  useEffect(() => {
    const open = () => setAuthMode('login');
    window.addEventListener(NEED_LOGIN_EVENT, open);
    return () => window.removeEventListener(NEED_LOGIN_EVENT, open);
  }, []);

  // Arriving at a reset link closes any auth dialog that was left open
  useEffect(() => { if (view === 'reset') setAuthMode(null); }, [view, param]);

  // "New message" alerts without a refresh: poll the unread count while logged in
  const lastAlerted = useRef(null);
  useEffect(() => {
    if (!user) { setUnreadMessages(0); setUnreadNotifications(0); lastAlerted.current = null; return undefined; }
    let alive = true;
    const check = () => api.unreadMessages().then(r => {
      if (!alive) return;
      setUnreadMessages(r.count);
      const latest = r.latest;
      if (latest && lastAlerted.current !== null && latest.id > lastAlerted.current && !messagesOpenRef.current) {
        toast(`💬 הודעה חדשה מ${latest.from.name}`);
      }
      if (latest) lastAlerted.current = Math.max(lastAlerted.current ?? 0, latest.id);
      else if (lastAlerted.current === null) lastAlerted.current = 0;
    }).catch(() => {});
    const checkNotifications = () => api.unreadNotifications()
      .then(n => { if (alive) setUnreadNotifications(n); }).catch(() => {});
    check();
    checkNotifications();
    const timer = setInterval(() => { check(); checkNotifications(); }, MESSAGE_POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [user]);
  const messagesOpenRef = useRef(false);
  messagesOpenRef.current = messagesOpen;

  // New session → forget posts created by a previous user
  useEffect(() => { setCreatedPosts([]); }, [user?.username]);

  const handleOpenProfile = (username) => navigate('profile', username);
  const handlePickTag = (tag) => navigate('feed', tag);
  const handleSign = (mode = 'login') => setAuthMode(mode);
  const requireAuth = (fn) => (...args) => { if (!user) { setAuthMode('login'); return; } fn(...args); };

  const handleOpenMessages = requireAuth((username, draft, listing) => {
    setDmTarget(username ? { username, draft, listing } : null);
    setMessagesOpen(true);
  });
  // "Buy" / "Lend" on a listing → private chat with the seller, pre-filled with an inquiry
  const handleContactSeller = (listing) => handleOpenMessages(listing.seller.username, inquiryText(listing), listing);
  const handleOpenComposer = requireAuth((mode = 'project') => { setSharing(null); setComposerMode(mode); setComposerOpen(true); });

  // "Share" / "Contact the maker" buttons inside post cards (see lib/intents.js)
  const intents = useRef({});
  intents.current = {
    share: requireAuth((post) => { setSharing(post); setComposerMode('project'); setComposerOpen(true); }),
    message: (username) => handleOpenMessages(username),
  };
  useEffect(() => {
    const onShare = (e) => intents.current.share(e.detail);
    const onMessage = (e) => intents.current.message(e.detail);
    window.addEventListener(SHARE_EVENT, onShare);
    window.addEventListener(MESSAGE_EVENT, onMessage);
    return () => { window.removeEventListener(SHARE_EVENT, onShare); window.removeEventListener(MESSAGE_EVENT, onMessage); };
  }, []);

  const handleCreated = (post) => {
    setCreatedPosts(arr => [post, ...arr]);
    if (view !== 'feed' && !(view === 'profile' && param === user.username)) navigate('feed');
  };

  const handleListingCreated = () => {
    setListingsVersion(v => v + 1);
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
        onOpenSecurity={() => setSecurityOpen(true)}
        onPickTag={handlePickTag}
        unreadMessages={messagesOpen ? 0 : unreadMessages}
        unreadNotifications={unreadNotifications} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="min-w-0">
            {!ready ? <Spinner /> : <>
              {view === 'feed'        && <Feed onSign={handleSign} onOpenComposer={handleOpenComposer} onOpenProfile={handleOpenProfile}
                                               onPickTag={handlePickTag} createdPosts={createdPosts}
                                               tagFilter={param} onClearTag={() => navigate('feed')}
                                               onContact={handleContactSeller} onView={(v) => navigate(v)} />}
              {view === 'marketplace' && <SECTIONS.Marketplace onOpenProfile={handleOpenProfile} onSign={handleSign}
                                                               onOpenComposer={handleOpenComposer} onContact={handleContactSeller}
                                                               refreshKey={listingsVersion} />}
              {view === 'stores'      && <SECTIONS.StoreReviews onOpenStore={(id) => navigate('store', id)} onSign={handleSign} />}
              {view === 'store'       && <SECTIONS.Store key={param} storeId={param} onOpenProfile={handleOpenProfile}
                                                         onView={(v) => navigate(v)} onSign={handleSign} />}
              {view === 'reset'       && <ResetPassword key={param} token={param} onLogin={(m) => setAuthMode(m)}
                                                        onView={(v) => navigate(v)} />}
              {view === 'post'        && <SinglePost key={param} postId={param} onOpenProfile={handleOpenProfile}
                                                     onPickTag={handlePickTag} onView={(v) => navigate(v)} />}
              {view === 'admin'       && <AdminDashboard onOpenProfile={handleOpenProfile} onView={(v) => navigate(v)} />}
              {view === 'profile'     && <Profile key={param} username={param} onOpenProfile={handleOpenProfile} onSign={handleSign}
                                                  onOpenMessages={handleOpenMessages} onView={(v) => navigate(v)} onPickTag={handlePickTag}
                                                  createdPosts={createdPosts} />}
            </>}
          </div>
          <div className="hidden lg:block">
            {/* taller than the screen → scrolls on its own, so the bottom (hot tags) is reachable */}
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain pb-2 -mx-1 px-1 sidebar-scroll">
              <SECTIONS.Sidebar onOpenProfile={handleOpenProfile} onPickTag={handlePickTag} onSign={handleSign}
                                refreshKey={createdPosts.length} />
            </div>
          </div>
        </div>
      </main>

      <PostComposer open={composerOpen} mode={composerMode} sharedPost={sharing} onClose={() => setComposerOpen(false)}
                    onCreated={handleCreated} onListingCreated={handleListingCreated} />
      {authMode && (
        <AuthModal initialMode={authMode} initialChallenge={oauthState.challenge} initialError={oauthState.error}
                   onClose={() => { setAuthMode(null); setOauthState({ challenge: null, error: '' }); }} />
      )}
      {settingsOpen && user && <EditProfileModal onClose={() => setSettingsOpen(false)} />}
      {securityOpen && user && <SecurityModal onClose={() => setSecurityOpen(false)} />}
      <MobileDrawer open={mobileMenu} onClose={() => setMobileMenu(false)} view={view} onView={(v) => navigate(v)}
        onOpenMessages={() => { handleOpenMessages(); setMobileMenu(false); }}
        onOpenNotifications={() => { requireAuth(() => setNotifsOpen(true))(); setMobileMenu(false); }}
        onOpenSaved={() => { requireAuth(() => setSavedOpen(true))(); setMobileMenu(false); }}
        onOpenProfile={handleOpenProfile} onPickTag={handlePickTag} onSign={handleSign}
        unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
      <MessagesPanel open={messagesOpen} onClose={() => { setMessagesOpen(false); setDmTarget(null); }}
                     initial={dmTarget} onUnreadChange={setUnreadMessages} />
      <NotificationsPanel open={notifsOpen} onClose={() => setNotifsOpen(false)} onUnreadChange={setUnreadNotifications}
                          onOpenPost={(id) => navigate('post', id)} onOpenProfile={handleOpenProfile} />
      <SavedPanel open={savedOpen} onClose={() => setSavedOpen(false)}
                  onOpenPost={(id) => navigate('post', id)} onContact={handleContactSeller} />
      <ReportHost />
      <Toaster />
    </div>
  );
}
