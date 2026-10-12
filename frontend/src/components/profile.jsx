// Profile page (API-backed) + edit-profile modal. Layout follows the design's Profile section.
import React, { useEffect, useRef, useState } from 'react';
import { I } from './icons.jsx';
import { UI, avatarSrc } from './ui.jsx';
import { AN } from './anims.jsx';
import { PostCards } from './posts.jsx';
import { FollowButton, PeopleList, Spinner, ErrorRow, FOLLOW_EVENT } from './social.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useInfiniteScroll, usePaginated } from '../lib/hooks.js';

const COVERS = ['ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night'];

export function Profile({ username, onOpenProfile, onOpenMessages, onView, onSign, onPickTag, createdPosts = [] }) {
  const { user } = useAuth();
  const [person, setPerson] = useState(null);
  const [status, setStatus] = useState('loading');   // loading | ok | missing | error
  const [tab, setTab] = useState('projects');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setTab('projects');
    api.profile(username)
      .then(p => { if (alive) { setPerson(p); setStatus('ok'); } })
      .catch(e => { if (alive) setStatus(e.status === 404 ? 'missing' : 'error'); });
    return () => { alive = false; };
  }, [username, user]);   // refetch after login/logout/profile edit (is_following / is_me change)

  // Follow / unfollow from anywhere (sidebar, lists) → refresh this profile's counters
  useEffect(() => {
    const h = (e) => {
      if (e.detail.username !== username) return;
      api.profile(username).then(p => setPerson(prev => prev && ({ ...prev, isFollowing: p.isFollowing,
        followersCount: p.followersCount, followingCount: p.followingCount }))).catch(() => {});
    };
    window.addEventListener(FOLLOW_EVENT, h);
    return () => window.removeEventListener(FOLLOW_EVENT, h);
  }, [username]);

  if (status === 'loading') return <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card"><Spinner /></div>;
  if (status !== 'ok') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3">
          <I.User size={28} className="text-slate-400"/>
        </div>
        <div className="font-display font-bold text-slate-900">{status === 'missing' ? 'היוצר לא נמצא' : 'שגיאה בטעינת הפרופיל'}</div>
        <p className="text-sm text-slate-500 mt-1">{status === 'missing' ? 'ייתכן שהקישור ישן או שהמשתמש נסגר.' : 'נסו לרענן את העמוד.'}</p>
        <button onClick={() => onView && onView('feed')} className="mt-4 inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-full">
          חזרה לפיד
        </button>
      </div>
    );
  }

  const isMe = person.isMe;
  const firstName = person.name.split(' ')[0];
  const TABS = [
    { id: 'projects',  label: 'פוסטים',  icon: <I.Image size={14}/>, count: person.postsCount },
    { id: 'followers', label: 'עוקבים',  icon: <I.Users size={14}/>, count: person.followersCount },
    { id: 'following', label: 'נעקבים',  icon: <I.Users size={14}/>, count: person.followingCount },
    { id: 'about',     label: 'אודות',   icon: <I.User size={14}/>,  count: null },
  ];

  return (
    <div className="space-y-4">
      <button onClick={() => onView && onView('feed')} className="text-xs font-semibold text-slate-500 hover:text-rust-700 inline-flex items-center gap-1">
        <I.ChevronDown size={14} className="-rotate-90"/> חזרה לפיד
      </button>

      {/* Hero card */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className={"relative h-36 sm:h-44 " + (person.cover || 'ph-night')}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10"></div>
          {person.verified && !person.agent && (
            <span className="absolute top-3 left-3 pill bg-white/95 text-rust-700 backdrop-blur shadow-sm">
              <I.Verified size={12} /> יוצר מאומת
            </span>
          )}
          {person.agent && (
            <span className="absolute top-3 left-3 pill bg-slate-900 text-rust-300 shadow-sm">
              <I.Bot size={12} strokeWidth={2.5}/> סוכן AI
            </span>
          )}
          <div className="absolute bottom-3 right-3 text-white/90 text-xs inline-flex items-center gap-1.5">
            {person.loc && <><I.MapPin size={12}/> {person.loc}<span className="w-1 h-1 rounded-full bg-white/50 mx-1"></span></>}
            <span>חבר מאז {person.joined}</span>
          </div>
        </div>

        <div className="px-4 sm:px-6 pb-4">
          <div className="flex items-start gap-4 -mt-10 sm:-mt-12">
            <div className="rounded-full bg-white p-1 shadow-card shrink-0">
              <img src={avatarSrc(person)} alt={person.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 mt-10 sm:mt-12 flex items-center gap-2 justify-end flex-wrap">
              {isMe ? (
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-4 py-2 rounded-full">
                  <I.Settings size={14}/> ערוך פרופיל
                </button>
              ) : (
                <>
                  <FollowButton key={person.username} person={person} size="lg" onSign={onSign}
                    onChange={(isFollowing, followersCount) => setPerson(p => ({ ...p, isFollowing, followersCount }))} />
                  <button onClick={() => onOpenMessages && onOpenMessages(person.username)}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm px-4 py-2 rounded-full">
                    <I.Mail size={14}/> הודעה
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-2xl text-slate-900">{person.name}</h1>
              {person.verified && <span className="text-rust-600" title="יוצר מאומת"><I.Verified size={20}/></span>}
              {person.agent && <UI.AgentBadge />}
            </div>
            <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span dir="ltr">{person.handle}</span>
              {person.followsYou && <span className="pill bg-slate-100 text-slate-600 text-[10px]">עוקב/ת אחריך</span>}
            </div>
            {person.bio
              ? <p className="text-[15px] text-slate-700 mt-3 leading-relaxed max-w-2xl whitespace-pre-line">{person.bio}</p>
              : isMe && <button onClick={() => setEditing(true)} className="text-sm text-rust-700 font-semibold mt-3 hover:underline">+ הוסיפו ביו קצר על עצמכם</button>}

            {person.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {person.skills.map(s => (
                  <span key={s} className="pill bg-slate-100 text-slate-700 text-[11px]">
                    <I.Hammer size={11} strokeWidth={2.5} className="text-rust-600"/> {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stat row — clicking a stat opens the matching tab */}
        <div className="grid grid-cols-3 border-t border-slate-100 divide-x divide-x-reverse divide-slate-100">
          <Stat label="עוקבים"  value={person.followersCount} onClick={() => setTab('followers')} />
          <Stat label="נעקבים"  value={person.followingCount} onClick={() => setTab('following')} />
          <Stat label="פוסטים"  value={person.postsCount}     onClick={() => setTab('projects')} accent />
        </div>
      </section>

      {/* Tab bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id}
            className={"flex-1 min-w-[96px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition " +
                       (tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {t.icon}<span>{t.label}</span>
            {t.count != null && (
              <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
                               (tab === t.id ? "bg-rust-500 text-white" : "bg-slate-200 text-slate-600")}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'projects' && (
        <ProfilePosts username={person.username} firstName={firstName} onOpenProfile={onOpenProfile} onPickTag={onPickTag}
          createdPosts={isMe ? createdPosts : []}
          onDeleted={() => setPerson(p => ({ ...p, postsCount: Math.max(0, p.postsCount - 1) }))} />
      )}
      {tab === 'followers' && (
        <PeopleList key={'followers-' + person.followersCount} username={person.username} which="followers" onOpenProfile={onOpenProfile} onSign={onSign}
          emptyText={isMe ? 'עדיין אין לך עוקבים — שתפו פרויקט ראשון!' : `אף אחד עוד לא עוקב אחרי ${firstName}.`} />
      )}
      {tab === 'following' && (
        <PeopleList key="following" username={person.username} which="following" onOpenProfile={onOpenProfile} onSign={onSign}
          emptyText={isMe ? 'עדיין לא עקבת אחרי אף אחד.' : `${firstName} עדיין לא עוקב/ת אחרי אף אחד.`} />
      )}
      {tab === 'about' && <ProfileAbout person={person} />}

      {editing && (
        <EditProfileModal onClose={() => setEditing(false)}
          onSaved={(p) => setPerson(prev => ({ ...prev, ...p, followersCount: prev.followersCount,
                                                followingCount: prev.followingCount, postsCount: prev.postsCount, isMe: true }))} />
      )}
    </div>
  );
}

function Stat({ label, value, accent, onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-3 text-center hover:bg-slate-50 transition">
      <div className={"font-display font-bold text-2xl " + (accent ? "text-rust-700" : "text-slate-900")}>
        <AN.CountUp value={value || 0} />
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{label}</div>
    </button>
  );
}

function ProfilePosts({ username, firstName, onOpenProfile, onPickTag, createdPosts, onDeleted }) {
  const { items, loading, hasMore, error, loadMore, retry, remove } =
    usePaginated((opts) => api.userPosts(username, opts), [username]);
  const sentinel = useInfiniteScroll(loadMore, hasMore && !loading && !error);
  const ids = new Set(items.map(p => p.id));
  const posts = [...createdPosts.filter(p => !ids.has(p.id)), ...items];
  const handleDeleted = (id) => { remove(id); onDeleted(); };

  if (!loading && !error && posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3">
          <I.Image size={24} className="text-slate-400"/>
        </div>
        <div className="font-display font-bold text-slate-900">אין כאן פוסטים עדיין</div>
        <p className="text-sm text-slate-500 mt-1">{firstName} עדיין לא פרסם/ה בפיד.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {posts.map(p => <PostCards.PostCard key={p.id} post={p} onOpenProfile={onOpenProfile} onPickTag={onPickTag} onDeleted={handleDeleted} />)}
      {loading && <Spinner label="טוען פוסטים…" />}
      {error && <ErrorRow message={error} onRetry={retry} />}
      <div ref={sentinel} />
    </div>
  );
}

function ProfileAbout({ person }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
        <h3 className="font-display font-bold text-slate-900 inline-flex items-center gap-2">
          <I.User size={16} className="text-rust-600"/> תיאור
        </h3>
        <p className="text-sm text-slate-700 mt-2 leading-relaxed whitespace-pre-line">{person.bio || 'לא נוסף תיאור.'}</p>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
        <h3 className="font-display font-bold text-slate-900 inline-flex items-center gap-2">
          <I.MapPin size={16} className="text-rust-600"/> פרטים
        </h3>
        <dl className="mt-3 text-sm divide-y divide-slate-100">
          <Detail label="מיקום" value={person.loc || '—'} />
          <Detail label="חבר מאז" value={String(person.joined)} />
          <Detail label="שם משתמש" value={person.handle} ltr />
          <Detail label="עוקבים" value={person.followersCount} />
          {person.agent && <Detail label="סוג חשבון" value="סוכן AI" />}
          {person.verified && <Detail label="אימות" value="מאומת" />}
        </dl>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 md:col-span-2">
        <h3 className="font-display font-bold text-slate-900 inline-flex items-center gap-2">
          <I.Hammer size={16} className="text-rust-600"/> תחומי התמחות
        </h3>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {person.skills.map(s => (
            <span key={s} className="pill bg-slate-100 text-slate-700 text-xs">
              <I.Hammer size={11} strokeWidth={2.5} className="text-rust-600"/> {s}
            </span>
          ))}
          {person.skills.length === 0 && <span className="text-sm text-slate-500">לא נוספו תחומים.</span>}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value, ltr }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800" dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  );
}

// ── Edit profile ────────────────────────────────────────────────────────────
export function EditProfileModal({ onClose, onSaved }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [loc, setLoc] = useState(user.loc);
  const [cover, setCover] = useState(user.cover);
  const [skills, setSkills] = useState(user.skills.join(', '));
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => () => avatarPreview && URL.revokeObjectURL(avatarPreview), [avatarPreview]);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const pickAvatar = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('יש לבחור קובץ תמונה'); return; }
    if (f.size > 5 * 1024 * 1024) { setError('תמונה עד 5MB'); return; }
    setError('');
    setAvatarFile(f);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const save = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('name', name);
    form.append('bio', bio);
    form.append('location', loc);
    form.append('cover', cover);
    form.append('skills', JSON.stringify(skills.split(',').map(s => s.trim()).filter(Boolean)));
    if (avatarFile) form.append('avatar', avatarFile);
    if (removeAvatar) form.append('remove_avatar', '1');
    setSaving(true);
    setError('');
    try {
      const raw = await api.updateProfile(form);
      updateUser(raw);
      onSaved && onSaved({ name: raw.name, bio: raw.bio || '', loc: raw.location || '', cover: raw.cover,
                           skills: raw.skills, avatar: raw.avatar_url });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const shownAvatar = avatarPreview || (removeAvatar ? avatarSrc({ id: user.username }) : avatarSrc(user));
  const input = "mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <form onSubmit={save} onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-pop w-full max-w-lg my-4">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-display font-bold text-xl text-slate-900">עריכת פרופיל</h3>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="סגור"><I.X size={18}/></button>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center gap-4">
              <img src={shownAvatar} alt="" className="w-20 h-20 rounded-full object-cover bg-slate-100 shadow-card" />
              <div className="flex flex-col gap-1.5 items-start">
                <button type="button" onClick={() => fileRef.current.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-sm font-bold text-slate-700">
                  <I.Camera size={14}/> החלפת תמונה
                </button>
                {(user.avatar || avatarFile) && !removeAvatar && (
                  <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); setRemoveAvatar(true); }}
                    className="text-xs font-bold text-rust-700 hover:underline">הסרת תמונה</button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">שם</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={input} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">ביו</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3}
                placeholder="ספרו על עצמכם, על הסדנה ועל מה שאתם בונים" className={input + " resize-none"} />
              <span className="text-[11px] text-slate-400">{bio.length}/500</span>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">מיקום</span>
              <input value={loc} onChange={(e) => setLoc(e.target.value)} maxLength={80} placeholder="תל אביב" className={input} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">תחומי התמחות</span>
              <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="נגרות, ריתוך, גימורים" className={input} />
              <span className="text-[11px] text-slate-400">מופרדים בפסיקים</span>
            </label>
            <div>
              <span className="text-xs font-bold text-slate-700">רקע לכרטיס</span>
              <div className="grid grid-cols-6 gap-2 mt-1">
                {COVERS.map(c => (
                  <button type="button" key={c} onClick={() => setCover(c)} aria-label={c} aria-pressed={cover === c}
                    className={"h-10 rounded-lg " + c + (cover === c ? " ring-2 ring-offset-2 ring-rust-500" : "")} />
                ))}
              </div>
            </div>
          </div>

          {error && <div role="alert" className="mx-4 mb-3 rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
            <button type="button" onClick={onClose} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">ביטול</button>
            <button type="submit" disabled={saving}
              className="bg-rust-600 hover:bg-rust-700 disabled:opacity-60 text-white font-bold text-sm px-5 py-2 rounded-full shadow-card">
              {saving ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
