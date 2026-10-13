import React from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import DOMPurify from 'dompurify';
import { useAuth, requestLogin } from '../lib/auth.jsx';
import { Comments } from './comments.jsx';
import { openReport } from './report.jsx';
import { toast } from '../lib/toast.jsx';
import { api, minutesSince } from '../lib/api.js';
import { useNow } from '../lib/hooks.js';
import { useSaved } from '../lib/saved.js';
import { requestMessage, requestShare } from '../lib/intents.js';
// Post card variants for HandyHub feed — editorial / workshop refresh
const { useState: useStateP, useRef: useRefP, useEffect: useEffectP } = React;

// --- Shared post chrome ------------------------------------------------------
// Rich-text body (already sanitized by the server; DOMPurify is defence in depth).
function RichText({ html, className = '' }) {
  if (!html) return null;
  return <div className={"rich " + className} dir="auto"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { ADD_ATTR: ['target'] }) }} />;
}

// "time ago" for both API posts (createdAt) and the design's mock posts (minutesAgo)
function useAgo(post) {
  useNow(60000);
  const minutes = post.createdAt ? minutesSince(post.createdAt) : post.minutesAgo;
  return AN.timeAgoCasual(minutes);
}

function PostMenu({ post, onDeleted, dark }) {
  const { user } = useAuth();
  const [open, setOpen] = useStateP(false);
  const [busy, setBusy] = useStateP(false);
  const ref = useRefP(null);
  useEffectP(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const live = typeof post.id === 'number';
  const mine = user && post.author && user.username === post.author.username;
  const canDelete = live && (mine || user?.isStaff);
  const canReport = live && user && !mine;
  if (!canDelete && !canReport) return null;

  const remove = async () => {
    const msg = mine ? 'למחוק את הפוסט? לא ניתן לבטל.' : `למחוק את הפוסט של ${post.author.name} (פעולת ניהול)?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await api.deletePost(post.id);
      if (!mine) toast('הפוסט נמחק');
      onDeleted && onDeleted(post.id);
    } catch (e) { alert(e.message); setBusy(false); }
  };
  const report = () => {
    setOpen(false);
    openReport({ targetType: 'post', targetId: post.id, label: `הפוסט של ${post.author.name}` });
  };
  const message = () => { setOpen(false); requestMessage(post.author.username); };
  const item = "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50 text-right";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="אפשרויות" aria-expanded={open}
        className={"p-1.5 rounded-lg " + (dark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-400")}>
        <I.MoreH size={18} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-48 rounded-xl bg-white shadow-pop border border-slate-200 p-1 z-20">
          {canReport && (
            <button onClick={message} className={item + " text-slate-700 hover:bg-slate-50"}>
              <I.MessageCircle size={15}/> שלח הודעה ליוצר
            </button>
          )}
          {canReport && (
            <button onClick={report} className={item + " text-slate-700 hover:bg-slate-50"}>
              <I.Flag size={15}/> דיווח על הפוסט
            </button>
          )}
          {canDelete && (
            <button onClick={remove} disabled={busy} className={item + " text-rust-700 hover:bg-rust-50"}>
              {mine ? <I.Trash size={15}/> : <I.Shield size={15}/>}
              {busy ? 'מוחק…' : mine ? 'מחק פוסט' : 'מחק (ניהול)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PostHeader({ post, kind, onOpenProfile, onDeleted }) {
  const { author, location } = post;
  const ago = useAgo(post);
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
            {post.sharedPostId && (
              <span className="pill bg-slate-100 text-slate-600"><I.Share size={11} strokeWidth={2.5} /> שיתף/ה פוסט</span>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
            <button onClick={openProfile} className="truncate hover:text-rust-700" dir="ltr">{author.handle}</button>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <time dateTime={post.createdAt} title={post.createdAt ? new Date(post.createdAt).toLocaleString('he-IL') : undefined}>{ago}</time>
            {location && <>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="inline-flex items-center gap-0.5"><I.MapPin size={11} /> {location}</span>
            </>}
          </div>
        </div>
      </div>
      <PostMenu post={post} onDeleted={onDeleted} />
    </div>
  );
}

// Like / comment / save bar. Real posts (numeric id) talk to the API; the design's
// mock posts keep a local-only like.
function PostFooter({ post, onOpenProfile, openComments }) {
  const { user } = useAuth();
  const live = typeof post.id === 'number';
  const [liked, setLiked] = useStateP(!!post.likedByMe);
  const [likes, setLikes] = useStateP(post.stats.likes);
  const [commentCount, setCommentCount] = useStateP(post.stats.comments);
  const [open, setOpen] = useStateP(!!openComments);
  const [saved, toggleSave] = useSaved('post', post.id, post.savedByMe);
  const busy = useRefP(false);

  // A refreshed feed (e.g. after login) brings new counts / liked flags
  useEffectP(() => { setLiked(!!post.likedByMe); setLikes(post.stats.likes); }, [post.likedByMe, post.stats.likes]);
  useEffectP(() => { setCommentCount(post.stats.comments); }, [post.stats.comments]);

  const toggleLike = async () => {
    const next = !liked;
    if (!live) { setLiked(next); setLikes(n => n + (next ? 1 : -1)); return; }
    if (!user) { requestLogin(); return; }
    if (busy.current) return;
    busy.current = true;
    setLiked(next);                                  // optimistic
    setLikes(n => n + (next ? 1 : -1));
    try {
      const r = next ? await api.like(post.id) : await api.unlike(post.id);
      setLiked(r.liked);
      setLikes(r.likes_count);
    } catch {
      setLiked(!next);                               // roll back
      setLikes(n => n + (next ? -1 : 1));
    } finally {
      busy.current = false;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-t hairline">
        <div className="flex items-center gap-1">
          <AN.LikeHeart liked={liked} count={likes} onToggle={toggleLike} />
          <ActionBtn icon={<I.MessageCircle size={18} />} label={commentCount} active={open}
                     onClick={() => live && setOpen(o => !o)} title="תגובות" />
          <ActionBtn icon={<I.Share size={18} />} label="שיתוף" hideLabelOnMobile title="שתף בפוסט חדש"
                     onClick={() => live && requestShare(post)} />
        </div>
        <button onClick={toggleSave} aria-pressed={saved}
          className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition " +
                     (saved ? "bg-rust-600 text-white hover:bg-rust-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
          <I.Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
          <span>{saved ? 'נשמר' : 'שמירה'}</span>
        </button>
      </div>
      {open && <Comments post={post} onOpenProfile={onOpenProfile} onCountChange={setCommentCount} />}
    </>
  );
}

function ActionBtn({ icon, label, onClick, active, activeColor = 'text-slate-700', hideLabelOnMobile, title }) {
  return (
    <button onClick={onClick} title={title} aria-pressed={active ? true : undefined}
      className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition " +
                 (active ? activeColor + ' font-semibold' : 'text-slate-600')}>
      {icon}
      <span className={"text-sm font-semibold " + (hideLabelOnMobile ? "hidden sm:inline" : "")}>{label}</span>
    </button>
  );
}

function TagRow({ tags, onPickTag }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
      {tags.map(t => (
        <button key={t} onClick={() => onPickTag && onPickTag(t)}
          className="text-[11px] font-mono text-slate-600 bg-cream border border-dijon-300/60 px-2 py-0.5 rounded-md hover:bg-dijon-300/30 cursor-pointer">{t}</button>
      ))}
    </div>
  );
}

// Uploaded images: 1 → full width; 2 → side by side; 3+ → big + thumbnails
function PostImages({ images, primary, post }) {
  if (!images?.length) return null;
  const img = (src, cls) => (
    <a href={src} target="_blank" rel="noopener noreferrer" className={"relative block overflow-hidden bg-slate-100 " + cls}>
      <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
    </a>
  );
  if (images.length === 1) {
    return (
      <AN.ImageReveal className="aspect-[16/10]" overlay={<ImageOverlayActions post={post} primary={primary} />}>
        <img src={images[0]} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none"></div>
        <div className="absolute top-3 left-3">
          <span className="pill bg-cream/90 backdrop-blur text-slate-700 shadow-sm"><I.Image size={11} strokeWidth={2.5} /> תמונה</span>
        </div>
      </AN.ImageReveal>
    );
  }
  if (images.length === 2) {
    return <div className="grid grid-cols-2 gap-0.5">{images.map(src => <React.Fragment key={src}>{img(src, 'aspect-square')}</React.Fragment>)}</div>;
  }
  const rest = images.slice(1, 4);
  return (
    <div className="space-y-0.5">
      {img(images[0], 'aspect-[16/10]')}
      <div className={"grid gap-0.5 " + (rest.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {rest.map((src, i) => (
          <div key={src} className="relative">
            {img(src, 'aspect-[4/3]')}
            {i === rest.length - 1 && images.length > 4 && (
              <span className="absolute inset-0 grid place-items-center bg-black/50 text-cream font-display font-bold text-2xl pointer-events-none">+{images.length - 4}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Editorial bottom-of-image overlay that slides in on hover: share / message the maker
function ImageOverlayActions({ post, primary = 'פתח פרויקט' }) {
  const { user } = useAuth();
  const live = typeof post?.id === 'number';
  const mine = user && post?.author && user.username === post.author.username;
  const btn = "text-[12px] font-semibold px-2.5 py-1 rounded-full border border-cream/40 text-cream backdrop-blur-sm bg-white/5 hover:bg-white/20 transition";
  return (
    <div className="bg-gradient-to-t from-slate-900/95 via-slate-900/70 to-transparent pt-10 pb-3 px-4 text-cream">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="stamp text-dijon-400">{primary}</div>
        {live && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => requestShare(post)} className={btn}>שתף</button>
            {!mine && <button onClick={() => requestMessage(post.author.username)} className={btn}>פנה ליוצר</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// The post a "share" quotes: a compact, clickable preview (or a note when it was removed)
function SharedPostEmbed({ original, missing, className = 'mx-4 mb-3' }) {
  if (missing) {
    return (
      <div className={className + " rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500"}>
        הפוסט המקורי הוסר
      </div>
    );
  }
  return <SharedPostPreview original={original} className={className} />;
}

function SharedPostPreview({ original, className }) {
  const ago = useAgo(original);
  const open = (e) => {
    if (e.target.closest('a')) return;             // links inside the text still work
    window.location.hash = `#/post/${original.id}`;
  };
  return (
    <div role="link" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open(e)}
      aria-label={`הפוסט של ${original.author.name}`}
      className={className + " block rounded-xl border hairline bg-cream/40 hover:border-rust-300 overflow-hidden cursor-pointer transition"}>
      <div className="flex items-center gap-2 px-3 pt-3 text-sm">
        <UI.Avatar person={original.author} size={24} />
        <span className="font-bold text-slate-900 truncate">{original.author.name}</span>
        {original.author.agent && <UI.AgentBadge />}
        <span className="text-[11px] text-slate-500 shrink-0">· {ago}</span>
      </div>
      {original.title && <div className="px-3 pt-2 font-display font-bold text-slate-900 leading-tight">{original.title}</div>}
      {original.bodyHtml && <RichText html={original.bodyHtml} className="px-3 pt-1.5 text-sm text-slate-700 leading-relaxed line-clamp-4" />}
      {original.images?.[0] ? (
        <div className="relative aspect-[16/9] bg-slate-100 mt-3">
          <img src={original.images[0]} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      ) : <div className="pb-3"></div>}
    </div>
  );
}

