import React from 'react';
import { I } from './icons.jsx';
// HandyHub editorial animations
// Exposes: window.AN.{ CountUp, LikeHeart, ImageReveal }
// No magnetic buttons. Just: count-up on numbers, soft pop on the heart,
// hover overlay-reveal on images.

const { useState: useStateAN, useEffect: useEffectAN, useRef: useRefAN } = React;

// ── CountUp ─────────────────────────────────────────────────────────────────
// Drop-in span that animates 0 → value when scrolled into view.
function CountUp({ value, duration = 1100, startDelay = 0, format, className = '', ...rest }) {
  const [n, setN] = useStateAN(0);
  const ref = useRefAN(null);
  const fired = useRefAN(false);
  const target = useRefAN(value);       // the animation always lands on the latest value
  target.current = value;
  const fmt = format || ((x) => Math.round(x).toLocaleString('he-IL'));

  useEffectAN(() => {
    if (fired.current) { setN(value); return; }   // already animated → just follow the new value
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || fired.current) return;
      fired.current = true;
      const start = performance.now() + startDelay;
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        if (now < start) { requestAnimationFrame(tick); return; }
        const t = Math.min(1, (now - start) / duration);
        setN(target.current * ease(t));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref} className={"tabnum " + className} {...rest}>{fmt(n)}</span>;
}

// ── LikeHeart ──────────────────────────────────────────────────────────────
// A heart button with: filled-toggle, scale-pop animation, and 6-dot burst.
// onToggle gets the new liked state.
function LikeHeart({ liked, onToggle, count, size = 18 }) {
  const [burst, setBurst] = useStateAN(0); // bump to retrigger
  const [popping, setPopping] = useStateAN(false);
  const handleClick = (e) => {
    e.stopPropagation();
    const next = !liked;
    if (next) {
      setBurst(b => b + 1);
      setPopping(true);
      setTimeout(() => setPopping(false), 480);
    }
    onToggle && onToggle(next);
  };
  return (
    <button onClick={handleClick}
      className={"relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition " +
                 (liked ? "text-rust-600 font-semibold" : "text-slate-600")}>
      <span className={popping ? "heart-pop inline-flex" : "inline-flex"} key={burst}>
        <I.Heart size={size} fill={liked ? 'currentColor' : 'none'} />
      </span>
      <span className="text-sm font-semibold tabnum">{Number(count || 0).toLocaleString('he-IL')}</span>
      {burst > 0 && (
        <span key={'b' + burst} aria-hidden="true"
              className="pointer-events-none absolute inset-0">
          {[0,1,2,3,4,5].map(i => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <span key={i} className="like-burst-dot absolute" style={{
                left: '50%', top: '50%', width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5,
                borderRadius: '50%',
                background: i % 2 ? '#ea580c' : '#f59e0b',
                '--bx': Math.cos(a) * 20 + 'px',
                '--by': Math.sin(a) * 20 + 'px',
              }}/>
            );
          })}
        </span>
      )}
    </button>
  );
}

// ── ImageReveal ────────────────────────────────────────────────────────────
// Wrap any image-area with a slide-up overlay that reveals on hover.
// children = the image (positioned absolute inset-0 inside).
// overlay  = the slide-up content.
function ImageReveal({ className = '', overlay, children, height }) {
  return (
    <div className={"img-reveal " + className} style={height ? { height } : null}>
      <div className="img-reveal-zoom absolute inset-0">{children}</div>
      <div className="img-reveal-overlay">{overlay}</div>
    </div>
  );
}

// ── Time formatter (casual, Facebook-ish) ──────────────────────────────────
// Minutes → a short casual Hebrew time-ago label (now, minutes, hours, yesterday … years).
function timeAgoCasual(min) {
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  if (d === 1) return 'אתמול';
  if (d < 7) return `לפני ${d} ימים`;
  const w = Math.round(d / 7);
  if (w === 1) return 'לפני שבוע';
  if (d < 30) return `לפני ${w} שבועות`;
  const m = Math.floor(d / 30);
  if (m === 1) return 'לפני חודש';
  if (m < 12) return `לפני ${m} חודשים`;
  const y = Math.floor(d / 365);
  return y === 1 ? 'לפני שנה' : `לפני ${y} שנים`;
}

export const AN = { CountUp, LikeHeart, ImageReveal, timeAgoCasual };
