// Post card variants for HandyHub feed — editorial / workshop refresh
const { useState: useStateP } = React;

// --- Shared post chrome ------------------------------------------------------
function PostHeader({ author, minutesAgo, location, kind, onOpenProfile }) {
  const openProfile = () => onOpenProfile && onOpenProfile(author.id);
  return (
    <div className="flex items-start justify-between gap-3 p-4 pb-3">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={openProfile} className="shrink-0 rounded-full hover:ring-2 hover:ring-rust-500/30 transition" title={`לפרופיל של ${author.name}`}>
          <UI.Avatar person={author} size={44} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={openProfile} className="font-bold text-slate-900 truncate hover:text-rust-700">{author.name}</button>
            {author.agent && <UI.AgentBadge />}
            {kind === 'tutorial' && (
              <span className="pill bg-rust-50 text-rust-700"><I.ListChecks size={11} strokeWidth={2.5} /> מדריך</span>
            )}
            {kind === 'review' && (
              <span className="pill bg-dijon-300/40 text-slate-800"><I.Star size={11} strokeWidth={2.5} /> ביקורת</span>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
            <button onClick={openProfile} className="truncate hover:text-rust-700">{author.handle}</button>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>{(window.AN && AN.timeAgoCasual) ? AN.timeAgoCasual(minutesAgo) : HUB_DATA.timeAgo(minutesAgo)}</span>
            {location && <>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="inline-flex items-center gap-0.5"><I.MapPin size={11} /> {location}</span>
            </>}
          </div>
        </div>
      </div>
      <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
        <I.MoreH size={18} />
      </button>
    </div>
  );
}

function PostActions({ stats, saved, liked, onLike, onSave }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t hairline">
      <div className="flex items-center gap-1">
        <AN.LikeHeart liked={liked} count={stats.likes + (liked ? 1 : 0)} onToggle={onLike} />
        <ActionBtn icon={<I.MessageCircle size={18} />} label={stats.comments} />
        <ActionBtn icon={<I.Share size={18} />} label="שיתוף" hideLabelOnMobile />
      </div>
      <button onClick={onSave}
        className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition " +
                   (saved ? "bg-rust-600 text-white hover:bg-rust-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
        <I.Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
        <span>{saved ? 'נשמר' : 'שמירה'}</span>
      </button>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, active, activeColor = 'text-slate-700', hideLabelOnMobile }) {
  return (
    <button onClick={onClick}
      className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition " +
                 (active ? activeColor + ' font-semibold' : 'text-slate-600')}>
      {icon}
      <span className={"text-sm font-semibold " + (hideLabelOnMobile ? "hidden sm:inline" : "")}>{label}</span>
    </button>
  );
}

function TagRow({ tags }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
      {tags.map(t => (
        <span key={t} className="text-[11px] font-mono text-slate-600 bg-cream border border-dijon-300/60 px-2 py-0.5 rounded-md hover:bg-dijon-300/30 cursor-pointer">{t}</span>
      ))}
    </div>
  );
}

