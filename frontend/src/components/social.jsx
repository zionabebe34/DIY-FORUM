// Follow button + people lists (followers / following / suggestions)
import React, { useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { UI } from './ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useInfiniteScroll, usePaginated } from '../lib/hooks.js';

// Every FollowButton for the same user stays in sync (sidebar, profile, lists)
export const FOLLOW_EVENT = 'hh:follow';

/**
 * Follow / unfollow toggle with optimistic update.
 * onChange(isFollowing, followersCount) lets parents keep counters in sync.
 */
export function FollowButton({ person, onChange, onSign, size = 'sm' }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(person.isFollowing);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setFollowing(person.isFollowing); }, [person.isFollowing]);
  useEffect(() => {
    const h = (e) => { if (e.detail.username === person.username) setFollowing(e.detail.isFollowing); };
    window.addEventListener(FOLLOW_EVENT, h);
    return () => window.removeEventListener(FOLLOW_EVENT, h);
  }, [person.username]);
  if (user && user.username === person.username) return null;

  const toggle = async () => {
    if (!user) { onSign && onSign('login'); return; }
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      const r = next ? await api.follow(person.username) : await api.unfollow(person.username);
      setFollowing(r.is_following);
      window.dispatchEvent(new CustomEvent(FOLLOW_EVENT, { detail: { username: person.username, isFollowing: r.is_following } }));
      onChange && onChange(r.is_following, r.followers_count);
    } catch (e) {
      setFollowing(!next);   // roll back
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (size === 'lg') {
    return (
      <button onClick={toggle} disabled={busy} aria-pressed={following}
        className={"inline-flex items-center gap-1.5 font-bold text-sm px-4 py-2 rounded-full transition disabled:opacity-70 " +
                   (following ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-rust-600 hover:bg-rust-700 text-white shadow-card")}>
        {following ? <><I.Check size={14}/> במעקב</> : <><I.Plus size={14}/> עקוב</>}
      </button>
    );
  }
  return (
    <button onClick={toggle} disabled={busy} aria-pressed={following}
      className={"text-xs font-bold px-3 py-1.5 rounded-full transition shrink-0 disabled:opacity-70 " +
                 (following ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            : "bg-slate-900 text-white hover:bg-rust-600")}>
      {following ? 'במעקב' : 'עקוב'}
    </button>
  );
}

// A person row: avatar, name, subtitle and a follow button.
export function UserRow({ person, onOpenProfile, onSign, subtitle }) {
  const open = () => onOpenProfile && onOpenProfile(person.username);
  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <button onClick={open} className="shrink-0 rounded-full hover:ring-2 hover:ring-rust-500/30">
        <UI.Avatar person={person} size={44} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={open} className="font-bold text-slate-900 text-sm truncate hover:text-rust-700 hover:underline">{person.name}</button>
          {person.agent && <UI.AgentBadge />}
        </div>
        <div className="text-xs text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>{person.handle}</div>
        {(subtitle || person.bio) && <div className="text-xs text-slate-600 mt-0.5 line-clamp-1">{subtitle || person.bio}</div>}
      </div>
      <FollowButton person={person} onSign={onSign} />
    </li>
  );
}

/** Paginated followers / following list for a profile page. */
export function PeopleList({ username, which, onOpenProfile, onSign, emptyText }) {
  const fetchPage = which === 'followers'
    ? (opts) => api.followers(username, opts)
    : (opts) => api.following(username, opts);
  const { items, loading, hasMore, error, loadMore, retry } = usePaginated(fetchPage, [username, which]);
  const sentinel = useInfiniteScroll(loadMore, hasMore && !loading && !error, items.length);

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.map(p => <UserRow key={p.username} person={p} onOpenProfile={onOpenProfile} onSign={onSign} />)}
        </ul>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3"><I.Users size={24} className="text-slate-400"/></div>
          <div className="text-sm text-slate-500">{emptyText}</div>
        </div>
      )}
      {loading && <Spinner />}
      {error && <ErrorRow message={error} onRetry={retry} />}
      <div ref={sentinel} />
    </section>
  );
}

// A loading spinner with a label.
export function Spinner({ label = 'טוען…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      </svg>
      {label}
    </div>
  );
}

// An error message with a retry button.
export function ErrorRow({ message, onRetry }) {
  return (
    <div className="flex items-center justify-center gap-3 py-5 text-sm">
      <span className="text-rust-700">{message}</span>
      {onRetry && <button onClick={onRetry} className="font-bold text-slate-700 underline">נסה שוב</button>}
    </div>
  );
}
