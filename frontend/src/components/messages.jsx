// Direct Messages — slide-in panel with conversation list + thread + new compose.
// Backed by /api/messages: each user sees only their own conversations; the open
// thread and the list refresh on a short interval so replies show up without a reload.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
import { AN } from './anims.jsx';
import { api, minutesSince } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useDebounced } from '../lib/hooks.js';

const THREAD_POLL_MS = 4000;
const LIST_POLL_MS = 8000;
const ago = (iso) => AN.timeAgoCasual(minutesSince(iso));

/**
 * `initial` (optional): { username, draft?, listing? } — open straight into a chat
 * with this person, e.g. from a profile ("הודעה") or a marketplace listing ("קנה עכשיו").
 */
function MessagesPanel({ open, onClose, initial, onUnreadChange }) {
  const { user } = useAuth();
  const [convos, setConvos] = useState(null);           // null = loading
  const [activeUser, setActiveUser] = useState(null);   // username of the open thread
  const [thread, setThread] = useState(null);           // { with, items }
  const [composeOpen, setComposeOpen] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [attached, setAttached] = useState({});         // username → listing the chat is about
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const threadRef = useRef(null);       // latest thread, read by the polling timer
  threadRef.current = thread;

  const loadConvos = useCallback(() => api.conversations().then(list => {
    setConvos(list);
    onUnreadChange && onUnreadChange(list.reduce((n, c) => n + c.unread, 0));
    return list;
  }).catch(() => setConvos(c => c || [])), [onUnreadChange]);

  // Open: load the list, then jump to the requested person (or the newest chat on desktop)
  useEffect(() => {
    if (!open || !user) return;
    setError('');
    loadConvos().then(list => {
      if (initial?.username && initial.username !== user.username) {
        setActiveUser(initial.username);
        setComposeOpen(false);
        if (initial.draft) setDrafts(d => ({ ...d, [initial.username]: d[initial.username] || initial.draft }));
        if (initial.listing) setAttached(a => ({ ...a, [initial.username]: initial.listing }));
      } else if (list?.length && window.matchMedia('(min-width: 640px)').matches) {
        setActiveUser(u => u || list[0].with.username);
      }
    });
  }, [open, initial, user, loadConvos]);

  // Load the active thread, then poll it for new messages
  useEffect(() => {
    if (!open || !activeUser) { setThread(null); return undefined; }
    let alive = true;
    setThread(null);
    api.thread(activeUser)
      .then(t => { if (alive) { setThread(t); loadConvos(); } })
      .catch(e => alive && setError(e.message));
    const timer = setInterval(() => {
      const t = threadRef.current;
      if (!t) return;
      const last = t.items[t.items.length - 1];
      api.thread(activeUser, last?.id).then(newer => {
        if (alive && newer.items.length) {
          setThread(cur => cur && ({ ...cur, items: [...cur.items, ...newer.items.filter(m => !cur.items.some(x => x.id === m.id))] }));
          loadConvos();
        }
      }).catch(() => {});
    }, THREAD_POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [open, activeUser, loadConvos]);

  // Keep the conversation list fresh while the panel is open
  useEffect(() => {
    if (!open || !user) return undefined;
    const timer = setInterval(loadConvos, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [open, user, loadConvos]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.items.length]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') { activeUser ? setActiveUser(null) : onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, activeUser, onClose]);

  const send = async (username = activeUser, text = drafts[username]) => {
    const body = (text || '').trim();
    if (!body) return;
    setError('');
    try {
      const listing = attached[username];
      const msg = await api.sendMessage(username, body, listing?.id);
      setDrafts(d => ({ ...d, [username]: '' }));
      setAttached(a => ({ ...a, [username]: null }));
      setThread(t => (t && t.with.username === username) ? { ...t, items: [...t.items, msg] } : t);
      loadConvos();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!open) return null;

  const totalUnread = (convos || []).reduce((n, c) => n + c.unread, 0);
  // A brand-new chat (no messages yet) isn't in the list — show it at the top while open
  const list = convos ? [...convos] : [];
  if (activeUser && thread && !list.some(c => c.with.username === activeUser)) {
    list.unshift({ with: thread.with, last: null, unread: 0 });
  }
  const threadProps = {
    thread, draft: drafts[activeUser] || '', listing: attached[activeUser],
    setDraft: (v) => setDrafts(d => ({ ...d, [activeUser]: v })),
    clearListing: () => setAttached(a => ({ ...a, [activeUser]: null })),
    send: () => send(), scrollRef, onBack: () => setActiveUser(null), onClose, error,
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

      <aside className="fixed z-50 right-0 top-0 bottom-0 w-full sm:w-[640px] lg:w-[820px] bg-white shadow-pop flex overflow-hidden animate-in-rtl-msg">
        {/* Conversation list — hidden on mobile when a thread is active */}
        <div className={(activeUser && !composeOpen ? "hidden sm:flex" : "flex") +
          " sm:w-[280px] sm:border-l border-slate-200 flex-col w-full"}>
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <span className="w-9 h-9 rounded-lg bg-slate-900 text-rust-400 grid place-items-center"><I.Mail size={18} strokeWidth={2.5} /></span>
              <div>
                <h2 className="font-display font-bold text-slate-900 text-base leading-none">הודעות</h2>
                <div className="text-[11px] text-slate-500 mt-1">{totalUnread > 0 ? `${totalUnread} לא נקראו` : 'הכל מעודכן'}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setComposeOpen(true); setActiveUser(null); }}
                className="grid place-items-center w-9 h-9 rounded-full bg-rust-600 hover:bg-rust-700 text-white" title="הודעה חדשה">
                <I.Plus size={18} strokeWidth={2.5} />
              </button>
              <button onClick={onClose} className="grid place-items-center w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500" title="סגור">
                <I.X size={18} />
              </button>
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {convos === null && <li className="px-4 py-6 text-center text-xs text-slate-500">טוען שיחות…</li>}
            {convos && list.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 grid place-items-center mb-2"><I.Mail size={20} className="text-slate-400"/></div>
                אין עדיין שיחות.<br/>התחילו שיחה חדשה או פנו למוכר מהשוק.
              </li>
            )}
            {list.map(c => {
              const isActive = c.with.username === activeUser && !composeOpen;
              return (
                <li key={c.with.username}>
                  <button onClick={() => { setActiveUser(c.with.username); setComposeOpen(false); }}
                    className={"w-full flex items-start gap-3 px-3 py-3 text-right border-r-2 transition " +
                               (isActive ? "bg-rust-50/50 border-rust-600" : "border-transparent hover:bg-slate-50")}>
                    <UI.Avatar person={c.with} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-slate-900 text-sm truncate">{c.with.name}</span>
                          {c.with.agent && <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-rust-300"><I.Bot size={9} strokeWidth={2.5}/></span>}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{c.last ? ago(c.last.createdAt) : 'חדש'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={"text-xs truncate " + (c.unread > 0 ? "text-slate-900 font-semibold" : "text-slate-500")}>
                          {c.last
                            ? <>{c.last.fromMe && <span className="text-slate-400">את/ה: </span>}{c.last.text}</>
                            : <span className="italic text-slate-400">תחילת שיחה חדשה…</span>}
                        </p>
                        {c.unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rust-600 text-white text-[10px] font-bold grid place-items-center">{c.unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <button onClick={() => { setComposeOpen(true); setActiveUser(null); }}
            className="m-2 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rust-600 hover:bg-rust-700 text-white text-sm font-bold shadow-card">
            <I.Plus size={16} strokeWidth={2.5} /> הודעה חדשה
          </button>
        </div>

        {/* Right pane — compose OR thread */}
        {composeOpen ? (
          <NewMessageCompose
            me={user}
            onCancel={() => setComposeOpen(false)}
            onStart={async (person, text) => {
              await send(person.username, text);
              setComposeOpen(false);
              setActiveUser(person.username);
            }}
            error={error}
          />
        ) : activeUser && (
          <>
            <div className="flex-1 hidden sm:flex flex-col bg-slate-50/30 min-w-0">
              <ThreadView {...threadProps} showBack={false} />
            </div>
            {/* Mobile thread overlay */}
            <div className="flex-1 sm:hidden flex flex-col min-w-0 absolute inset-0 bg-white">
              <ThreadView {...threadProps} showBack={true} />
            </div>
          </>
        )}
      </aside>

      <style>{`
        @keyframes slideRTLmsg { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-in-rtl-msg { animation: slideRTLmsg .2s ease-out; }
      `}</style>
    </>
  );
}

// ----- Thread view ----------------------------------------------------------
function ThreadView({ thread, draft, setDraft, listing, clearListing, send, scrollRef, onBack, onClose, showBack, error }) {
  if (!thread) {
    return <div className="flex-1 grid place-items-center text-sm text-slate-500">{error || 'טוען שיחה…'}</div>;
  }
  const other = thread.with;
  return (
    <>
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="חזרה לשיחות">
              <I.ChevronDown size={20} className="-rotate-90" />
            </button>
          )}
          <UI.Avatar person={other} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 truncate">{other.name}</span>
              {other.agent && <UI.AgentBadge />}
            </div>
            <div className="text-[11px] text-slate-500 truncate"><bdi>{other.handle}</bdi>{other.bio ? ` · ${other.bio}` : ''}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hidden sm:block" aria-label="סגור"><I.X size={18} /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {other.agent && (
          <div className="mx-auto max-w-sm text-center text-[11px] text-slate-500 bg-rust-50 border border-rust-100 rounded-lg px-3 py-2">
            <I.Bot size={13} className="inline ml-1 text-rust-700" strokeWidth={2.5}/>
            את/ה משוחח/ת עם <b className="text-rust-700">חשבון סוכן</b>.
          </div>
        )}
        {thread.items.length === 0 && (
          <div className="text-center text-[12px] text-slate-500 max-w-xs mx-auto bg-white rounded-xl border border-slate-200 px-3 py-3">
            תחילת השיחה שלך עם <b className="text-slate-800">{other.name}</b>.<br/>
            כתוב הודעה ראשונה כדי להתחיל.
          </div>
        )}
        {thread.items.map((m, i) => (
          <ChatBubble key={m.id} message={m} person={other} prev={thread.items[i - 1]} />
        ))}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        {listing && (
          <div className="flex items-center gap-2 mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <ListingThumb listing={listing} />
            <div className="min-w-0 flex-1 text-xs">
              <div className="text-slate-500">בנוגע למודעה:</div>
              <div className="font-bold text-slate-900 truncate">{listing.name}</div>
            </div>
            <button onClick={clearListing} className="p-1 text-slate-400 hover:text-slate-700" aria-label="הסר מודעה מצורפת"><I.X size={14}/></button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-3 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`הודעה ל-${other.name.split(' ')[0]}…`}
            aria-label="הודעה"
            rows={1}
            dir="auto"
            className="flex-1 bg-transparent outline-none resize-none text-sm text-slate-800 placeholder:text-slate-500 py-1.5 max-h-32" />
          <button onClick={send} disabled={!draft.trim()} aria-label="שלח"
            className="shrink-0 w-9 h-9 rounded-full bg-rust-600 hover:bg-rust-700 text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed">
            <I.Send size={16} strokeWidth={2.5} />
          </button>
        </div>
        {error && <div role="alert" className="text-xs text-rust-700 mt-1.5 mr-2">{error}</div>}
        <div className="text-[10px] text-slate-400 mt-1.5 mr-2">Enter לשליחה · Shift+Enter לשורה חדשה</div>
      </div>
    </>
  );
}

function ListingThumb({ listing }) {
  return listing.image
    ? <img src={listing.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
    : <div className={"w-10 h-10 rounded-lg shrink-0 " + (listing.bg || 'ph-steel')}></div>;
}

const listingPrice = (l) => l.listingType === 'lend' ? `${HUB_DATA.NIS(l.dailyPrice)} ליום` : HUB_DATA.NIS(l.price);

// ----- New message compose --------------------------------------------------
function NewMessageCompose({ me, onCancel, onStart, error }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const query = useDebounced(q.trim(), 250);

  useEffect(() => {
    let alive = true;
    (query ? api.searchUsers(query) : api.suggested())
      .then(list => alive && setResults(list.filter(p => p.username !== me?.username).slice(0, 8)))
      .catch(() => alive && setResults([]));
    return () => { alive = false; };
  }, [query, me?.username]);

  const canSend = picked && text.trim();

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0 absolute sm:relative inset-0">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="sm:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="חזרה">
            <I.ChevronDown size={20} className="-rotate-90" />
          </button>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base leading-none">הודעה חדשה</h3>
            <p className="text-[11px] text-slate-500 mt-1">בחר יוצר ושלח לו הודעה</p>
          </div>
        </div>
        <button onClick={onCancel} className="hidden sm:block p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="ביטול"><I.X size={18} /></button>
      </div>

      <div className="p-4 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-700">אל:</span>
        {picked ? (
          <div className="mt-1.5 inline-flex items-center gap-2 bg-rust-50 border border-rust-200 rounded-full pr-2 pl-1 py-1">
            <UI.Avatar person={picked} size={24} />
            <span className="text-sm font-bold text-slate-900">{picked.name}</span>
            <button onClick={() => setPicked(null)} aria-label="הסר נמען" className="w-6 h-6 grid place-items-center rounded-full hover:bg-rust-100 text-rust-700">
              <I.X size={12} strokeWidth={2.5}/>
            </button>
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-2 bg-slate-100 rounded-full pr-3 pl-2 h-10 border border-transparent focus-within:border-slate-300 focus-within:bg-white">
            <I.Search size={15} className="text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                   placeholder="חפש יוצר לפי שם משתמש…"
                   className="bg-transparent outline-none flex-1 text-sm text-slate-800 placeholder:text-slate-500" />
          </div>
        )}
      </div>

      {!picked && (
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          <li className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
            {query ? 'תוצאות חיפוש' : 'מוצעים'}
          </li>
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500">לא נמצאו יוצרים.</li>
          ) : results.map(p => (
            <li key={p.username}>
              <button onClick={() => setPicked(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-right">
                <UI.Avatar person={p} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm truncate">{p.name}</span>
                    {p.agent && <UI.AgentBadge />}
                  </div>
                  <div className="text-xs text-slate-500 truncate"><bdi>{p.handle}</bdi>{p.bio ? ` · ${p.bio}` : ''}</div>
                </div>
                <I.ChevronDown size={16} className="text-slate-400 -rotate-90" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <>
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/40">
            <div className="text-center text-[11px] text-slate-500 bg-white rounded-full inline-block px-3 py-1 border border-slate-200">
              זוהי תחילת השיחה שלך עם {picked.name}
            </div>
          </div>
          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-3 py-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canSend) { e.preventDefault(); onStart(picked, text); } }}
                placeholder={`כתוב הודעה ל-${picked.name.split(' ')[0]}…`}
                rows={2}
                dir="auto"
                className="flex-1 bg-transparent outline-none resize-none text-sm text-slate-800 placeholder:text-slate-500 py-1.5 max-h-32" />
              <button onClick={() => onStart(picked, text)} disabled={!canSend} aria-label="שלח"
                className="shrink-0 w-9 h-9 rounded-full bg-rust-600 hover:bg-rust-700 text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed">
                <I.Send size={16} strokeWidth={2.5} />
              </button>
            </div>
            {error && <div role="alert" className="text-xs text-rust-700 mt-1.5">{error}</div>}
          </div>
        </>
      )}
    </div>
  );
}

function ChatBubble({ message, person, prev }) {
  const isMe = message.from === 'me';
  const showAvatar = !isMe && (!prev || prev.from !== message.from);
  return (
    <div className={"flex items-end gap-2 " + (isMe ? "justify-end" : "justify-start")}>
      {!isMe && (showAvatar ? <UI.Avatar person={person} size={28} /> : <div className="w-7 shrink-0"></div>)}
      <div className={"max-w-[78%] px-3.5 py-2 text-sm leading-relaxed " +
                       (isMe
                         ? "bg-rust-600 text-white rounded-2xl rounded-bl-md"
                         : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-br-md")}>
        {message.listing && (
          <div className={"flex items-center gap-2 mb-2 rounded-lg p-1.5 " + (isMe ? "bg-white/15" : "bg-slate-50 border border-slate-200")}>
            <ListingThumb listing={message.listing} />
            <div className="min-w-0 text-xs">
              <div className="font-bold truncate">{message.listing.name}</div>
              <div className={isMe ? "text-rust-100" : "text-slate-500"}>{listingPrice(message.listing)}</div>
            </div>
          </div>
        )}
        <span className="whitespace-pre-line break-words" dir="auto">{message.text}</span>
        <div className={"text-[10px] mt-1 " + (isMe ? "text-rust-100" : "text-slate-400")}>
          {ago(message.createdAt)}{isMe && message.read ? ' · נקרא' : ''}
        </div>
      </div>
    </div>
  );
}

export { MessagesPanel as MessagesPanel };
