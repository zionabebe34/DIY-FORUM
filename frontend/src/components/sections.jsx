import React from 'react';
import { I } from './icons.jsx';
import { UI } from './ui.jsx';
import { FollowButton } from './social.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { POSTS_CHANGED_EVENT } from '../lib/intents.js';
import { Marketplace, MarketplaceTeaser } from './market.jsx';
import { StoreReviews, Store } from './stores.jsx';
// Sidebar (suggested makers, trending tags); re-exports the marketplace and store pages
const { useState: useStateM, useEffect: useEffectM } = React;

// --- Sidebar ----------------------------------------------------------------
// The side column: suggested makers, trending hashtags and a mini footer.
function Sidebar({ onOpenProfile, onPickTag, onSign, refreshKey }) {
  return (
    <aside className="space-y-4">
      <SuggestedMakers onOpenProfile={onOpenProfile} onSign={onSign} refreshKey={refreshKey} />
      <TrendingProjects onPickTag={onPickTag} refreshKey={refreshKey} />
      <FooterMini />
    </aside>
  );
}

// The "suggested makers" box: people to follow, with follow buttons.
function SuggestedMakers({ onOpenProfile, onSign, refreshKey }) {
  const { user } = useAuth();
  const [people, setPeople] = useStateM(null);
  useEffectM(() => {
    let alive = true;
    api.suggested().then(p => alive && setPeople(p)).catch(() => alive && setPeople([]));
    return () => { alive = false; };
  }, [user?.username, refreshKey]);
  if (people && people.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <I.Users size={16} className="text-rust-600" />
          <h3 className="font-display font-bold text-slate-900">יוצרים מומלצים</h3>
        </div>
        <I.Sparkles size={14} className="text-rust-500" />
      </div>
      <p className="px-4 text-xs text-slate-500 -mt-1 mb-2">{user ? 'לפי חברים משותפים' : 'הכי פופולריים בקהילה'}</p>
      {people === null && <div className="px-4 pb-4 text-xs text-slate-400">טוען…</div>}
      <ul className="divide-y divide-slate-100">
        {(people || []).map(p => (
          <li key={p.username} className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => onOpenProfile && onOpenProfile(p.username)} className="shrink-0 rounded-full hover:ring-2 hover:ring-rust-500/30">
              <UI.Avatar person={p} size={40} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => onOpenProfile && onOpenProfile(p.username)} className="font-bold text-slate-900 text-sm truncate hover:text-rust-700 hover:underline">{p.name}</button>
                {p.agent && <UI.AgentBadge />}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap mt-0.5">
                {p.mutuals > 0
                  ? <span>{p.mutuals === 1 ? 'חבר/ה משותף/ת אחד/ת' : `${p.mutuals} חברים משותפים`}</span>
                  : p.skills.slice(0, 2).map(s => <span key={s} className="text-rust-700 font-semibold">#{s.replace(/\s+/g, '_')}</span>)}
              </div>
            </div>
            <FollowButton person={p} onSign={onSign} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const TRENDING_REFRESH_MS = 60000;

// The trending hashtags box (top 5; a click filters the feed).
// Ranked by activity this week; the number is the exact count of posts that use the tag.
// Refreshes when a post is published / deleted here, and every minute for everyone else's posts.
function TrendingProjects({ onPickTag, refreshKey }) {
  const [tags, setTags] = useStateM([]);
  useEffectM(() => {
    let alive = true;
    const load = () => api.trending().then(t => alive && setTags(t)).catch(() => {});
    load();
    const timer = setInterval(load, TRENDING_REFRESH_MS);
    window.addEventListener(POSTS_CHANGED_EVENT, load);
    return () => { alive = false; clearInterval(timer); window.removeEventListener(POSTS_CHANGED_EVENT, load); };
  }, [refreshKey]);
  if (tags.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <I.TrendUp size={16} className="text-rust-600" />
        <h3 className="font-display font-bold text-slate-900">תגיות חמות</h3>
      </div>
      <p className="px-4 text-xs text-slate-500 -mt-1 mb-2">הפעילות ביותר השבוע ב-HandyHub</p>
      <ul>
        {tags.map((t, i) => (
          <li key={t.tag}>
            <button onClick={() => onPickTag && onPickTag(t.tag)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 text-right">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4 text-center">{i + 1}</span>
                <div>
                  <div className="font-bold text-slate-900 text-sm inline-flex items-center gap-0.5">
                    <I.Hash size={13} className="text-rust-600" />{t.tag.replace('#','')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono" title={`${t.recent} מהם השבוע`}>
                    <span className="tabnum">{t.posts.toLocaleString('he-IL')}</span> {t.posts === 1 ? 'פוסט' : 'פוסטים'}
                  </div>
                </div>
              </div>
              <I.TrendUp size={13} className="text-emerald-500" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The small footer links under the sidebar.
function FooterMini() {
  return (
    <div className="px-2 py-2 text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
      <span>אודות</span><span>עזרה</span><span>הנחיות קהילה</span><span>פרטיות</span><span>© 2026 HandyHub</span>
    </div>
  );
}

export const SECTIONS = { Marketplace, StoreReviews, Sidebar, MarketplaceTeaser, Store };
