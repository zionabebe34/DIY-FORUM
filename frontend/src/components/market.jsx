// Marketplace (tools for sale / lending) — backed by /api/listings.
// "Buy" / "Lend" / 💬 open a private chat with the seller, pre-filled with a price inquiry.
import React, { useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
import { Spinner, ErrorRow } from './social.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useInfiniteScroll, usePaginated } from '../lib/hooks.js';
import { toast } from '../lib/toast.jsx';

const CATEGORIES = [
  { id: 'all',      label: 'הכל' },
  { id: 'hand',     label: 'כלי יד' },
  { id: 'power',    label: 'כלים חשמליים' },
  { id: 'machines', label: 'מכונות' },
];
export const CATEGORY_OPTIONS = [...CATEGORIES.slice(1), { id: 'other', label: 'אחר' }];

/** The opening line of a buy / borrow inquiry. */
export function inquiryText(item) {
  return item.listingType === 'lend'
    ? `היי, אשמח לשאול את "${item.name}" (${HUB_DATA.NIS(item.dailyPrice)} ליום). מתי הוא פנוי, ואפשר לסגור מחיר?`
    : `היי, אני מעוניין/ת לקנות את "${item.name}" (${HUB_DATA.NIS(item.price)}). הוא עדיין זמין? אפשר הצעת מחיר?`;
}

// --- Marketplace grid (full page) -------------------------------------------
export function Marketplace({ onOpenProfile, onOpenComposer, onSign, onContact, refreshKey }) {
  const { user } = useAuth();
  const [category, setCategory] = useState('all');
  const [txType, setTxType] = useState('all');   // all | sale | lend
  const [counts, setCounts] = useState(null);

  const { items, loading, hasMore, error, loadMore, retry, remove } = usePaginated(async (opts) => {
    const page = await api.listings({ type: txType, category, ...opts });
    setCounts(page.counts);
    return page;
  }, [txType, category, refreshKey]);
  const sentinel = useInfiniteScroll(loadMore, hasMore && !loading && !error, items.length);

  const TX_TABS = [
    { id: 'all',  label: 'הכל',    icon: null,                                    count: counts?.all },
    { id: 'sale', label: 'למכירה', icon: <I.Tag size={13} strokeWidth={2.5}/>,    count: counts?.sale },
    { id: 'lend', label: 'להשאלה', icon: <I.Wrench size={13} strokeWidth={2.5}/>, count: counts?.lend },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900 inline-flex items-center gap-2">
            <I.ShoppingBag size={22} className="text-rust-600" /> שוק כלים
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">כלים יד שנייה וכלים להשאלה מיוצרים באזורך.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => user ? onOpenComposer('tool') : onSign('login')}
            className="inline-flex items-center gap-1.5 bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-4 py-2 rounded-full shadow-card">
            <I.Plus size={15} strokeWidth={2.5}/> פרסם מודעה
          </button>
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {CATEGORIES.map(f => (
              <button key={f.id} onClick={() => setCategory(f.id)} aria-pressed={category === f.id}
                className={"px-3 py-1.5 rounded-md text-xs font-semibold transition " +
                           (category === f.id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction-type tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5" role="tablist">
        {TX_TABS.map(t => (
          <button key={t.id} onClick={() => setTxType(t.id)} role="tab" aria-selected={txType === t.id}
            className={"flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition " +
                       (txType === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {t.icon}
            <span>{t.label}</span>
            {t.count != null && (
              <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
                               (txType === t.id ? "bg-rust-500 text-white" : "bg-slate-200 text-slate-600")}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {txType === 'lend' && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-lg bg-emerald-600 text-white grid place-items-center shrink-0"><I.Wrench size={20} strokeWidth={2.5}/></span>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-emerald-900">כלים להשאלה — קהילתי</div>
            <p className="text-sm text-emerald-800/85 mt-0.5">משלם ליום או לשבוע במקום לקנות כלים יקרים לפרויקט חד-פעמי. פיקדון מוחזר למשאיל בסוף ההשאלה.</p>
          </div>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3"><I.ShoppingBag size={24} className="text-slate-400"/></div>
          <div className="font-display font-bold text-slate-900">אין מודעות כאן עדיין</div>
          <p className="text-sm text-slate-500 mt-1">יש לכם כלי שלא בשימוש? פרסמו אותו למכירה או להשאלה.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(m => <MarketCard key={m.id} item={m} onOpenProfile={onOpenProfile} onContact={onContact} onDeleted={remove} />)}
      </div>
      {loading && <Spinner label="טוען מודעות…" />}
      {error && <ErrorRow message={error} onRetry={retry} />}
      <div ref={sentinel} />
    </div>
  );
}

// --- Marketplace teaser (inside feed) ---------------------------------------
export function MarketplaceTeaser({ onOpenProfile, onContact, onView }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let alive = true;
    api.listings({ limit: 4 }).then(p => alive && setItems(p.items)).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <I.ShoppingBag size={18} className="text-rust-600" />
          <h3 className="font-display font-bold text-slate-900">שוק כלים באזורך</h3>
          <span className="pill bg-emerald-50 text-emerald-700 text-[10px]"><I.Wrench size={10} strokeWidth={2.5}/> חדש: השאלות</span>
        </div>
        <button onClick={() => onView('marketplace')} className="text-xs font-semibold text-rust-700 hover:underline">לכל המוצרים ←</button>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        {items.map(m => <MarketCard key={m.id} item={m} compact onOpenProfile={onOpenProfile} onContact={onContact} />)}
      </div>
    </section>
  );
}

export function MarketCard({ item, compact, onOpenProfile, onContact, onDeleted }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const isLend = item.listingType === 'lend';
  const mine = user && user.username === item.seller.username;
  const canRemove = user && (mine || user.isStaff) && onDeleted;
  const openSeller = (e) => { e.stopPropagation(); onOpenProfile && onOpenProfile(item.seller.username); };
  const contact = () => onContact && onContact(item);
  const remove = async () => {
    if (!window.confirm(`למחוק את המודעה "${item.name}"?`)) return;
    setBusy(true);
    try {
      await api.deleteListing(item.id);
      toast('המודעה נמחקה');
      onDeleted(item.id);
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };
  const condLabel = item.cond.split('—')[1]?.trim() || item.cond;

  return (
    <article className="bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:border-slate-300 hover:shadow-card transition group">
      <div className={"relative aspect-square " + (item.image ? 'bg-slate-100' : item.bg)}>
        {item.image && <img src={item.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
        <span className={"absolute top-2 right-2 pill shadow-sm text-[10px] " +
                         (isLend ? "bg-emerald-600 text-white" : "bg-white/95 backdrop-blur text-slate-700")}>
          {isLend ? <><I.Wrench size={10} strokeWidth={2.5}/> להשאלה</> : <><I.Tag size={10} strokeWidth={2.5}/> {condLabel}</>}
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
          {item.seller.loc && <>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="inline-flex items-center gap-0.5"><I.MapPin size={10} /> {item.seller.loc}</span>
          </>}
        </button>
        {!compact && item.description && <p className="text-xs text-slate-600 line-clamp-2" dir="auto">{item.description}</p>}
        {isLend && !compact && (
          <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-600 bg-emerald-50/80 border border-emerald-100 rounded-md px-2 py-1">
            <span className="inline-flex items-center gap-1 font-semibold"><I.TrendUp size={10} className="text-emerald-600"/> {HUB_DATA.NIS(item.weeklyPrice)} / שבוע</span>
            <span>פיקדון {HUB_DATA.NIS(item.deposit)}</span>
          </div>
        )}
        {!compact && (mine ? (
          <div className="flex items-center justify-between gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500">המודעה שלך</span>
            {canRemove && (
              <button onClick={remove} disabled={busy}
                className="inline-flex items-center gap-1 text-xs font-bold text-rust-700 hover:bg-rust-50 rounded-md px-2 py-1 disabled:opacity-50">
                <I.Trash size={13}/> {busy ? 'מוחק…' : 'מחק'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-1.5 pt-1">
            <button onClick={contact}
              className={"flex-1 text-white text-xs font-bold rounded-md py-1.5 " +
                         (isLend ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rust-600 hover:bg-rust-700")}>
              {isLend ? 'השאל הכלי' : 'קנה עכשיו'}
            </button>
            <button onClick={contact} className="px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600"
              title={isLend ? 'שלח הודעה למשאיל' : 'שלח הודעה למוכר'} aria-label={isLend ? 'שלח הודעה למשאיל' : 'שלח הודעה למוכר'}>
              <I.MessageCircle size={14} />
            </button>
            {canRemove && (
              <button onClick={remove} disabled={busy} title="מחק (ניהול)" aria-label="מחק (ניהול)"
                className="px-2 rounded-md border border-slate-200 hover:bg-rust-50 text-rust-700"><I.Shield size={14}/></button>
            )}
          </div>
        ))}
        {compact && !mine && (
          <button onClick={contact}
            className={"w-full text-white text-[11px] font-bold rounded-md py-1 transition " +
                       (isLend ? "bg-emerald-700 hover:bg-emerald-800" : "bg-slate-900 hover:bg-rust-600")}>
            {isLend ? `השאל ${HUB_DATA.NIS(item.dailyPrice)}/יום` : `קנה ${HUB_DATA.NIS(item.price)}`}
          </button>
        )}
      </div>
    </article>
  );
}