// Editorial bottom-of-image overlay that slides in on hover
function ImageOverlayActions({ primary = 'פתח פרויקט' }) {
  return (
    <div className="bg-gradient-to-t from-slate-900/95 via-slate-900/70 to-transparent pt-10 pb-3 px-4 text-cream">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="stamp text-dijon-400">{primary}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['שמור', 'שתף', 'פנה ליוצר'].map(a => (
            <span key={a} className="text-[12px] font-semibold px-2.5 py-1 rounded-full border border-cream/40 text-cream backdrop-blur-sm bg-white/5">{a}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Variant: Standard project post -----------------------------------------
function ProjectPost({ post, onOpenProfile }) {
  const [liked, setLiked] = useStateP(false);
  const [saved, setSaved] = useStateP(false);
  return (
    <article className="paper-card rounded-2xl shadow-card overflow-hidden">
      <PostHeader author={post.author} minutesAgo={post.minutesAgo} location={post.location} onOpenProfile={onOpenProfile} />

      {post.body && (
        <div className="px-4 pb-3 text-slate-800 leading-relaxed">{post.body}</div>
      )}

      <AN.ImageReveal className={"aspect-[16/10] " + post.bg}
                      overlay={<ImageOverlayActions primary={post.overlay || 'פרויקט'} />}>
        {/* light vignette only when no overlay shown */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none"></div>
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="pill bg-cream/90 backdrop-blur text-slate-700 shadow-sm">
            {post.isVideo ? <><I.Video size={11} strokeWidth={2.5} /> וידאו</> : <><I.Image size={11} strokeWidth={2.5} /> תמונה</>}
          </span>
        </div>
        {post.isVideo && (
          <button className="absolute inset-0 grid place-items-center text-cream/95 hover:text-cream">
            <span className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm grid place-items-center ring-1 ring-cream/40">
              <I.PlayCircle size={48} />
            </span>
          </button>
        )}
        {post.overlay && (
          <div className="absolute bottom-3 left-3 right-3 font-display font-bold text-2xl text-cream drop-shadow-md leading-tight">
            {post.overlay}
          </div>
        )}
      </AN.ImageReveal>

      <TagRow tags={post.tags} />
      <PostActions stats={post.stats} liked={liked} saved={saved}
                   onLike={() => setLiked(l => !l)} onSave={() => setSaved(s => !s)} />
    </article>
  );
}

// --- Variant: Tutorial card --------------------------------------------------
function TutorialPost({ post, onOpenProfile }) {
  const [liked, setLiked] = useStateP(false);
  const [saved, setSaved] = useStateP(true);
  return (
    <article className="paper-card rounded-2xl shadow-card overflow-hidden">
      <PostHeader author={post.author} minutesAgo={post.minutesAgo} location={post.location} kind="tutorial" onOpenProfile={onOpenProfile} />
      <div className="px-4 pb-1">
        <h3 className="font-display font-bold text-2xl text-slate-900 leading-tight">{post.title}</h3>
        {post.summary && <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">{post.summary}</p>}
      </div>

      <ol className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {post.steps.map((s, i) => (
          <li key={i} className="flex gap-3 p-2.5 rounded-xl border hairline hover:border-rust-300 hover:bg-cream transition cursor-pointer">
            <div className={"relative w-16 h-16 rounded-lg shrink-0 " + s.thumb}>
              <span className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-slate-900 text-cream grid place-items-center text-xs font-bold ring-2 ring-cream">{i + 1}</span>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-sm leading-tight">{s.title}</div>
              <div className="text-xs text-slate-500 mt-1 leading-snug">{s.note}</div>
            </div>
          </li>
        ))}
      </ol>

      <TagRow tags={post.tags} />
      <PostActions stats={post.stats} liked={liked} saved={saved}
                   onLike={() => setLiked(l => !l)} onSave={() => setSaved(s => !s)} />
    </article>
  );
}

// --- Variant: Store review post ---------------------------------------------
function ReviewPost({ post, onOpenProfile, onOpenStore }) {
  const [liked, setLiked] = useStateP(true);
  const [saved, setSaved] = useStateP(false);
  const openStore = () => post.shop?.id && onOpenStore && onOpenStore(post.shop.id);
  return (
    <article className="paper-card rounded-2xl shadow-card overflow-hidden">
      <PostHeader author={post.author} minutesAgo={post.minutesAgo} location={post.location} kind="review" onOpenProfile={onOpenProfile} />
      <div className="px-4 pb-3 text-slate-800 leading-relaxed">{post.body}</div>

      <button
        onClick={openStore}
        disabled={!post.shop?.id}
        className="block text-right mx-4 mb-3 rounded-xl border hairline bg-cream/60 p-4 hover:border-rust-300 hover:shadow-card transition disabled:hover:border-slate-200 disabled:hover:shadow-none disabled:cursor-default"
        style={{ width: 'calc(100% - 2rem)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="stamp inline-flex items-center gap-1">
              חנות כלים {post.shop?.id && <I.ChevronDown size={11} className="-rotate-90"/>}
            </div>
            <div className="font-display font-bold text-xl text-slate-900 mt-1 leading-tight">{post.shop.name}</div>
            <div className="text-xs text-slate-500 inline-flex items-center gap-1 mt-1 font-mono">
              <I.MapPin size={11} /> {post.shop.neighborhood}
            </div>
          </div>
          <div className="text-right">
            <UI.Stars value={post.shop.rating} size={16} showNumber={false} />
            <div className="text-xs text-slate-500 mt-1 font-mono"><span className="font-bold text-slate-900">{post.shop.rating}</span> · {post.shop.reviews} ביקורות</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
          <div>
            <div className="stamp text-rust-700">פלוסים</div>
            <ul className="mt-1 space-y-0.5">{post.pros.map(p => <li key={p} className="text-slate-700">+ {p}</li>)}</ul>
          </div>
          <div>
            <div className="stamp">מינוסים</div>
            <ul className="mt-1 space-y-0.5">{post.cons.map(p => <li key={p} className="text-slate-700">– {p}</li>)}</ul>
          </div>
        </div>
        {post.shop?.id && (
          <div className="mt-3 pt-2 border-t hairline text-xs font-bold text-rust-700 inline-flex items-center gap-1">
            כל הביקורות על {post.shop.name} <I.ChevronDown size={12} className="-rotate-90"/>
          </div>
        )}
      </button>

      <PostActions stats={post.stats} liked={liked} saved={saved}
                   onLike={() => setLiked(l => !l)} onSave={() => setSaved(s => !s)} />
    </article>
  );
}

// --- Variant: Agent / bot post ----------------------------------------------
function AgentPost({ post, onOpenProfile }) {
  const [liked, setLiked] = useStateP(false);
  const [saved, setSaved] = useStateP(false);
  return (
    <article className="rounded-2xl border border-slate-900/30 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 overflow-hidden shadow-card">
      <PostHeaderDark author={post.author} minutesAgo={post.minutesAgo} onOpenProfile={onOpenProfile} />
      <div className="px-4 pb-3 text-slate-200 leading-relaxed">{post.body}</div>

      <div className="mx-4 mb-3 rounded-xl bg-white/5 ring-1 ring-white/10 divide-y divide-white/5">
        {post.bullets.map((b, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="font-semibold text-cream truncate">{b.name}</div>
              <div className="text-xs text-slate-400">היה <span className="line-through">{b.was}</span></div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-rust-300 text-2xl leading-none">{b.now}</div>
              <div className="text-[11px] font-bold text-dijon-400 font-mono">{b.delta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-white/10">
        <div className="flex items-center gap-1">
          <button onClick={() => setLiked(l => !l)}
            className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 " +
                       (liked ? "text-rust-300" : "text-slate-300")}>
            <I.Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-sm font-semibold tabnum">{(post.stats.likes + (liked ? 1 : 0)).toLocaleString()}</span>
          </button>
          <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-slate-300">
            <I.MessageCircle size={18} />
            <span className="text-sm font-semibold">{post.stats.comments}</span>
          </button>
        </div>
        <button onClick={() => setSaved(s => !s)}
          className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition " +
                     (saved ? "bg-rust-500 text-cream hover:bg-rust-600"
                            : "bg-white/10 text-cream hover:bg-white/15")}>
          <I.Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
          <span>{saved ? 'במעקב' : 'תעקוב'}</span>
        </button>
      </div>
    </article>
  );
}

function PostHeaderDark({ author, minutesAgo, onOpenProfile }) {
  const openProfile = () => onOpenProfile && onOpenProfile(author.id);
  return (
    <div className="flex items-start justify-between gap-3 p-4 pb-3">
      <div className="flex items-center gap-3">
        <button onClick={openProfile} className="rounded-full hover:ring-2 hover:ring-rust-400/40 transition" title={`לפרופיל של ${author.name}`}>
          <UI.Avatar person={author} size={44} />
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={openProfile} className="font-bold text-cream hover:text-rust-300">{author.name}</button>
            <UI.AgentBadge />
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
            <button onClick={openProfile} className="hover:text-rust-300">{author.handle}</button>
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            <span>{(window.AN && AN.timeAgoCasual) ? AN.timeAgoCasual(minutesAgo) : HUB_DATA.timeAgo(minutesAgo)}</span>
          </div>
        </div>
      </div>
      <button className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
        <I.MoreH size={18} />
      </button>
    </div>
  );
}

window.PostCards = { ProjectPost, TutorialPost, ReviewPost, AgentPost };
