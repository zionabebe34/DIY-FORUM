// Tiny toast notifications: call toast('…') from anywhere; <Toaster/> renders them.
import React, { useEffect, useState } from 'react';

const EVENT = 'hh:toast';

// Show a short toast message ('ok' or 'error') from anywhere.
export function toast(message, kind = 'ok') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind, id: Date.now() + Math.random() } }));
}

// Renders the toasts at the bottom of the screen (each disappears after 3.5 s).
export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (e) => {
      const t = e.detail;
      setItems(list => [...list, t]);
      setTimeout(() => setItems(list => list.filter(x => x.id !== t.id)), 3500);
    };
    window.addEventListener(EVENT, add);
    return () => window.removeEventListener(EVENT, add);
  }, []);
  return (
    <div className="fixed bottom-4 inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4" aria-live="polite">
      {items.map(t => (
        <div key={t.id} role="status"
          className={"pointer-events-auto rounded-full shadow-pop px-4 py-2 text-sm font-bold " +
                     (t.kind === 'error' ? "bg-rust-700 text-white" : "bg-slate-900 text-white")}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
