// HandyHub main app — Navbar, Feed view, Composer, view router
const { useState: useStateA, useMemo, useEffect: useEffectA } = React;

// ====================== NAVBAR ==============================================
function Navbar({ view, onView, query, onQuery, authed, onSign, onMobileMenu, onOpenMessages, onOpenNotifications, onOpenSaved, onOpenProfile, onOpenStore, onPickTag, unreadMessages, unreadNotifications }) {
  // Build a unified result list spanning people, projects/tutorials, and tags
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { people: [], posts: [], tags: [] };
    // Allow either #tag or tag matching
    const qBare = q.replace(/^#/, '');

    const people = Object.values(HUB_DATA.PEOPLE)
      .filter(p => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q))
      .slice(0, 4);

    // Title for each kind
    const titleOf = (p) => {
      if (p.kind === 'tutorial') return p.title;
      if (p.kind === 'review')   return p.shop?.name;
      if (p.kind === 'project')  return p.overlay;
      if (p.kind === 'agent')    return p.bullets?.[0]?.name;
      return '';
    };
    const posts = HUB_DATA.POSTS
      .filter(p => {
        const t = (titleOf(p) || '').toLowerCase();
        const inTags = (p.tags || []).some(tag => tag.toLowerCase().includes(qBare));
        return t.includes(q) || inTags;
      })
      .slice(0, 4);

    // Tag set: trending + every unique tag in posts
    const tagSet = new Set();
    HUB_DATA.TRENDING.forEach(t => tagSet.add(t.tag.replace('#','')));
    HUB_DATA.POSTS.forEach(p => (p.tags || []).forEach(t => tagSet.add(t.replace('#',''))));
    const tags = [...tagSet]
      .filter(t => t.toLowerCase().includes(qBare))
      .slice(0, 5)
      .map(t => {
        const trending = HUB_DATA.TRENDING.find(x => x.tag.replace('#','') === t);
        return { tag: t, posts: trending?.posts };
      });

    return { people, posts, tags };
  }, [query]);
  const [focused, setFocused] = useStateA(false);
  const hasAny = searchResults.people.length + searchResults.posts.length + searchResults.tags.length > 0;
  const closeSearch = () => { onQuery(''); setFocused(false); };

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        {/* Mobile menu */}
        <button onClick={onMobileMenu} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <I.Menu size={20} />
        </button>

        {/* Logo */}
        <a href="#" onClick={(e) => { e.preventDefault(); onView('feed'); }} className="flex items-center gap-2 shrink-0">
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
              type="text"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="חפש פרויקטים, יוצרים, תגיות…"
              className="bg-transparent outline-none flex-1 text-sm text-slate-800 placeholder:text-slate-500" />
            {query && (
              <button onClick={() => onQuery('')} className="p-1 text-slate-400 hover:text-slate-700"><I.X size={14} /></button>
            )}
          </div>
          {focused && query.trim() && (
            <div className="absolute left-0 right-0 top-12 bg-white rounded-xl shadow-pop border border-slate-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
              {!hasAny && (
                <div className="px-4 py-6 text-sm text-slate-500 text-center">
                  לא נמצאו תוצאות ל-"{query}"
                </div>
              )}

              {/* People */}
              {searchResults.people.length > 0 && (
                <>
                  <SearchHeader icon={<I.Users size={11}/>} label="יוצרים" />
                  {searchResults.people.map(p => (
                    <button key={p.id}
                      onMouseDown={(e) => { e.preventDefault(); onOpenProfile && onOpenProfile(p.id); closeSearch(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-right">
                      <UI.Avatar person={p} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                          {p.agent && <UI.AgentBadge />}
                          {p.verified && <I.Verified size={13} className="text-rust-600"/>}
                        </div>
                        <div className="text-xs text-slate-500">{p.handle} · {p.followers} עוקבים</div>
                      </div>
                      <I.ChevronDown size={14} className="text-slate-400 -rotate-90"/>
                    </button>
                  ))}
                </>
              )}

              {/* Projects */}
              {searchResults.posts.length > 0 && (
                <>
                  <SearchHeader icon={<I.Image size={11}/>} label="פרויקטים ומדריכים" />
                  {searchResults.posts.map(p => {
                    const title = p.kind === 'tutorial' ? p.title
                                : p.kind === 'review' ? `ביקורת על ${p.shop?.name}`
                                : p.kind === 'agent'  ? p.bullets?.[0]?.name
                                : p.overlay;
                    const kindLabel = p.kind === 'tutorial' ? 'מדריך'
                                    : p.kind === 'review'   ? 'ביקורת'
                                    : p.kind === 'agent'    ? 'התראה'
                                    : 'פרויקט';
                    const thumbBg = p.bg || p.steps?.[0]?.thumb || 'ph-night';
                    return (
                      <button key={p.id}
                        onMouseDown={(e) => { e.preventDefault(); onOpenProfile && p.author && onOpenProfile(p.author.id); closeSearch(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-right">
                        <div className={"w-10 h-10 rounded-md shrink-0 " + thumbBg}></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm line-clamp-1">{title || 'ללא כותרת'}</span>
                            <span className="pill bg-slate-100 text-slate-600 text-[10px]">{kindLabel}</span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">מאת {p.author?.name}</div>
                        </div>
                        <I.ChevronDown size={14} className="text-slate-400 -rotate-90"/>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Tags */}
              {searchResults.tags.length > 0 && (
                <>
                  <SearchHeader icon={<I.Hash size={11}/>} label="האשטגים" />
                  {searchResults.tags.map(t => (
                    <button key={t.tag}
                      onMouseDown={(e) => { e.preventDefault(); onPickTag && onPickTag('#' + t.tag); closeSearch(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-right">
                      <span className="w-10 h-10 rounded-md bg-rust-50 text-rust-700 grid place-items-center font-display font-bold shrink-0">
                        <I.Hash size={18}/>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm">#{t.tag}</div>
                        <div className="text-xs text-slate-500">{t.posts ? `${t.posts} פוסטים` : 'תייגו פוסט עם תגית זו'}</div>
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
          <UI.ProfileMenu authed={authed} onSign={onSign} onOpenSaved={onOpenSaved} onOpenNotifications={onOpenNotifications} onOpenProfile={onOpenProfile} />
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
function Composer({ authed, onSign, onOpenComposer }) {
  const open = (mode = 'project') => {
    if (!authed) { onSign(true); return; }
    onOpenComposer(mode);
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-3">
      <div className="flex items-center gap-3">
        {authed ? (
          <img src={HUB_DATA.avatarDataURI('you')} className="w-10 h-10 rounded-full" alt="" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center"><I.User size={18} className="text-slate-500" /></span>
        )}
        <button onClick={() => open('project')}
          className="flex-1 text-right bg-slate-50 hover:bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-500">
          {authed ? 'מה בנית היום, דניאל?' : 'מה אתה עובד עליו?'}
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-slate-100 flex-wrap">
        <div className="flex items-center">
          <ComposerBtn onClick={() => open('project')}  icon={<I.Image size={16}/>}      label="תמונה"    />
          <ComposerBtn onClick={() => open('project')}  icon={<I.Video size={16}/>}      label="וידאו"    />
          <ComposerBtn onClick={() => open('tutorial')} icon={<I.ListChecks size={16}/>} label="מדריך" accent />
          <ComposerBtn onClick={() => open('tool')}     icon={<I.Tag size={16}/>}        label="מכירת כלי" />
        </div>
        <button onClick={() => open('project')}
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
function Feed({ authed, onSign, onOpenComposer, onOpenProfile, onOpenStore, userPosts, tagFilter, onClearTag }) {
  const [tab, setTab] = useStateA('global');
  const [loading, setLoading] = useStateA(false);
  const [extraLoaded, setExtraLoaded] = useStateA(false);

  const allPosts = [...userPosts, ...HUB_DATA.POSTS];
  let posts = tab === 'global' ? allPosts : allPosts.filter(p => p.author?.id === 'you' || ['marcus','rosa','jules'].includes(p.author?.id));
  if (tagFilter) {
    const t = tagFilter.toLowerCase();
    posts = posts.filter(p => (p.tags || []).some(x => x.toLowerCase() === t));
  }

  const renderPost = (p) => {
    if (p.kind === 'tutorial') return <PostCards.TutorialPost key={p.id} post={p} onOpenProfile={onOpenProfile} />;
    if (p.kind === 'review')   return <PostCards.ReviewPost   key={p.id} post={p} onOpenProfile={onOpenProfile} onOpenStore={onOpenStore} />;
    if (p.kind === 'agent')    return <PostCards.AgentPost    key={p.id} post={p} onOpenProfile={onOpenProfile} />;
    return <PostCards.ProjectPost key={p.id} post={p} onOpenProfile={onOpenProfile} />;
  };

  const loadMore = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setExtraLoaded(true); }, 900);
  };

  return (
    <div className="space-y-4">
      {/* Active tag filter banner */}
      {tagFilter && (
        <div className="bg-rust-50 border border-rust-200 rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-rust-600 text-white grid place-items-center"><I.Hash size={16}/></span>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-sm truncate">סינון לפי {tagFilter}</div>
              <div className="text-[11px] text-slate-600">{posts.length} פוסטים מתאימים</div>
            </div>
          </div>
          <button onClick={onClearTag} className="text-xs font-bold text-rust-700 hover:underline inline-flex items-center gap-1">
            <I.X size={12} strokeWidth={2.5}/> נקה סינון
          </button>
        </div>
      )}

      <Composer authed={authed} onSign={onSign} onOpenComposer={onOpenComposer} />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5">
        <FeedTab active={tab === 'global'}    onClick={() => setTab('global')}    icon={<I.Globe size={15}/>} label="פיד גלובלי" />
        <FeedTab active={tab === 'following'} onClick={() => setTab('following')} icon={<I.Users size={15}/>} label="מעקב" count={3} />
      </div>

      {posts.length === 0 && tagFilter && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3"><I.Hash size={24} className="text-slate-400"/></div>
          <div className="font-display font-bold text-slate-900">אין פוסטים עם {tagFilter}</div>
          <p className="text-sm text-slate-500 mt-1">היה הראשון לפרסם פרויקט עם תגית זו!</p>
        </div>
      )}

      {posts.map(renderPost)}

      {/* Inline marketplace teaser as a feed unit */}
      {!tagFilter && <SECTIONS.MarketplaceTeaser onOpenProfile={onOpenProfile} />}

      {extraLoaded && !tagFilter && posts.slice(0, 2).map(p => (
        <React.Fragment key={'x-' + p.id}>{renderPost({...p, id: 'x-' + p.id})}</React.Fragment>
      ))}

      {!tagFilter && (
        <div className="flex justify-center pt-2 pb-6">
          <button onClick={loadMore} disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-bold text-sm text-slate-700 shadow-card disabled:opacity-60">
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                טוען עוד פרויקטים…
              </>
            ) : (
              <>טען עוד פרויקטים <I.ChevronDown size={15} /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function FeedTab({ active, onClick, icon, label, count }) {
  return (
    <button onClick={onClick}
      className={"flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition " +
                 (active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
      {icon}<span>{label}</span>
      {count != null && (
        <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
                         (active ? "bg-rust-500 text-white" : "bg-slate-200 text-slate-600")}>{count}</span>
      )}
    </button>
  );
}

// ====================== AUTH MODAL ==========================================
function AuthModal({ onClose, onAuth }) {
  const [mode, setMode] = useStateA('signup');
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-pop w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Hammer size={18} strokeWidth={2.5} /></span>
            <span className="font-display font-bold text-lg text-slate-900">HandyHub</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><I.X size={18} /></button>
        </div>
        <h2 className="font-display font-bold text-3xl text-slate-900 mt-3">
          {mode === 'signup' ? 'בואו נבנה דברים' : 'טוב שחזרת'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'signup' ? 'תשתפו פרויקטים, תמצאו כלים, ותלמדו מיוצרים אחרים.' : 'מתגעגע להיכנס.'}
        </p>
        <div className="space-y-2 mt-5">
          {mode === 'signup' && <Field label="שם יוצר" placeholder="דניאל ב." />}
          <Field label="אימייל" placeholder="you@workshop.co.il" type="email" />
          <Field label="סיסמה" placeholder="••••••••" type="password" />
        </div>
        <button onClick={onAuth}
          className="w-full mt-5 bg-rust-600 hover:bg-rust-700 text-white font-bold rounded-lg py-2.5">
          {mode === 'signup' ? 'לכניסה!' : 'תכנס'}
        </button>
        <div className="text-center text-sm text-slate-500 mt-3">
          {mode === 'signup' ? 'כבר יש לך חשבון? ' : "חדש כאן? "}
          <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-rust-700 font-semibold hover:underline">
            {mode === 'signup' ? 'להתחברות' : 'להרשמה'}
          </button>
        </div>
      </div>
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
function App() {
  const [view, setView] = useStateA('feed');
  const [profileId, setProfileId] = useStateA(null);
  const [storeId, setStoreId] = useStateA(null);
  const [tagFilter, setTagFilter] = useStateA(null);
  const [query, setQuery] = useStateA('');
  const [authed, setAuthed] = useStateA(false);
  const [authOpen, setAuthOpen] = useStateA(false);
  const [mobileMenu, setMobileMenu] = useStateA(false);
  const [messagesOpen, setMessagesOpen] = useStateA(false);
  const [dmTarget, setDmTarget] = useStateA(null);
  const [notifsOpen, setNotifsOpen] = useStateA(false);
  const [savedOpen, setSavedOpen] = useStateA(false);
  const [composerOpen, setComposerOpen] = useStateA(false);
  const [composerMode, setComposerMode] = useStateA('project');
  const [userPosts, setUserPosts] = useStateA([]);
  const unreadMessages = HUB_DATA.CONVERSATIONS.reduce((n, c) => n + c.unread, 0);
  const unreadNotifications = HUB_DATA.NOTIFICATIONS.filter(n => !n.read).length;

  const handleOpenProfile = (id) => {
    setProfileId(id);
    setView('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenStore = (id) => {
    setStoreId(id);
    setView('store');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMessages = (personId) => {
    setDmTarget(personId || null);
    setMessagesOpen(true);
  };

  const handlePickTag = (tag) => {
    setTagFilter(tag);
    setView('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenComposer = (mode = 'project') => {
    if (!authed) { setAuthOpen(true); return; }
    setComposerMode(mode);
    setComposerOpen(true);
  };

  const handlePublish = (post) => {
    if (post.kind === 'tool') {
      const sellerMe = { id: 'you', name: 'דניאל בן-דוד', handle: '@daniel_p', verified: false };
      const base = {
        id: 'u' + Date.now(),
        name: post.name,
        listingType: post.listingType || 'sale',
        cond: post.cond,
        seller: sellerMe,
        dist: '0 קמ',
        bg: ['ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night'][Math.floor(Math.random()*6)],
      };
      if (post.listingType === 'lend') {
        HUB_DATA.MARKET.unshift({
          ...base,
          dailyPrice: post.dailyPrice,
          weeklyPrice: post.weeklyPrice,
          deposit: post.deposit,
        });
      } else {
        HUB_DATA.MARKET.unshift({ ...base, price: post.price });
      }
      setView('marketplace');
      return;
    }
    const newPost = {
      id: 'u' + Date.now(),
      author: { id: 'you', name: 'דניאל בן-דוד', handle: '@daniel_p', verified: false, agent: false },
      minutesAgo: 0,
      location: 'סדנת הבית',
      stats: { likes: 0, comments: 0, saves: 0 },
      ...post,
    };
    setUserPosts(arr => [newPost, ...arr]);
    setView('feed');
  };

  const handleSign = (open) => {
    if (authed) { setAuthed(false); }
    else { setAuthOpen(open); }
  };

  return (
    <div className="min-h-screen">
      <Navbar
        view={view} onView={setView}
        query={query} onQuery={setQuery}
        authed={authed} onSign={handleSign}
        onMobileMenu={() => setMobileMenu(true)}
        onOpenMessages={handleOpenMessages}
        onOpenNotifications={() => setNotifsOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
        onOpenProfile={handleOpenProfile}
        onOpenStore={handleOpenStore}
        onPickTag={handlePickTag}
        unreadMessages={messagesOpen ? 0 : unreadMessages}
        unreadNotifications={notifsOpen ? 0 : unreadNotifications} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="min-w-0">
            {view === 'feed'        && <Feed authed={authed} onSign={handleSign} onOpenComposer={handleOpenComposer} onOpenProfile={handleOpenProfile} onOpenStore={handleOpenStore} userPosts={userPosts} tagFilter={tagFilter} onClearTag={() => setTagFilter(null)} />}
            {view === 'marketplace' && <SECTIONS.Marketplace onOpenProfile={handleOpenProfile} authed={authed} onSign={handleSign} onOpenComposer={handleOpenComposer} />}
            {view === 'stores'      && <SECTIONS.StoreReviews onOpenStore={handleOpenStore} />}
            {view === 'store'       && <SECTIONS.Store storeId={storeId} onOpenProfile={handleOpenProfile} onView={setView} />}
            {view === 'profile'     && <SECTIONS.Profile personId={profileId} onOpenProfile={handleOpenProfile} onOpenMessages={(pid) => handleOpenMessages(pid || profileId)} onView={setView} userPosts={userPosts} />}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <SECTIONS.Sidebar onOpenProfile={handleOpenProfile} />
            </div>
          </div>
        </div>
      </main>

      <PostComposer open={composerOpen} mode={composerMode} onClose={() => setComposerOpen(false)} onPublish={handlePublish} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuth={() => { setAuthed(true); setAuthOpen(false); }} />}
      <MobileDrawer open={mobileMenu} onClose={() => setMobileMenu(false)} view={view} onView={setView}
        onOpenMessages={() => { handleOpenMessages(); setMobileMenu(false); }}
        onOpenNotifications={() => { setNotifsOpen(true); setMobileMenu(false); }}
        onOpenSaved={() => { setSavedOpen(true); setMobileMenu(false); }} />
      <MessagesPanel open={messagesOpen} onClose={() => { setMessagesOpen(false); setDmTarget(null); }} initialPersonId={dmTarget} />
      <NotificationsPanel open={notifsOpen} onClose={() => setNotifsOpen(false)} />
      <SavedPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
