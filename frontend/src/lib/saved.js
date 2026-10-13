// Save / unsave a post or a marketplace listing. Every card showing the same item
// stays in sync through a window event (e.g. unsaving in the Saved panel updates the feed).
import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth, requestLogin } from './auth.jsx';
import { toast } from './toast.jsx';

export const SAVED_EVENT = 'hh:saved';

const CALLS = {
  post:    { save: (id) => api.savePost(id),    unsave: (id) => api.unsavePost(id) },
  listing: { save: (id) => api.saveListing(id), unsave: (id) => api.unsaveListing(id) },
};

/** → [saved, toggle]. `toggle` asks a guest to log in; the change is optimistic and rolls back on error. */
export function useSaved(type, id, initial) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(!!initial);
  const busy = useRef(false);

  useEffect(() => { setSaved(!!initial); }, [initial]);
  useEffect(() => {
    const onChange = (e) => { if (e.detail.type === type && e.detail.id === id) setSaved(e.detail.saved); };
    window.addEventListener(SAVED_EVENT, onChange);
    return () => window.removeEventListener(SAVED_EVENT, onChange);
  }, [type, id]);

  const toggle = async () => {
    if (!user) { requestLogin(); return; }
    if (busy.current) return;
    busy.current = true;
    const next = !saved;
    setSaved(next);
    try {
      await CALLS[type][next ? 'save' : 'unsave'](id);
      window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { type, id, saved: next } }));
    } catch (e) {
      setSaved(!next);
      toast(e.message, 'error');
    } finally {
      busy.current = false;
    }
  };
  return [saved, toggle];
}
