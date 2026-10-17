// Store reviews — backed by /api/stores. Writing a review about a store that
// doesn't exist yet creates it; each user has one review per store (re-writing updates it).
import React, { useCallback, useEffect, useState } from 'react';
import { I } from './icons.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import { Spinner, ErrorRow } from './social.jsx';
import { api, minutesSince } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { toast } from '../lib/toast.jsx';

// ISO date → a casual Hebrew time-ago label.
const ago = (iso) => AN.timeAgoCasual(minutesSince(iso));

// --- Store list page --------------------------------------------------------
// The #/stores page: store cards and a "write a review" form (a new store is added automatically).
export function StoreReviews({ onOpenStore, onSign }) {
  const { user } = useAuth();
  const [composerOpen, setComposerOpen] = useState(false);
  const [stores, setStores] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.stores().then(setStores).catch(e => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const toggleComposer = () => (user ? setComposerOpen(o => !o) : onSign('login'));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900 inline-flex items-center gap-2">
            <I.Star size={22} className="text-rust-600" /> ביקורות חנויות
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">חנויות כלים, מחסני עץ וסיטונאים — דירוגים מהקהילה.</p>
        </div>
        <button onClick={toggleComposer}
          className="inline-flex items-center gap-2 bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-4 py-2 rounded-full shadow-card">
          {composerOpen ? <><I.X size={15}/> בטל</> : <><I.Plus size={15}/> כתוב ביקורת</>}
        </button>
      </div>

      {composerOpen && (
        <ReviewComposer onCancel={() => setComposerOpen(false)}
          onSaved={(storeId) => { setComposerOpen(false); toast('תודה! הביקורת פורסמה'); onOpenStore(storeId); }} />
      )}

      {error && <ErrorRow message={error} onRetry={load} />}
      {stores === null && !error && <Spinner />}
      {stores && stores.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
          <div className="font-display font-bold text-slate-900">עוד אין חנויות</div>
          <p className="text-sm text-slate-500 mt-1">כתבו ביקורת ראשונה — החנות תתווסף אוטומטית.</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(stores || []).map(s => <StoreCard key={s.id} store={s} onOpenStore={onOpenStore} />)}
      </div>
    </div>
  );
}

