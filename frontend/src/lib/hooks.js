import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cursor-paginated list ("lazy loading"). `fetchPage({ before })` must resolve
 * to { items, nextCursor }. The list resets whenever `deps` change.
 */
export function usePaginated(fetchPage, deps) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const generation = useRef(0);   // ignore responses from a previous `deps`
  const busy = useRef(false);

  const load = useCallback(async (before, gen) => {
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage({ before });
      if (gen !== generation.current) return;
      setItems(prev => {
        const seen = new Set(prev.map(x => x.id));
        return [...prev, ...page.items.filter(x => !seen.has(x.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor != null);
    } catch (e) {
      if (gen === generation.current) setError(e.message || 'שגיאה בטעינה');
    } finally {
      if (gen === generation.current) { busy.current = false; setLoading(false); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const gen = ++generation.current;
    setItems([]);
    setCursor(null);
    setHasMore(true);
    load(undefined, gen);
  }, [load]);

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore || error) return;
    load(cursor, generation.current);
  }, [load, cursor, hasMore, error]);

  const retry = useCallback(() => { setError(null); load(cursor ?? undefined, generation.current); }, [load, cursor]);
  const prepend = useCallback((item) => setItems(prev => [item, ...prev.filter(x => x.id !== item.id)]), []);
  const remove = useCallback((id) => setItems(prev => prev.filter(x => x.id !== id)), []);
  const update = useCallback((id, patch) => setItems(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x)), []);

  return { items, loading, hasMore, error, loadMore, retry, prepend, remove, update };
}

/** Calls `onVisible` when the returned ref's element scrolls near the viewport. */
export function useInfiniteScroll(onVisible, enabled) {
  const ref = useRef(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) cb.current();
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

/** Re-render every `ms` so "time ago" labels stay fresh. */
export function useNow(ms = 60000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
