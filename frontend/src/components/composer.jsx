import React from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
import { RichEditor } from './RichEditor.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { CATEGORY_OPTIONS } from './market.jsx';
import { PostCards } from './posts.jsx';
import { ComposerAssist, textToHtml } from './assist.jsx';
// Full post composer (Hebrew) — opens as a modal-style sheet
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

const PLACEHOLDER_BGS = ['ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night'];

// The new-post modal: project / tutorial (steps) / marketplace listing, with images, tags and the AI assistant.
// `sharedPost` → a "share" post: a few words + a preview of that post (no type tabs / images)
function PostComposer({ open, onClose, onCreated, onListingCreated, mode = 'project', sharedPost = null }) {
  const { user } = useAuth();
  const [bodyHtml, setBodyHtml] = useStateC('');   // rich text (project / tutorial)
  const [bodyText, setBodyText] = useStateC('');
  const [submitting, setSubmitting] = useStateC(false);
  const [error, setError] = useStateC('');
  const [openCount, setOpenCount] = useStateC(0);  // bumps to reset the editor
  const [editorContent, setEditorContent] = useStateC({ html: '', key: 0 });   // set by the writing assistant
  const [kind, setKind] = useStateC(mode);   // 'project' | 'tutorial' | 'tool'
  const [text, setText] = useStateC('');
  const [tagInput, setTagInput] = useStateC('');
  const [tags, setTags] = useStateC([]);
  const [media, setMedia] = useStateC([]);   // [{ type:'image', file, url, name }]
  const [steps, setSteps] = useStateC([{ title: '', note: '', thumb: 'ph-wood' }]);
  const [title, setTitle] = useStateC('');
  const [price, setPrice] = useStateC('');
  const [cond, setCond] = useStateC('יד שנייה — במצב טוב');
  const [category, setCategory] = useStateC('hand');
  // Tool listing extras
  const [listingType, setListingType] = useStateC('sale'); // 'sale' | 'lend'
  const [dailyPrice, setDailyPrice] = useStateC('');
  const [weeklyPrice, setWeeklyPrice] = useStateC('');
  const [deposit, setDeposit] = useStateC('');
  const fileRef = useRefC(null);
  const [dragOver, setDragOver] = useStateC(false);
  const requestCloseRef = useRefC(() => onClose());

  // reset on open
  useEffectC(() => {
    if (open) {
      setKind(sharedPost ? 'project' : mode);
      setText(''); setTagInput(''); setTags([]); setMedia([]);
      setBodyHtml(''); setBodyText(''); setError(''); setSubmitting(false); setOpenCount(c => c + 1);
      setSteps([{ title: '', note: '', thumb: 'ph-wood' }]);
      setTitle(''); setPrice(''); setCond('יד שנייה — במצב טוב');
      setListingType('sale'); setDailyPrice(''); setWeeklyPrice(''); setDeposit(''); setCategory('hand');
    }
  }, [open, mode, sharedPost]);

  // Release object-URL previews of removed / published images
  const mediaRef = useRefC(media);
  mediaRef.current = media;
  useEffectC(() => () => mediaRef.current.forEach(m => URL.revokeObjectURL(m.url)), []);

  // ESC to close
  useEffectC(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') requestCloseRef.current(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  if (!open) return null;
  const maxMedia = kind === 'tool' ? 1 : 6;    // a listing has a single photo

  // Don't silently throw away a draft (backdrop click / Esc / ✕ / ביטול)
  const hasDraft = bodyText.trim() || text.trim() || title.trim() || media.length || tags.length;
  const requestClose = () => {
    if (submitting) return;
    if (hasDraft && !window.confirm('לסגור ולמחוק את הטיוטה?')) return;
    onClose();
  };
  requestCloseRef.current = requestClose;

  const addTag = (raw) => {
    let t = raw.trim().replace(/^#/, '').replace(/\s+/g, '_');
    if (!t) return;
    if (!t.startsWith('#')) t = '#' + t;
    setTags(arr => arr.includes(t) ? arr : [...arr, t]);
    setTagInput('');
  };
  const removeTag = (t) => setTags(arr => arr.filter(x => x !== t));

  const onTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(arr => arr.slice(0, -1));
    }
  };

  const handleFiles = (files) => {
    const all = [...files];
    const images = all.filter(f => f.type.startsWith('image/'));
    if (images.length < all.length) setError('כרגע אפשר להעלות רק תמונות (JPG / PNG / GIF / WEBP)');
    const tooBig = images.filter(f => f.size > 5 * 1024 * 1024);
    if (tooBig.length) setError('כל תמונה עד 5MB');
    const ok = images.filter(f => f.size <= 5 * 1024 * 1024).slice(0, maxMedia - media.length);
    setMedia(m => [...m, ...ok.map(f => ({ type: 'image', file: f, name: f.name, url: URL.createObjectURL(f) }))]);
  };
  const removeMedia = (i) => setMedia(arr => {
    URL.revokeObjectURL(arr[i].url);
    return arr.filter((_, idx) => idx !== i);
  });
  const triggerFile = (type) => {
    const input = fileRef.current;
    input.accept = type === 'video' ? 'video/*' : 'image/*';
    input.dataset.kind = type;
    input.click();
  };
  const onPickedFile = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };
  // Drag & drop
  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const files = [...(e.dataTransfer.files || [])];
    if (files.length) handleFiles(files);
  };

  const setStep = (i, field, val) => setSteps(arr => arr.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const addStep = () => setSteps(arr => [...arr, { title: '', note: '', thumb: PLACEHOLDER_BGS[arr.length % PLACEHOLDER_BGS.length] }]);
  const removeStep = (i) => setSteps(arr => arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i));

  const canPublish = (() => {
    if (sharedPost)          return true;           // the shared post is the content; words are optional
    if (kind === 'project')  return bodyText.trim().length > 0 || media.length > 0;
    if (kind === 'tutorial') return title.trim() && steps.some(s => s.title.trim());
    if (kind === 'tool') {
      if (!title.trim()) return false;
      if (listingType === 'lend') return Number(dailyPrice) > 0;
      return Number(price) > 0;
    }
    return false;
  })();

  const publish = async () => {
    if (!canPublish || submitting) return;
    if (kind === 'tool') {
      const form = new FormData();
      form.append('listing_type', listingType);
      form.append('title', title);
      form.append('description', text);
      form.append('condition', cond);
      form.append('category', category);
      if (listingType === 'lend') {
        form.append('daily_price', dailyPrice);
        form.append('weekly_price', weeklyPrice);
        form.append('deposit', deposit);
      } else {
        form.append('price', price);
      }
      if (media[0]) form.append('image', media[0].file, media[0].name);
      setSubmitting(true);
      setError('');
      try {
        const listing = await api.createListing(form);
        onListingCreated && onListingCreated(listing);
        onClose();
      } catch (e) {
        setError(e.message);
        setSubmitting(false);
      }
      return;
    }
    const form = new FormData();
    form.append('kind', kind);
    form.append('body', bodyHtml);
    form.append('tags', JSON.stringify(tags));
    if (kind === 'tutorial') {
      form.append('title', title);
      form.append('steps', JSON.stringify(steps.filter(s => s.title.trim())));
    } else if (sharedPost) {
      form.append('shared_post_id', sharedPost.id);
    } else {
      media.forEach(m => form.append('images', m.file, m.name));
    }
    setSubmitting(true);
    setError('');
    try {
      const post = await api.createPost(form);
      onCreated && onCreated(post);
      onClose();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'project',  label: 'פרויקט',       icon: <I.Image size={15}/> },
    { id: 'tutorial', label: 'מדריך',        icon: <I.ListChecks size={15}/> },
    { id: 'tool',     label: 'מכירה/השאלה',  icon: <I.Tag size={15}/> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={requestClose}>
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <div className="bg-white rounded-2xl shadow-pop w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              {user && <UI.Avatar person={user} size={40}/>}
              <div>
                <h3 className="font-display font-bold text-xl text-slate-900">{sharedPost ? 'שיתוף פוסט' : 'פוסט חדש'}</h3>
                <p className="text-xs text-slate-500">מפרסם בתור <b>{user?.name}</b></p>
              </div>
            </div>
            <button onClick={requestClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><I.X size={18}/></button>
          </div>

          {/* Type tabs */}
          {!sharedPost && <div className="px-4 pt-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setKind(t.id)}
                  className={"flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition " +
                             (kind === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </div>}

          {/* Body */}
          <div className="p-4 space-y-3">
            {kind === 'tutorial' && (
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="איך נקרא למדריך?"
                className="w-full rounded-lg border-0 border-b-2 border-slate-100 focus:border-rust-500 focus:ring-0 outline-none px-1 py-2 font-display font-bold text-xl placeholder:text-slate-400"/>
            )}
            {kind === 'tool' && (
              <div className="space-y-3">
                {/* Sale / Lend toggle */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                  <div className="text-xs font-bold text-slate-700 mb-1.5 px-1">סוג פרסום</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => setListingType('sale')}
                      className={"flex items-center gap-2 p-2.5 rounded-lg border-2 text-right transition " +
                                 (listingType === 'sale'
                                   ? "border-rust-500 bg-white shadow-card"
                                   : "border-transparent bg-white/50 hover:bg-white")}>
                      <span className={"w-8 h-8 rounded-lg grid place-items-center " +
                                       (listingType === 'sale' ? "bg-rust-600 text-white" : "bg-slate-200 text-slate-500")}>
                        <I.Tag size={15} strokeWidth={2.5}/>
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">מכירה</div>
                        <div className="text-[11px] text-slate-500">העברת בעלות תמורת תשלום חד-פעמי</div>
                      </div>
                    </button>
                    <button onClick={() => setListingType('lend')}
                      className={"flex items-center gap-2 p-2.5 rounded-lg border-2 text-right transition " +
                                 (listingType === 'lend'
                                   ? "border-emerald-500 bg-white shadow-card"
                                   : "border-transparent bg-white/50 hover:bg-white")}>
                      <span className={"w-8 h-8 rounded-lg grid place-items-center " +
                                       (listingType === 'lend' ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500")}>
                        <I.Wrench size={15} strokeWidth={2.5}/>
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">השאלה</div>
                        <div className="text-[11px] text-slate-500">השכרה לפי יום/שבוע עם פיקדון</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">קטגוריה</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="קטגוריה"
                      className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm bg-white">
                      {CATEGORY_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">שם הכלי</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="DeWalt מברגת אימפקט 20V"
                      className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm"/>
                  </label>

                  {listingType === 'sale' ? (
                    <>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-700">מחיר (₪)</span>
                        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="320" dir="ltr"
                          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm text-right"/>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-700">מצב</span>
                        <select value={cond} onChange={(e) => setCond(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-rust-500 focus:ring-2 focus:ring-rust-500/20 outline-none px-3 py-2 text-sm bg-white">
                          <option>חדש</option>
                          <option>יד שנייה — כחדש</option>
                          <option>יד שנייה — במצב טוב</option>
                          <option>יד שנייה — סביר</option>
                          <option>יד שנייה — לחלקים</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="block">
                        <span className="text-xs font-bold text-emerald-700">מחיר ליום (₪)</span>
                        <input type="number" value={dailyPrice} onChange={(e) => setDailyPrice(e.target.value)} placeholder="60" dir="ltr"
                          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none px-3 py-2 text-sm text-right"/>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-emerald-700">מחיר לשבוע (₪)</span>
                        <input type="number" value={weeklyPrice} onChange={(e) => setWeeklyPrice(e.target.value)} placeholder="אופציונלי — חישוב אוטומטי" dir="ltr"
                          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none px-3 py-2 text-sm text-right"/>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-emerald-700">פיקדון (₪)</span>
                        <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="800" dir="ltr"
                          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none px-3 py-2 text-sm text-right"/>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-700">מצב הכלי</span>
                        <select value={cond} onChange={(e) => setCond(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none px-3 py-2 text-sm bg-white">
                          <option>מצוין — נבדק לפני</option>
                          <option>במצב טוב — נבדק</option>
                          <option>במצב סביר</option>
                        </select>
                      </label>
                      <div className="sm:col-span-2 rounded-lg bg-emerald-50/70 border border-emerald-100 p-2.5 text-[11.5px] text-emerald-900 leading-relaxed">
                        <b>איך עובדת השאלה?</b> השואל משלם את התעריף + מעביר פיקדון. בסוף ההשאלה — הכלי חוזר ואתה משחרר את הפיקדון. הכל מתועד בצ׳אט הפנימי.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {kind === 'tool' ? (
              <textarea
                value={text} onChange={(e) => setText(e.target.value)} rows={4}
                placeholder="איזה כלי? מה מצבו, ולמה אתה מוכר?"
                className="w-full text-[15px] outline-none resize-none placeholder:text-slate-400 py-1"/>
            ) : (
              <RichEditor
                key={kind}
                resetKey={openCount}
                content={editorContent.html} contentKey={editorContent.key}
                minHeight={kind === 'tutorial' ? '3.5rem' : '7rem'}
                placeholder={sharedPost ? 'מה דעתך? הוסיפו כמה מילים על הפוסט (לא חובה)…'
                             : kind === 'project' ? 'מה עשית היום? ספר על התהליך — מה הלך חלק, איפה התקעת…' : 'בקיצור — מה ילמדו פה?'}
                onChange={(html, plain) => { setBodyHtml(html); setBodyText(plain); }} />
            )}

            {/* sharing a share quotes the original (the server does the same) */}
            {kind !== 'tool' && (
              <ComposerAssist bodyHtml={bodyHtml} bodyText={bodyText} allowSuggest={kind === 'project' && !sharedPost}
                onReplace={(html) => setEditorContent(c => ({ html, key: c.key + 1 }))}
                onUseSuggestion={(d) => {
                  setEditorContent(c => ({ html: textToHtml(d.body), key: c.key + 1 }));
                  d.tags.forEach(t => addTag(t));
                }} />
            )}

            {sharedPost && <PostCards.SharedPostEmbed original={sharedPost.sharedPost || sharedPost} className="pointer-events-none" />}

            {/* Tutorial steps */}
            {kind === 'tutorial' && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <I.ListChecks size={14} className="text-rust-600"/> שלבי המדריך
                </div>
                {steps.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-200/80">
                    <div className={"relative w-12 h-12 rounded-md shrink-0 cursor-pointer " + s.thumb}
                         onClick={() => setStep(i, 'thumb', PLACEHOLDER_BGS[(PLACEHOLDER_BGS.indexOf(s.thumb)+1) % PLACEHOLDER_BGS.length])}
                         title="לחץ להחלפת תמונה">
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white grid place-items-center text-[10px] font-bold ring-2 ring-white">{i+1}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <input value={s.title} onChange={(e) => setStep(i, 'title', e.target.value)} placeholder={`כותרת שלב ${i+1}`}
                        className="w-full text-sm font-semibold outline-none placeholder:text-slate-400 border-b border-transparent focus:border-rust-500"/>
                      <input value={s.note} onChange={(e) => setStep(i, 'note', e.target.value)} placeholder="הערה / חומרים / כלים"
                        className="w-full text-xs text-slate-600 outline-none placeholder:text-slate-400 border-b border-transparent focus:border-rust-500"/>
                    </div>
                    {steps.length > 1 && (
                      <button onClick={() => removeStep(i)} className="p-1 text-slate-400 hover:text-rust-600"><I.X size={14}/></button>
                    )}
                  </div>
                ))}
                <button onClick={addStep} className="text-xs font-bold text-rust-700 hover:underline inline-flex items-center gap-1">
                  <I.Plus size={12}/> הוסף שלב
                </button>
              </div>
            )}

            {/* Media dropzone */}
            {kind !== 'tutorial' && !sharedPost && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={"rounded-xl border-2 border-dashed transition p-3 " +
                           (dragOver ? "border-rust-500 bg-rust-50" : "border-slate-200 bg-slate-50/40")}>
                {media.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white border border-slate-200 mb-2">
                      <I.Image size={22} className="text-slate-400"/>
                    </div>
                    <p className="text-sm text-slate-600">גרור לכאן תמונות או</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <button onClick={() => triggerFile('image')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-sm font-bold text-slate-700">
                        <I.Image size={14}/> תמונה
                      </button>
                      <button disabled title="העלאת וידאו — בקרוב" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-400 cursor-not-allowed">
                        <I.Video size={14}/> וידאו
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">{maxMedia === 1 ? 'תמונה אחת' : 'עד 6 תמונות'} · JPG/PNG/GIF/WEBP · עד 5MB כל אחת</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {media.map((m, i) => (
                        <div key={m.url} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                          <img src={m.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                          {m.type === 'video' && (
                            <span className="absolute inset-0 grid place-items-center text-white/90">
                              <I.PlayCircle size={32}/>
                            </span>
                          )}
                          <span className="absolute top-1.5 right-1.5 pill bg-white/95 text-slate-700 text-[10px]">
                            {m.type === 'video' ? <><I.Video size={10}/> וידאו</> : <><I.Image size={10}/> תמונה</>}
                          </span>
                          <button onClick={() => removeMedia(i)} aria-label="הסר תמונה"
                            className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
                            <I.X size={12} strokeWidth={3}/>
                          </button>
                          <div className="absolute bottom-1 inset-x-1 text-[10px] text-white/90 truncate font-medium drop-shadow">{m.name}</div>
                        </div>
                      ))}
                      {media.length < maxMedia && (
                        <button onClick={() => triggerFile('image')}
                          className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-rust-500 hover:bg-rust-50 grid place-items-center text-slate-400 hover:text-rust-600">
                          <I.Plus size={20}/>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] text-slate-500">{media.length}/{maxMedia} קבצים</div>
                      <div className="flex gap-1">
                        <button onClick={() => triggerFile('image')} className="text-xs font-bold text-rust-700 hover:underline inline-flex items-center gap-1"><I.Image size={12}/> הוסף תמונה</button>
                        
                      </div>
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickedFile}/>
              </div>
            )}

            {/* Tags */}
            <div className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <I.Hash size={14} className="text-rust-600"/>
                <span className="text-xs font-bold text-slate-700">תיוגים</span>
                <span className="text-[11px] text-slate-400">— Enter / פסיק להוספה</span>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-rust-50 text-rust-700 text-xs font-semibold pr-2 pl-1 py-1 rounded-md">
                    {t}
                    <button onClick={() => removeTag(t)} className="w-4 h-4 grid place-items-center rounded-sm hover:bg-rust-100">
                      <I.X size={10} strokeWidth={3}/>
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={onTagKey}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder={tags.length ? '' : 'תייגו: נגרות, אגוז, חוץ…'}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-slate-400 py-0.5"/>
              </div>
              {tags.length === 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 self-center">מוצעים:</span>
                  {['נגרות', 'מיקרובטון', 'ריתוך', 'שיפוצים', 'כלי_יד'].map(s => (
                    <button key={s} onClick={() => addTag(s)} className="text-[11px] font-semibold text-slate-600 hover:text-rust-700 bg-slate-100 hover:bg-rust-50 px-1.5 py-0.5 rounded">
                      #{s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div role="alert" className="mx-4 mb-3 rounded-lg bg-rust-50 border border-rust-200 text-rust-800 text-sm px-3 py-2">{error}</div>
          )}

          {/* Footer / publish */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
            <div className="text-[11px] text-slate-500">
              {kind === 'project' && `${bodyText.length} תווים${media.length ? ` · ${media.length} תמונות` : ''}`}
              {kind === 'tutorial' && `${steps.filter(s => s.title.trim()).length}/${steps.length} שלבים מלאים`}
              {kind === 'tool' && (
                listingType === 'lend'
                  ? (dailyPrice ? `${HUB_DATA.NIS(Number(dailyPrice))} / יום · השאלה` : 'הזן מחיר ליום')
                  : (price ? `${HUB_DATA.NIS(Number(price))} · ${cond}` : 'הזן מחיר')
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={requestClose} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2">ביטול</button>
              <button onClick={publish} disabled={!canPublish || submitting}
                className="bg-rust-600 hover:bg-rust-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm px-5 py-2 rounded-full inline-flex items-center gap-1.5 shadow-card">
                <I.Bolt size={14} strokeWidth={2.5}/> {submitting ? 'מפרסם…' : 'פרסם'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { PostComposer as PostComposer };