// --- Review form (new store, or an existing one when `store` is given) ------
// The review form: stars, text, pros / cons (a new store also needs a name + area).
function ReviewComposer({ store, onSaved, onCancel }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [area, setArea] = useState('');
  const [body, setBody] = useState('');
  const [pros, setPros] = useState(['']);
  const [cons, setCons] = useState(['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addLine = (setter) => () => setter(arr => [...arr, '']);
  const setLine = (setter) => (idx, val) => setter(arr => arr.map((a, i) => i === idx ? val : a));
  const removeLine = (setter) => (idx) => setter(arr => arr.length === 1 ? arr : arr.filter((_, i) => i !== idx));

  const canSubmit = (store || storeName.trim()) && rating > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const target = store ? { store_id: store.id } : { store_name: storeName.trim(), area: area.trim() };
      const r = await api.reviewStore({ ...target, rating, body: body.trim(),
                                        pros: pros.filter(p => p.trim()), cons: cons.filter(c => c.trim()) });
      onSaved(r.store_id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border-2 border-rust-500/30 shadow-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-9 h-9 rounded-lg bg-rust-600 text-white grid place-items-center"><I.Star size={18} strokeWidth={2.5} fill="currentColor"/></span>
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900">{store ? `ביקורת על ${store.name}` : 'כתיבת ביקורת חנות'}</h3>
          <p className="text-xs text-slate-500">{store ? 'אם כבר כתבת ביקורת כאן — היא תתעדכן.' : 'דרג חנות שאתה מכיר ועזור לקהילה.'}</p>
        </div>
      </div>

      {!store && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-700">שם החנות</span>
            <input value={storeName} onChange={e => setStoreName(e.target.value)} maxLength={120} placeholder="לדוגמה: פלדה ועץ" className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-700">אזור / כתובת</span>
            <input value={area} onChange={e => setArea(e.target.value)} maxLength={120} placeholder="פלורנטין, תל אביב" className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm" />
          </label>
        </div>
      )}

      <div className="mt-3">
        <span className="text-xs font-bold text-slate-700">הדירוג שלך</span>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="דירוג">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
                role="radio" aria-checked={rating === n} aria-label={`${n} כוכבים`}
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
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={3000} placeholder="ספר על השירות, המגוון, המחירים…"
          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm resize-y" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <LinesField label="יתרונות" tone="emerald" lines={pros} placeholder="לדוגמה: שירות מצוין" addLabel="הוסף יתרון"
          onChange={setLine(setPros)} onAdd={addLine(setPros)} onRemove={removeLine(setPros)} />
        <LinesField label="חסרונות" tone="rust" lines={cons} placeholder="לדוגמה: יקר" addLabel="הוסף חיסרון"
          onChange={setLine(setCons)} onAdd={addLine(setCons)} onRemove={removeLine(setCons)} />
      </div>

      {error && <div role="alert" className="mt-3 rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>}

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
        <button onClick={onCancel} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">ביטול</button>
        <button onClick={submit} disabled={!canSubmit}
          className="bg-rust-600 hover:bg-rust-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm px-5 py-2 rounded-full">
          {busy ? 'מפרסם…' : 'פרסם ביקורת'}
        </button>
      </div>
    </section>
  );
}

const TONES = {
  emerald: { label: 'text-emerald-700', input: 'focus:border-emerald-500 focus:ring-emerald-500/20', add: 'text-emerald-700' },
  rust:    { label: 'text-rust-700',    input: 'focus:border-rust-500 focus:ring-rust-500/20',       add: 'text-rust-700' },
};

// An editable list of short lines (pros or cons) with add / remove.
function LinesField({ label, tone, lines, placeholder, addLabel, onChange, onAdd, onRemove }) {
  const t = TONES[tone];
  return (
    <div>
      <span className={'text-xs font-bold ' + t.label}>{label}</span>
      <div className="space-y-1.5 mt-1">
        {lines.map((p, i) => (
          <div key={i} className="flex gap-1.5">
            <input value={p} onChange={e => onChange(i, e.target.value)} placeholder={placeholder} maxLength={80}
              className={'flex-1 rounded-lg border border-slate-200 focus:ring-2 outline-none px-2.5 py-1.5 text-sm ' + t.input} />
            {lines.length > 1 && (
              <button onClick={() => onRemove(i)} aria-label="הסר שורה" className="px-2 text-slate-400 hover:text-rust-600"><I.X size={14}/></button>
            )}
          </div>
        ))}
        <button onClick={onAdd} className={'text-xs font-semibold hover:underline inline-flex items-center gap-1 ' + t.add}>
          <I.Plus size={12}/> {addLabel}
        </button>
      </div>
    </div>
  );
}

// A store card in the list: cover, name, area, rating and review count.
function StoreCard({ store, onOpenStore }) {
  return (
    <button onClick={() => onOpenStore(store.id)}
      className="text-right w-full bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden hover:shadow-pop hover:border-slate-300 transition group">
      <div className={"relative h-28 " + store.bg}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"></div>
        <div className="absolute bottom-2 right-3 left-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display font-bold text-white text-lg leading-tight drop-shadow truncate">{store.name}</div>
            {store.area && <div className="text-xs text-white/85 inline-flex items-center gap-1"><I.MapPin size={11} /> {store.area}</div>}
          </div>
        </div>
        <span className="absolute top-3 left-3 pill bg-white/95 backdrop-blur text-slate-700 text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition">
          לעמוד החנות <I.ChevronDown size={10} className="-rotate-90"/>
        </span>
      </div>
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          {store.rating != null ? <UI.Stars value={store.rating} size={16} /> : <span className="text-xs text-slate-500">אין דירוג עדיין</span>}
          <div className="text-xs text-slate-500 mt-0.5">{store.reviews} ביקורות מיוצרים</div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {store.tags.map(t => <span key={t} className="pill bg-slate-100 text-slate-700 text-[11px]">{t}</span>)}
        </div>
      </div>
    </button>
  );
}

// --- Store detail page ------------------------------------------------------
// The #/store/<id> page: store details, rating histogram, sorted reviews and the review form.
export function Store({ storeId, onOpenProfile, onView, onSign }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');   // loading | ok | missing | error
  const [composerOpen, setComposerOpen] = useState(false);
  const [sort, setSort] = useState('recent');

  const load = useCallback(() => {
    api.store(storeId, sort)
      .then(d => { setData(d); setStatus('ok'); })
      .catch(e => setStatus(e.status === 404 ? 'missing' : 'error'));
  }, [storeId, sort]);
  useEffect(load, [load]);

  if (status === 'loading') return <Spinner />;
  if (status !== 'ok') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3">
          <I.ShoppingBag size={28} className="text-slate-400"/>
        </div>
        <div className="font-display font-bold text-slate-900">{status === 'missing' ? 'החנות לא נמצאה' : 'שגיאה בטעינת החנות'}</div>
        <button onClick={() => onView('stores')} className="mt-4 inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-full">
          חזרה לחנויות
        </button>
      </div>
    );
  }

  const { store, reviews, distribution } = data;
  const avgRating = store.rating ?? 0;
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, count: distribution[n] || 0 }));
  const maxBar = Math.max(1, ...dist.map(d => d.count));
  const myReview = user && reviews.find(r => r.author.username === user.username);

  const deleteReview = async (review) => {
    if (!window.confirm('למחוק את הביקורת?')) return;
    try { await api.deleteReview(review.id); toast('הביקורת נמחקה'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => onView('stores')} className="text-xs font-semibold text-slate-500 hover:text-rust-700 inline-flex items-center gap-1">
        <I.ChevronDown size={14} className="-rotate-90"/> חזרה לרשימת החנויות
      </button>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className={"relative h-40 sm:h-48 " + store.bg}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent"></div>
          <div className="absolute bottom-3 right-4 left-4 flex items-end justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-display font-bold text-white text-2xl sm:text-3xl drop-shadow leading-tight">{store.name}</h1>
              {(store.address || store.area) && (
                <div className="text-sm text-white/90 inline-flex items-center gap-1.5 mt-1 drop-shadow">
                  <I.MapPin size={13}/> {store.address || store.area}
                </div>
              )}
            </div>
            <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-card">
              <UI.Stars value={avgRating} size={16} showNumber={false} />
              <div className="text-xs text-slate-600 mt-0.5"><span className="font-display font-bold text-slate-900">{avgRating.toFixed(1)}</span> · {store.reviews} ביקורות</div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="min-w-0">
            {store.summary && <p className="text-sm text-slate-700 leading-relaxed">{store.summary}</p>}
            {store.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {store.tags.map(t => <span key={t} className="pill bg-slate-100 text-slate-700 text-[11px]">{t}</span>)}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-xs text-slate-600">
              {store.phone && (
                <div className="flex items-center gap-1.5"><span className="w-7 h-7 rounded-md bg-slate-100 grid place-items-center text-slate-500"><I.MessageCircle size={13}/></span><span dir="ltr">{store.phone}</span></div>
              )}
              {store.hours && (
                <div className="flex items-center gap-1.5 sm:col-span-2"><span className="w-7 h-7 rounded-md bg-slate-100 grid place-items-center text-slate-500"><I.TrendUp size={13}/></span><span>{store.hours}</span></div>
              )}
            </div>
          </div>
          <button onClick={() => (user ? setComposerOpen(o => !o) : onSign('login'))}
            className="shrink-0 inline-flex items-center gap-1.5 bg-rust-600 hover:bg-rust-700 text-white font-bold text-sm px-4 py-2 rounded-full shadow-card">
            {composerOpen ? <><I.X size={15}/> בטל</> : <><I.Plus size={15}/> {myReview ? 'ערוך את הביקורת שלי' : 'כתוב ביקורת'}</>}
          </button>
        </div>
      </section>

      {composerOpen && (
        <ReviewComposer store={store} onCancel={() => setComposerOpen(false)}
          onSaved={() => { setComposerOpen(false); toast('תודה! הביקורת פורסמה'); load(); }} />
      )}

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

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-1.5 flex gap-1.5">
        {[{ id: 'recent', label: 'אחרונות' }, { id: 'highest', label: 'הגבוהות' }, { id: 'lowest', label: 'הנמוכות' }].map(t => (
          <button key={t.id} onClick={() => setSort(t.id)} aria-pressed={sort === t.id}
            className={"flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition " +
                       (sort === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3">
              <I.Star size={24} className="text-slate-400"/>
            </div>
            <div className="font-display font-bold text-slate-900">אין עדיין ביקורות בקהילה</div>
            <p className="text-sm text-slate-500 mt-1">היה הראשון לכתוב על {store.name}.</p>
          </div>
        ) : reviews.map(r => (
          <StoreReviewItem key={r.id} review={r} onOpenProfile={onOpenProfile}
            onDelete={user && (user.username === r.author.username || user.isStaff) ? () => deleteReview(r) : null} />
        ))}
      </div>
    </div>
  );
}

// One review: author, stars, text, pros / cons and delete (author / staff).
function StoreReviewItem({ review, onOpenProfile, onDelete }) {
  const open = () => onOpenProfile(review.author.username);
  return (
    <article className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={open} className="rounded-full hover:ring-2 hover:ring-rust-500/30">
            <UI.Avatar person={review.author} size={40}/>
          </button>
          <div className="min-w-0">
            <button onClick={open} className="font-bold text-slate-900 text-sm hover:text-rust-700 hover:underline">{review.author.name}</button>
            <div className="text-[11px] text-slate-500"><bdi>{review.author.handle}</bdi> · {ago(review.createdAt)}</div>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <UI.Stars value={review.rating} size={14} showNumber={true}/>
          {onDelete && <button onClick={onDelete} aria-label="מחק ביקורת" className="p-1 text-slate-400 hover:text-rust-700"><I.Trash size={14}/></button>}
        </div>
      </div>
      {review.body && <p className="mt-3 text-[15px] text-slate-800 leading-relaxed whitespace-pre-line" dir="auto">{review.body}</p>}
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
