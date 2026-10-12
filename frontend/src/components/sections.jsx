import React from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import { PostCards } from './posts.jsx';
import { FollowButton } from './social.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
// Marketplace + Stores + Sidebar — Hebrew
const { useState: useStateM, useEffect: useEffectM } = React;

// --- Marketplace grid (full page) -------------------------------------------
function Marketplace({ onOpenProfile, authed, onOpenComposer, onSign }) {
  const [filter, setFilter] = useStateM('all');
  const [txType, setTxType] = useStateM('all'); // all | sale | lend
  const FILTERS = [
    { id: 'all',     label: 'הכל'           },
    { id: 'hand',    label: 'כלי יד'        },
    { id: 'power',   label: 'כלים חשמליים' },
    { id: 'machines',label: 'מכונות'        },
  ];
  const TX_TABS = [
    { id: 'all',  label: 'הכל',       icon: null,                                    count: HUB_DATA.MARKET.length },
    { id: 'sale', label: 'למכירה',    icon: <I.Tag size={13} strokeWidth={2.5}/>,    count: HUB_DATA.MARKET.filter(m => m.listingType !== 'lend').length },
    { id: 'lend', label: 'להשאלה',    icon: <I.Wrench size={13} strokeWidth={2.5}/>, count: HUB_DATA.MARKET.filter(m => m.listingType === 'lend').length },
  ];
  const items = HUB_DATA.MARKET.filter(m => {
    if (txType === 'sale') return m.listingType !== 'lend';
    if (txType === 'lend') return m.listingType === 'lend';
    return true;
  });
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900 inline-flex items-center gap-2">
            <I.ShoppingBag size={22} className="text-rust-600" /> שוק כלים
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">כלים יד שנייה וכלים להשאלה מיוצרים באזורך.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => authed ? onOpenComposer && onOpenComposer('tool') : onSign && onSign(true)}
            className="inline-flex items-center gap-1.5 bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-4 py-2 rounded-full shadow-card">
            <I.Plus size={15} strokeWidth={2.5}/> פרסם מודעה
          </button>
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={"px-3 py-1.5 rounded-md text-xs font-semibold transition " +
                           (filter === f.id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction-type tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5">
        {TX_TABS.map(t => (
          <button key={t.id} onClick={() => setTxType(t.id)}
            className={"flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition " +
                       (txType === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {t.icon}
            <span>{t.label}</span>
            <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
                             (txType === t.id ? "bg-rust-500 text-white" : "bg-slate-200 text-slate-600")}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Lending banner */}
      {txType === 'lend' && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-lg bg-emerald-600 text-white grid place-items-center shrink-0"><I.Wrench size={20} strokeWidth={2.5}/></span>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-emerald-900">כלים להשאלה — קהילתי</div>
            <p className="text-sm text-emerald-800/85 mt-0.5">משלם ליום או לשבוע במקום לקנות כלים יקרים לפרויקט חד-פעמי. פיקדון מוחזר למשאיל בסוף ההשאלה.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(m => <MarketCard key={m.id} item={m} onOpenProfile={onOpenProfile} />)}
      </div>
    </div>
  );
}

// --- Marketplace teaser (inside feed) ---------------------------------------
function MarketplaceTeaser({ onOpenProfile }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <I.ShoppingBag size={18} className="text-rust-600" />
          <h3 className="font-display font-bold text-slate-900">שוק כלים באזורך</h3>
          <span className="pill bg-emerald-50 text-emerald-700 text-[10px]"><I.Wrench size={10} strokeWidth={2.5}/> חדש: השאלות</span>
        </div>
        <a className="text-xs font-semibold text-rust-700 hover:underline" href="#">לכל המוצרים ←</a>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        {HUB_DATA.MARKET.slice(0, 4).map(m => <MarketCard key={m.id} item={m} compact onOpenProfile={onOpenProfile} />)}
      </div>
    </section>
  );
}

function MarketCard({ item, compact, onOpenProfile }) {
  const isLend = item.listingType === 'lend';
  const openSeller = (e) => { e.stopPropagation(); onOpenProfile && onOpenProfile(item.seller.id); };
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:border-slate-300 hover:shadow-card transition group">
      <div className={"relative aspect-square " + item.bg}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
        <span className={"absolute top-2 right-2 pill shadow-sm text-[10px] " +
                         (isLend ? "bg-emerald-600 text-white" : "bg-white/95 backdrop-blur text-slate-700")}>
          {isLend
            ? <><I.Wrench size={10} strokeWidth={2.5}/> להשאלה</>
            : <><I.Tag size={10} strokeWidth={2.5}/> {item.cond.split('—')[1]?.trim() || item.cond}</>}
        </span>
        <div className="absolute bottom-2 left-2 bg-slate-900 text-white font-display font-bold rounded-md px-2 py-1 text-sm leading-tight">
          {isLend ? (
            <span className="inline-flex items-baseline gap-1">
              {HUB_DATA.NIS(item.dailyPrice)}<span className="text-[10px] font-semibold text-slate-300">/ יום</span>
            </span>
          ) : HUB_DATA.NIS(item.price)}
        </div>
      </div>
      <div className={"p-3 " + (compact ? "space-y-1.5" : "space-y-2")}>
        <div className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">{item.name}</div>
        <button onClick={openSeller} className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rust-700 w-full text-right">
          <UI.Avatar person={item.seller} size={16} />
          <span className="truncate font-semibold">{item.seller.name.split(' ')[0]}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span className="inline-flex items-center gap-0.5"><I.MapPin size={10} /> {item.dist}</span>
        </button>
        {isLend && !compact && (
          <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-600 bg-emerald-50/80 border border-emerald-100 rounded-md px-2 py-1">
            <span className="inline-flex items-center gap-1 font-semibold"><I.TrendUp size={10} className="text-emerald-600"/> {HUB_DATA.NIS(item.weeklyPrice)} / שבוע</span>
            <span>פיקדון {HUB_DATA.NIS(item.deposit)}</span>
          </div>
        )}
        {!compact && (
          <div className="flex gap-1.5 pt-1">
            <button className={"flex-1 text-white text-xs font-bold rounded-md py-1.5 " +
                               (isLend ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rust-600 hover:bg-rust-700")}>
              {isLend ? 'השאל הכלי' : 'קנה עכשיו'}
            </button>
            <button className="px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600" title="שלח הודעה למשאיל">
              <I.MessageCircle size={14} />
            </button>
          </div>
        )}
        {compact && (
          <button className={"w-full text-white text-[11px] font-bold rounded-md py-1 transition " +
                             (isLend ? "bg-emerald-700 hover:bg-emerald-800" : "bg-slate-900 hover:bg-rust-600")}>
            {isLend ? `השאל ${HUB_DATA.NIS(item.dailyPrice)}/יום` : `קנה ${HUB_DATA.NIS(item.price)}`}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Store reviews page -----------------------------------------------------
function StoreReviews({ onOpenStore }) {
  const [composerOpen, setComposerOpen] = useStateM(false);
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900 inline-flex items-center gap-2">
            <I.Star size={22} className="text-rust-600" /> ביקורות חנויות
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">חנויות כלים, מחסני עץ וסיטונאים — דירוגים מהקהילה.</p>
        </div>
        <button onClick={() => setComposerOpen(o => !o)}
          className="inline-flex items-center gap-2 bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-4 py-2 rounded-full shadow-card">
          {composerOpen ? <><I.X size={15}/> בטל</> : <><I.Plus size={15}/> כתוב ביקורת</>}
        </button>
      </div>

      {composerOpen && <ReviewComposer onSubmit={() => setComposerOpen(false)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {HUB_DATA.STORES.map(s => <StoreCard key={s.id} store={s} onOpenStore={onOpenStore} />)}
      </div>
    </div>
  );
}

function ReviewComposer({ onSubmit }) {
  const [rating, setRating] = useStateM(0);
  const [hover, setHover] = useStateM(0);
  const [storeName, setStoreName] = useStateM('');
  const [area, setArea] = useStateM('');
  const [body, setBody] = useStateM('');
  const [pros, setPros] = useStateM(['']);
  const [cons, setCons] = useStateM(['']);

  const addLine = (setter) => () => setter(arr => [...arr, '']);
  const setLine = (setter) => (idx, val) => setter(arr => arr.map((a,i) => i===idx ? val : a));
  const removeLine = (setter) => (idx) => setter(arr => arr.length === 1 ? arr : arr.filter((_,i) => i !== idx));

  const canSubmit = storeName.trim() && rating > 0;

  return (
    <section className="bg-white rounded-2xl border-2 border-rust-500/30 shadow-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-9 h-9 rounded-lg bg-rust-600 text-white grid place-items-center"><I.Star size={18} strokeWidth={2.5} fill="currentColor"/></span>
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900">כתיבת ביקורת חנות</h3>
          <p className="text-xs text-slate-500">דרג חנות שאתה מכיר ועזור לקהילה.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-slate-700">שם החנות</span>
          <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="לדוגמה: פלדה ועץ" className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-700">אזור / כתובת</span>
          <input value={area} onChange={e => setArea(e.target.value)} placeholder="פלורנטין, תל אביב" className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-3">
        <span className="text-xs font-bold text-slate-700">הדירוג שלך</span>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
                className="p-1 text-rust-500 hover:scale-110 transition">
                {n <= (hover || rating) ? <I.StarSolid size={26}/> : <I.Star size={26} className="text-slate-300"/>}
              </button>
            ))}
          </div>
          <span className="text-sm font-bold text-slate-700">{(hover || rating) > 0 ? `${(hover || rating).toFixed(1)} / 5` : 'לחץ לדירוג'}</span>
        </div>
      </div>

      <label className="block mt-3">
        <span className="text-xs font-bold text-slate-700">הביקורת שלך</span>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="ספר על השירות, המגוון, המחירים…"
          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm resize-y" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <span className="text-xs font-bold text-emerald-700">יתרונות</span>
          <div className="space-y-1.5 mt-1">
            {pros.map((p, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={p} onChange={e => setLine(setPros)(i, e.target.value)} placeholder="לדוגמה: שירות מצוין"
                  className="flex-1 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none px-2.5 py-1.5 text-sm" />
                {pros.length > 1 && <button onClick={() => removeLine(setPros)(i)} className="px-2 text-slate-400 hover:text-rust-600"><I.X size={14}/></button>}
              </div>
            ))}
            <button onClick={addLine(setPros)} className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1">
              <I.Plus size={12}/> הוסף יתרון
            </button>
          </div>
        </div>
        <div>
          <span className="text-xs font-bold text-rust-700">חסרונות</span>
          <div className="space-y-1.5 mt-1">
            {cons.map((c, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={c} onChange={e => setLine(setCons)(i, e.target.value)} placeholder="לדוגמה: יקר"
                  className="flex-1 rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-2.5 py-1.5 text-sm" />
                {cons.length > 1 && <button onClick={() => removeLine(setCons)(i)} className="px-2 text-slate-400 hover:text-rust-600"><I.X size={14}/></button>}
              </div>
            ))}
            <button onClick={addLine(setCons)} className="text-xs font-semibold text-rust-700 hover:underline inline-flex items-center gap-1">
              <I.Plus size={12}/> הוסף חיסרון
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
        <button onClick={onSubmit} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">ביטול</button>
        <button onClick={onSubmit} disabled={!canSubmit}
          className="bg-rust-600 hover:bg-rust-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm px-5 py-2 rounded-full">
          פרסם ביקורת
        </button>
      </div>
    </section>
  );
}

function StoreCard({ store, onOpenStore }) {
  const reviewCount = (HUB_DATA.STORE_REVIEWS?.[store.id] || []).length;
  return (
    <button onClick={() => onOpenStore && onOpenStore(store.id)}
      className="text-right w-full bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden hover:shadow-pop hover:border-slate-300 transition group">
      <div className={"relative h-28 " + store.bg}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"></div>
        <div className="absolute bottom-2 right-3 left-3 flex items-end justify-between gap-2">
          <div>
            <div className="font-display font-bold text-white text-lg leading-tight drop-shadow">{store.name}</div>
            <div className="text-xs text-white/85 inline-flex items-center gap-1"><I.MapPin size={11} /> {store.area}</div>
          </div>
        </div>
        <span className="absolute top-3 left-3 pill bg-white/95 backdrop-blur text-slate-700 text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition">
          לעמוד החנות <I.ChevronDown size={10} className="-rotate-90"/>
        </span>
      </div>
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <UI.Stars value={store.rating} size={16} />
          <div className="text-xs text-slate-500 mt-0.5">{store.reviews} ביקורות מיוצרים{reviewCount > 0 && <span className="text-rust-700 font-semibold"> · {reviewCount} בהיידעות</span>}</div>
        </div>
        <div className="flex gap-1">
          {store.tags.map(t => <span key={t} className="pill bg-slate-100 text-slate-700 text-[11px]">{t}</span>)}
        </div>
      </div>
    </button>
  );
}

// --- Sidebar ----------------------------------------------------------------
function Sidebar({ onOpenProfile, onPickTag, onSign, refreshKey }) {
  return (
    <aside className="space-y-4">
      <SuggestedMakers onOpenProfile={onOpenProfile} onSign={onSign} refreshKey={refreshKey} />
      <TrendingProjects onPickTag={onPickTag} refreshKey={refreshKey} />
      <FooterMini />
    </aside>
  );
}

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

function TrendingProjects({ onPickTag, refreshKey }) {
  const [tags, setTags] = useStateM([]);
  useEffectM(() => {
    let alive = true;
    api.trending().then(t => alive && setTags(t)).catch(() => {});
    return () => { alive = false; };
  }, [refreshKey]);
  if (tags.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <I.TrendUp size={16} className="text-rust-600" />
        <h3 className="font-display font-bold text-slate-900">תגיות חמות</h3>
      </div>
      <p className="px-4 text-xs text-slate-500 -mt-1 mb-2">השבוע ב-HandyHub</p>
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
                  <div className="text-[11px] text-slate-500 font-mono">
                    <AN.CountUp value={t.posts} startDelay={i * 80}/> פוסטים
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

function FooterMini() {
  return (
    <div className="px-2 py-2 text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
      <span>אודות</span><span>עזרה</span><span>הנחיות קהילה</span><span>פרטיות</span><span>© 2026 HandyHub</span>
    </div>
  );
}

// =====================================================================
// --- Store detail page ------------------------------------------------
// =====================================================================
function Store({ storeId, onOpenProfile, onView }) {
  const store = HUB_DATA.STORES.find(s => s.id === storeId);
  const [composerOpen, setComposerOpen] = useStateM(false);
  const [sort, setSort] = useStateM('recent'); // recent | highest | lowest

  if (!store) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3">
          <I.ShoppingBag size={28} className="text-slate-400"/>
        </div>
        <div className="font-display font-bold text-slate-900">החנות לא נמצאה</div>
        <button onClick={() => onView && onView('stores')} className="mt-4 inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-full">
          חזרה לחנויות
        </button>
      </div>
    );
  }

  const reviews = HUB_DATA.STORE_REVIEWS?.[storeId] || [];
  const sortedReviews = [...reviews].sort((a, b) => {
    if (sort === 'highest') return b.rating - a.rating;
    if (sort === 'lowest')  return a.rating - b.rating;
    return a.minutesAgo - b.minutesAgo;
  });

  // Rating distribution histogram
  const dist = [5,4,3,2,1].map(n => ({
    n,
    count: reviews.filter(r => Math.round(r.rating) === n).length,
  }));
  const maxBar = Math.max(1, ...dist.map(d => d.count));
  const avgRating = reviews.length ? (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length) : store.rating;

  return (
    <div className="space-y-4">
      <button onClick={() => onView && onView('stores')} className="text-xs font-semibold text-slate-500 hover:text-rust-700 inline-flex items-center gap-1">
        <I.ChevronDown size={14} className="-rotate-90"/> חזרה לרשימת החנויות
      </button>

      {/* Hero card */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className={"relative h-40 sm:h-48 " + store.bg}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent"></div>
          <div className="absolute bottom-3 right-4 left-4 flex items-end justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-display font-bold text-white text-2xl sm:text-3xl drop-shadow leading-tight">{store.name}</h1>
              <div className="text-sm text-white/90 inline-flex items-center gap-1.5 mt-1 drop-shadow">
                <I.MapPin size={13}/> {store.address || store.area}
              </div>
            </div>
            <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-card">
              <UI.Stars value={avgRating} size={16} showNumber={false} />
              <div className="text-xs text-slate-600 mt-0.5"><span className="font-display font-bold text-slate-900">{avgRating.toFixed(1)}</span> · {store.reviews} ביקורות</div>
            </div>
          </div>
        </div>

        {/* Store info row */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="min-w-0">
            <p className="text-sm text-slate-700 leading-relaxed">{store.summary}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {store.tags.map(t => <span key={t} className="pill bg-slate-100 text-slate-700 text-[11px]">{t}</span>)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-xs text-slate-600">
              {store.phone && (
                <div className="flex items-center gap-1.5"><span className="w-7 h-7 rounded-md bg-slate-100 grid place-items-center text-slate-500"><I.MessageCircle size={13}/></span><span dir="ltr">{store.phone}</span></div>
              )}
              {store.hours && (
                <div className="flex items-center gap-1.5 sm:col-span-2"><span className="w-7 h-7 rounded-md bg-slate-100 grid place-items-center text-slate-500"><I.TrendUp size={13}/></span><span>{store.hours}</span></div>
              )}
            </div>
          </div>
          <button onClick={() => setComposerOpen(o => !o)}
            className="shrink-0 inline-flex items-center gap-1.5 bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-4 py-2 rounded-full shadow-card">
            {composerOpen ? <><I.X size={15}/> בטל</> : <><I.Plus size={15}/> כתוב ביקורת</>}
          </button>
        </div>
      </section>

      {composerOpen && <ReviewComposer onSubmit={() => setComposerOpen(false)} />}

      {/* Reviews summary */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5 items-center">
          <div className="text-center sm:border-l sm:border-slate-100 sm:pl-5">
            <div className="font-display font-bold text-5xl text-slate-900 leading-none">{avgRating.toFixed(1)}</div>
            <UI.Stars value={avgRating} size={18} showNumber={false} />
            <div className="text-xs text-slate-500 mt-1">{reviews.length} ביקורות מהקהילה</div>
          </div>
          <div className="space-y-1">
            {dist.map(d => (
              <div key={d.n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-slate-500 font-semibold">{d.n}</span>
                <I.StarSolid size={12} className="text-rust-500"/>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rust-500 rounded-full transition-all" style={{ width: `${(d.count / maxBar) * 100}%` }}></div>
                </div>
                <span className="w-6 text-slate-500 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sort + reviews list */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5">
        {[
          { id: 'recent',  label: 'אחרונות' },
          { id: 'highest', label: 'הגבוהות' },
          { id: 'lowest',  label: 'הנמוכות' },
        ].map(t => (
          <button key={t.id} onClick={() => setSort(t.id)}
            className={"flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition " +
                       (sort === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sortedReviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3">
              <I.Star size={24} className="text-slate-400"/>
            </div>
            <div className="font-display font-bold text-slate-900">אין עדיין ביקורות בקהילה</div>
            <p className="text-sm text-slate-500 mt-1">היה הראשון לכתוב על {store.name}.</p>
          </div>
        ) : sortedReviews.map(r => (
          <StoreReviewItem key={r.id} review={r} onOpenProfile={onOpenProfile} />
        ))}
      </div>
    </div>
  );
}

function StoreReviewItem({ review, onOpenProfile }) {
  return (
    <article className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => onOpenProfile && onOpenProfile(review.author.id)} className="rounded-full hover:ring-2 hover:ring-rust-500/30">
            <UI.Avatar person={review.author} size={40}/>
          </button>
          <div className="min-w-0">
            <button onClick={() => onOpenProfile && onOpenProfile(review.author.id)} className="font-bold text-slate-900 text-sm hover:text-rust-700 hover:underline">{review.author.name}</button>
            <div className="text-[11px] text-slate-500">{review.author.handle} · {HUB_DATA.timeAgo(review.minutesAgo)}</div>
          </div>
        </div>
        <div className="shrink-0">
          <UI.Stars value={review.rating} size={14} showNumber={true}/>
        </div>
      </div>
      <p className="mt-3 text-[15px] text-slate-800 leading-relaxed">{review.body}</p>
      {(review.pros?.length > 0 || review.cons?.length > 0) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {review.pros?.length > 0 && (
            <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-2.5">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">יתרונות</div>
              <ul className="mt-1 space-y-0.5">{review.pros.map(p => <li key={p} className="text-slate-700 text-xs">+ {p}</li>)}</ul>
            </div>
          )}
          {review.cons?.length > 0 && (
            <div className="rounded-lg bg-rust-50/60 border border-rust-100 p-2.5">
              <div className="text-[10px] font-bold text-rust-700 uppercase tracking-wider">חסרונות</div>
              <ul className="mt-1 space-y-0.5">{review.cons.map(c => <li key={c} className="text-slate-700 text-xs">– {c}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export const SECTIONS = { Marketplace, StoreReviews, Sidebar, MarketplaceTeaser, Store };