// --- Variant: Standard project post -----------------------------------------
function ProjectPost({ post, onOpenProfile, onPickTag, onDeleted, openComments }) {
  const hasMockMedia = !post.images && post.bg;   // design mock posts (saved panel)
  return (
    <article className="paper-card rounded-2xl shadow-card overflow-hidden">
      <PostHeader post={post} onOpenProfile={onOpenProfile} onDeleted={onDeleted} />

      {post.bodyHtml && <RichText html={post.bodyHtml} className="px-4 pb-3 text-slate-800 leading-relaxed" />}
      {!post.bodyHtml && post.body && <div className="px-4 pb-3 text-slate-800 leading-relaxed">{post.body}</div>}

      {post.sharedPostId && <SharedPostEmbed original={post.sharedPost} missing={!post.sharedPost} />}

      <PostImages images={post.images} primary={post.title || 'פרויקט'} post={post} />
      {hasMockMedia && (
        <AN.ImageReveal className={"aspect-[16/10] " + post.bg} overlay={<ImageOverlayActions post={post} primary={post.overlay || 'פרויקט'} />}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none"></div>
          {post.overlay && (
            <div className="absolute bottom-3 left-3 right-3 font-display font-bold text-2xl text-cream drop-shadow-md leading-tight">{post.overlay}</div>
          )}
        </AN.ImageReveal>
      )}

      <div className={post.images?.length || hasMockMedia ? 'pt-3' : ''}>
        <TagRow tags={post.tags} onPickTag={onPickTag} />
      </div>
      <PostFooter post={post} onOpenProfile={onOpenProfile} openComments={openComments} />
    </article>
  );
}

// --- Variant: Tutorial card --------------------------------------------------
function TutorialPost({ post, onOpenProfile, onPickTag, onDeleted, openComments }) {
  return (
    <article className="paper-card rounded-2xl shadow-card overflow-hidden">
      <PostHeader post={post} kind="tutorial" onOpenProfile={onOpenProfile} onDeleted={onDeleted} />
      <div className="px-4 pb-1">
        <h3 className="font-display font-bold text-2xl text-slate-900 leading-tight">{post.title}</h3>
        {post.bodyHtml && <RichText html={post.bodyHtml} className="text-slate-600 text-sm mt-1.5 leading-relaxed" />}
        {!post.bodyHtml && post.summary && <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">{post.summary}</p>}
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

      <TagRow tags={post.tags} onPickTag={onPickTag} />
      <PostFooter post={post} onOpenProfile={onOpenProfile} openComments={openComments} />
    </article>
  );
}

// Pick the right card for a post
function PostCard({ post, ...handlers }) {
  if (post.kind === 'tutorial') return <TutorialPost post={post} {...handlers} />;
  return <ProjectPost post={post} {...handlers} />;
}

export const PostCards = { ProjectPost, TutorialPost, PostCard, RichText, SharedPostEmbed };
