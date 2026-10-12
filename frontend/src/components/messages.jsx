import React from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { UI } from './ui.jsx';
// Direct Messages — slide-in panel with conversation list + thread + new compose
const { useState: useStateMsg, useRef: useRefMsg, useEffect: useEffectMsg, useMemo: useMemoMsg } = React;

function MessagesPanel({ open, onClose, initialPersonId }) {
  const conversations = HUB_DATA.CONVERSATIONS;
  const [activeId, setActiveId] = useStateMsg(null);   // null = list view (mobile)
  const [composeOpen, setComposeOpen] = useStateMsg(false);
  const [drafts, setDrafts] = useStateMsg({});
  const [threadsState, setThreadsState] = useStateMsg(() =>
    Object.fromEntries(conversations.map(c => [c.id, { messages: c.messages, unread: c.unread }]))
  );

  // On desktop, default to first conversation
  useEffectMsg(() => {
    if (open && window.matchMedia('(min-width: 640px)').matches && !activeId) {
      setActiveId(conversations[0].id);
    }
  }, [open]);

  // When opened with a specific person, jump straight to that conversation
  // (or compose a new one if no thread exists yet)
  useEffectMsg(() => {
    if (!open || !initialPersonId) return;
    // 'you'/'hank' is the current user — can't DM yourself
    if (initialPersonId === 'you' || initialPersonId === 'hank') return;
    const existing = conversations.find(c => c.with.id === initialPersonId);
    if (existing) {
      setActiveId(existing.id);
      setComposeOpen(false);
    } else {
      // Synthesize a fresh thread for this person and open it
      const person = HUB_DATA.PEOPLE[initialPersonId];
      if (!person) return;
      const newId = 'c-new-' + initialPersonId;
      if (!conversations.find(c => c.id === newId)) {
        conversations.unshift({ id: newId, with: person, unread: 0, lastAt: 0, messages: [] });
      }
      setThreadsState(s => s[newId] ? s : ({ ...s, [newId]: { messages: [], unread: 0 } }));
      setActiveId(newId);
      setComposeOpen(false);
    }
  }, [open, initialPersonId]);

  const active = conversations.find(c => c.id === activeId);
  const thread = active && threadsState[activeId];
  const scrollRef = useRefMsg(null);

  useEffectMsg(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (open && thread?.unread > 0) {
      setThreadsState(s => ({ ...s, [activeId]: { ...s[activeId], unread: 0 } }));
    }
  }, [activeId, open, thread?.messages.length]);

  useEffectMsg(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') { activeId ? setActiveId(null) : onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, activeId]);

  const send = () => {
    const text = (drafts[activeId] || '').trim();
    if (!text) return;
    setThreadsState(s => ({
      ...s,
      [activeId]: { ...s[activeId], messages: [...s[activeId].messages, { from: 'me', at: 0, text }] },
    }));
    setDrafts(d => ({ ...d, [activeId]: '' }));
    if (active.agentReply) {
      setTimeout(() => {
        setThreadsState(s => ({
          ...s,
          [activeId]: {
            ...s[activeId],
            messages: [...s[activeId].messages, { from: 'them', at: 0, text: 'אני עובד על זה — תן לי רגע להכין השוואה מסודרת.' }],
          },
        }));
      }, 1200);
    }
  };

  if (!open) return null;

  const totalUnread = Object.values(threadsState).reduce((n, t) => n + t.unread, 0);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

      <aside className="fixed z-50 right-0 top-0 bottom-0 w-full sm:w-[640px] lg:w-[820px] bg-white shadow-pop flex overflow-hidden animate-in-rtl-msg">
        {/* Conversation list — hidden on mobile when a thread is active */}
        <div className={(activeId && !composeOpen ? "hidden sm:flex" : "flex") +
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
              <button onClick={() => { setComposeOpen(true); setActiveId(null); }}
                className="grid place-items-center w-9 h-9 rounded-full bg-rust-600 hover:bg-rust-700 text-white" title="הודעה חדשה">
                <I.Plus size={18} strokeWidth={2.5} />
              </button>
              <button onClick={onClose} className="grid place-items-center w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500" title="סגור">
                <I.X size={18} />
              </button>
            </div>
          </div>

          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-100 rounded-full pr-3 pl-2 h-9">
              <I.Search size={14} className="text-slate-500" />
              <input placeholder="חפש בהודעות…" className="bg-transparent outline-none flex-1 text-xs text-slate-800 placeholder:text-slate-500" />
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {conversations.map(c => {
              const t = threadsState[c.id];
              if (!t) return null;
              const last = t.messages[t.messages.length - 1];
              const isActive = c.id === activeId && !composeOpen;
              return (
                <li key={c.id}>
                  <button onClick={() => { setActiveId(c.id); setComposeOpen(false); }}
                    className={"w-full flex items-start gap-3 px-3 py-3 text-right border-r-2 transition " +
                               (isActive ? "bg-rust-50/50 border-rust-600"
                                         : "border-transparent hover:bg-slate-50")}>
                    <UI.Avatar person={c.with} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-slate-900 text-sm truncate">{c.with.name}</span>
                          {c.with.agent && <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-rust-300"><I.Bot size={9} strokeWidth={2.5}/></span>}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{last ? HUB_DATA.timeAgo(c.lastAt) : 'חדש'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={"text-xs truncate " + (t.unread > 0 ? "text-slate-900 font-semibold" : "text-slate-500")}>
                          {last
                            ? <>{last.from === 'me' && <span className="text-slate-400">את/ה: </span>}{last.text}</>
                            : <span className="italic text-slate-400">תחילת שיחה חדשה…</span>}
                        </p>
                        {t.unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rust-600 text-white text-[10px] font-bold grid place-items-center">{t.unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <button onClick={() => { setComposeOpen(true); setActiveId(null); }}
            className="m-2 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rust-600 hover:bg-rust-700 text-white text-sm font-bold shadow-card">
            <I.Plus size={16} strokeWidth={2.5} /> הודעה חדשה
          </button>
        </div>

        {/* Right pane — compose OR thread */}
        {composeOpen ? (
          <NewMessageCompose
            onCancel={() => setComposeOpen(false)}
            onStart={(personId, text) => {
              // Find existing or fall back to first
              let conv = conversations.find(c => c.with.id === personId);
              const id = conv ? conv.id : 'c1';
              setThreadsState(s => ({
                ...s,
                [id]: { ...s[id], messages: [...s[id].messages, { from: 'me', at: 0, text }] },
              }));
              setComposeOpen(false);
              setActiveId(id);
            }}
          />
        ) : (
          active && thread && (
            <div className="flex-1 hidden sm:flex flex-col bg-slate-50/30 min-w-0"
                 style={{ display: activeId ? undefined : undefined }}>
              <ThreadView active={active} thread={thread}
                          drafts={drafts} setDrafts={setDrafts}
                          send={send} scrollRef={scrollRef}
                          onBack={() => setActiveId(null)} onClose={onClose}
                          showBack={false} />
            </div>
          )
        )}

        {/* Mobile thread overlay */}
        {activeId && !composeOpen && active && thread && (
          <div className="flex-1 sm:hidden flex flex-col bg-slate-50/30 min-w-0 absolute inset-0 bg-white">
            <ThreadView active={active} thread={thread}
                        drafts={drafts} setDrafts={setDrafts}
                        send={send} scrollRef={scrollRef}
                        onBack={() => setActiveId(null)} onClose={onClose}
                        showBack={true} />
          </div>
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
function ThreadView({ active, thread, drafts, setDrafts, send, scrollRef, onBack, onClose, showBack }) {
  const activeId = active.id;
  return (
    <>
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
              <I.ChevronDown size={20} className="-rotate-90" />
            </button>
          )}
          <UI.Avatar person={active.with} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 truncate">{active.with.name}</span>
              {active.with.agent && <UI.AgentBadge />}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{active.with.handle} · {active.with.bio}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hidden sm:block"><I.X size={18} /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {active.with.agent && (
          <div className="mx-auto max-w-sm text-center text-[11px] text-slate-500 bg-rust-50 border border-rust-100 rounded-lg px-3 py-2">
            <I.Bot size={13} className="inline ml-1 text-rust-700" strokeWidth={2.5}/>
            את/ה משוחח/ת עם <b className="text-rust-700">חשבון סוכן</b>. התשובות נוצרות ע״י AI.
          </div>
        )}
        {thread.messages.length === 0 && (
          <div className="text-center text-[12px] text-slate-500 max-w-xs mx-auto bg-white rounded-xl border border-slate-200 px-3 py-3">
            תחילת השיחה שלך עם <b className="text-slate-800">{active.with.name}</b>.<br/>
            כתוב הודעה ראשונה כדי להתחיל.
          </div>
        )}
        {thread.messages.map((m, i) => (
          <ChatBubble key={i} message={m} person={active.with} prev={thread.messages[i-1]} />
        ))}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-3 py-2">
          <button className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><I.Image size={18} /></button>
          <textarea
            value={drafts[activeId] || ''}
            onChange={(e) => setDrafts(d => ({ ...d, [activeId]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`הודעה ל-${active.with.name.split(' ')[0]}…`}
            rows={1}
            dir="rtl"
            className="flex-1 bg-transparent outline-none resize-none text-sm text-slate-800 placeholder:text-slate-500 py-1.5 max-h-32" />
          <button onClick={send} disabled={!(drafts[activeId] || '').trim()}
            className="shrink-0 w-9 h-9 rounded-full bg-rust-600 hover:bg-rust-700 text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed">
            <I.Bolt size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5 mr-2">Enter לשליחה · Shift+Enter לשורה חדשה</div>
      </div>
    </>
  );
}

// ----- New message compose --------------------------------------------------
function NewMessageCompose({ onCancel, onStart }) {
  const [q, setQ] = useStateMsg('');
  const [picked, setPicked] = useStateMsg(null);
  const [text, setText] = useStateMsg('');

  const results = useMemoMsg(() => {
    const all = Object.values(HUB_DATA.PEOPLE);
    if (!q.trim()) return all.slice(0, 6);
    const qq = q.toLowerCase();
    return all.filter(p => p.name.toLowerCase().includes(qq) || p.handle.toLowerCase().includes(qq)).slice(0, 8);
  }, [q]);

  const canSend = picked && text.trim();

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0 absolute sm:relative inset-0">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="sm:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
            <I.ChevronDown size={20} className="-rotate-90" />
          </button>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base leading-none">הודעה חדשה</h3>
            <p className="text-[11px] text-slate-500 mt-1">בחר יוצר ושלח לו הודעה</p>
          </div>
        </div>
        <button onClick={onCancel} className="hidden sm:block p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><I.X size={18} /></button>
      </div>

      <div className="p-4 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-700">אל:</span>
        {picked ? (
          <div className="mt-1.5 inline-flex items-center gap-2 bg-rust-50 border border-rust-200 rounded-full pr-2 pl-1 py-1">
            <UI.Avatar person={picked} size={24} />
            <span className="text-sm font-bold text-slate-900">{picked.name}</span>
            <button onClick={() => setPicked(null)} className="w-6 h-6 grid place-items-center rounded-full hover:bg-rust-100 text-rust-700">
              <I.X size={12} strokeWidth={2.5}/>
            </button>
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-2 bg-slate-100 rounded-full pr-3 pl-2 h-10 border border-transparent focus-within:border-slate-300 focus-within:bg-white">
            <I.Search size={15} className="text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                   placeholder="חפש יוצר לפי שם או שם משתמש…"
                   className="bg-transparent outline-none flex-1 text-sm text-slate-800 placeholder:text-slate-500" />
          </div>
        )}
      </div>

      {!picked && (
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          <li className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
            {q.trim() ? 'תוצאות חיפוש' : 'מוצעים'}
          </li>
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500">לא נמצאו יוצרים.</li>
          ) : results.map(p => (
            <li key={p.id}>
              <button onClick={() => setPicked(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-right">
                <UI.Avatar person={p} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm truncate">{p.name}</span>
                    {p.agent && <UI.AgentBadge />}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{p.handle} · {p.bio}</div>
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
            {picked.agent && (
              <div className="mt-3 mx-auto max-w-sm text-center text-[11px] text-slate-500 bg-rust-50 border border-rust-100 rounded-lg px-3 py-2">
                <I.Bot size={13} className="inline ml-1 text-rust-700" strokeWidth={2.5}/>
                {picked.name} הוא <b className="text-rust-700">חשבון סוכן</b> — התשובות נוצרות ע״י AI.
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-3 py-2">
              <button className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><I.Image size={18} /></button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canSend) { e.preventDefault(); onStart(picked.id, text); } }}
                placeholder={`כתוב הודעה ל-${picked.name.split(' ')[0]}…`}
                rows={2}
                dir="rtl"
                className="flex-1 bg-transparent outline-none resize-none text-sm text-slate-800 placeholder:text-slate-500 py-1.5 max-h-32" />
              <button onClick={() => onStart(picked.id, text)} disabled={!canSend}
                className="shrink-0 w-9 h-9 rounded-full bg-rust-600 hover:bg-rust-700 text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed">
                <I.Bolt size={16} strokeWidth={2.5} />
              </button>
            </div>
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
        {message.text}
        <div className={"text-[10px] mt-1 " + (isMe ? "text-rust-100" : "text-slate-400")}>
          {message.at === 0 ? 'הרגע' : HUB_DATA.timeAgo(message.at)}
        </div>
      </div>
    </div>
  );
}

export { MessagesPanel as MessagesPanel };
