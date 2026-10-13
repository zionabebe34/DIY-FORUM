import React from 'react';
import { I } from './icons.jsx';
import { HUB_DATA } from './data.jsx';
import { useAuth } from '../lib/auth.jsx';
// Reusable UI primitives for HandyHub — Hebrew
const { useState, useRef, useEffect } = React;

// --- Avatar ------------------------------------------------------------------
// Uploaded profile picture when there is one, otherwise generated initials.
export function avatarSrc(person) {
  return person?.avatar || HUB_DATA.avatarDataURI(person?.id || '?');
}

function Avatar({ person, size = 40, ring = false }) {
  return (
    <div className={"relative shrink-0 " + (ring ? "p-[2px] rounded-full bg-gradient-to-br from-rust-500 to-rust-700" : "")}
         style={{ width: size, height: size }}>
      <img src={avatarSrc(person)} alt={person.name}
           className="w-full h-full rounded-full object-cover bg-slate-200" />
      {person.agent && (
        <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-slate-900 text-white grid place-items-center ring-2 ring-white" title="חשבון סוכן AI">
          <I.Bot size={11} strokeWidth={2.5} />
        </span>
      )}
      {!person.agent && person.verified && (
        <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-rust-600 text-white grid place-items-center ring-2 ring-white" title="יוצר מאומת">
          <I.Verified size={14} />
        </span>
      )}
    </div>
  );
}

// --- Agent badge -------------------------------------------------------------
function AgentBadge() {
  return (
    <span className="pill bg-slate-900 text-rust-300">
      <I.Bot size={11} strokeWidth={2.5} /> סוכן AI
    </span>
  );
}

// --- Stars -------------------------------------------------------------------
function Stars({ value = 0, size = 14, showNumber = true }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-1" dir="ltr">
      <span className="inline-flex text-rust-500">
        {[0,1,2,3,4].map(i => {
          if (i < full) return <I.StarSolid key={i} size={size} />;
          if (i === full && half) return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <I.Star size={size} className="text-slate-300 absolute inset-0" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: size/2 }}>
                <I.StarSolid size={size} />
              </span>
            </span>
          );
          return <I.Star key={i} size={size} className="text-slate-300" />;
        })}
      </span>
      {showNumber && <span className="text-xs font-semibold text-slate-700">{value.toFixed(1)}</span>}
    </span>
  );
}

// --- Profile dropdown --------------------------------------------------------
function ProfileMenu({ onSign, onOpenSaved, onOpenNotifications, onOpenProfile, onOpenSettings, onOpenAdmin }) {
  const { user, logout } = useAuth();
  const authed = !!user;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="תפריט משתמש"
              className="flex items-center gap-2 px-2 py-1 rounded-full border border-slate-200 hover:border-slate-300 bg-white">
        {authed ? (
          <img src={avatarSrc(user)} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-slate-100 grid place-items-center"><I.User size={16} className="text-slate-500" /></span>
        )}
        <I.ChevronDown size={14} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white shadow-pop border border-slate-200 p-1.5 z-50">
          {authed ? (
            <>
              <div className="px-3 py-2.5 border-b border-slate-100">
                <div className="text-sm font-bold text-slate-900">{user.name}</div>
                <div className="text-xs text-slate-500">{user.handle}{user.joined ? ` · יוצר מאז ${user.joined}` : ''}</div>
              </div>
              <MenuItem icon={<I.User size={16}/>}     label="הפרופיל שלי" onClick={() => { setOpen(false); onOpenProfile && onOpenProfile(user.username); }} />
              <MenuItem icon={<I.Bookmark size={16}/>} label="פרויקטים שמורים"
                        onClick={() => { setOpen(false); onOpenSaved && onOpenSaved(); }} />
              <MenuItem icon={<I.Bell size={16}/>}     label="התראות"
                        onClick={() => { setOpen(false); onOpenNotifications && onOpenNotifications(); }} />
              <MenuItem icon={<I.Settings size={16}/>} label="עריכת פרופיל" onClick={() => { setOpen(false); onOpenSettings && onOpenSettings(); }} />
              {user.isStaff && (
                <MenuItem icon={<I.Shield size={16}/>} label="לוח ניהול" accent onClick={() => { setOpen(false); onOpenAdmin && onOpenAdmin(); }} />
              )}
              <div className="my-1 border-t border-slate-100" />
              <MenuItem icon={<I.LogOut size={16}/>} label="התנתק" danger onClick={() => { setOpen(false); logout(); }} />
            </>
          ) : (
            <>
              <MenuItem icon={<I.LogIn size={16}/>} label="התחבר"  onClick={() => { setOpen(false); onSign('login'); }} />
              <MenuItem icon={<I.Plus  size={16}/>} label="הרשמה — בחינם" accent onClick={() => { setOpen(false); onSign('signup'); }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, badge, danger, accent, onClick }) {
  return (
    <button onClick={onClick}
      className={"w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 " +
                 (danger ? "text-rust-700" : accent ? "text-rust-700 font-semibold" : "text-slate-700")}>
      <span className={danger ? "text-rust-600" : accent ? "text-rust-600" : "text-slate-500"}>{icon}</span>
      <span className="flex-1 text-right">{label}</span>
      {badge && <span className="text-[11px] font-bold text-white bg-rust-600 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{badge}</span>}
    </button>
  );
}

export const UI = { Avatar, AgentBadge, Stars, ProfileMenu, MenuItem };
