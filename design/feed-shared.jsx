// Shared utilities: animations, mock data, primitives shared across feed variants.
// All globals get a unique prefix to avoid scope collisions across babel scripts.

const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM, useCallback: useC } = React;

// ── PALETTE TOKENS ─────────────────────────────────────────────────────────
// Forest / workshop palette (committed in questions step)
const FR_TOKENS = {
  cream:   '#fbf6ec',   // base paper
  paper:   '#f4ecdc',   // recessed paper
  paperLo: '#ebe1cc',   // hairlines
  ink:     '#1a3a2e',   // deep forest — primary fg
  inkSoft: '#2f4d40',
  inkMute: '#5b7367',
  saffron: '#e8743b',   // primary accent
  dijon:   '#d4b96a',   // secondary
  brick:   '#a8472b',   // for caution / strong
};

// ── MAGNETIC BUTTON ────────────────────────────────────────────────────────
// Wraps any element so it slides toward the cursor on hover.
function MagneticBtn({ children, strength = 0.35, radius = 80, className = '', ...rest }) {
  const ref = useR(null);
  const innerRef = useR(null);
  const raf = useR(0);

  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius * 1.4) return; // ignore mousemove from far away
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      if (innerRef.current) innerRef.current.style.transform = `translate(${dx * strength * 0.5}px, ${dy * strength * 0.5}px)`;
    });
  };
  const reset = () => {
    cancelAnimationFrame(raf.current);
    if (ref.current) ref.current.style.transform = '';
    if (innerRef.current) innerRef.current.style.transform = '';
  };

  return (
    <button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={className}
      style={{ transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)', willChange: 'transform' }}
      {...rest}
    >
      <span ref={innerRef} style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)', willChange: 'transform' }}>
        {children}
      </span>
    </button>
  );
}

// ── COUNT UP ───────────────────────────────────────────────────────────────
// Animates a number from 0 → value when scrolled into view.
function CountUp({ value, duration = 1200, format = (n) => Math.round(n).toLocaleString('he-IL'), className = '', startDelay = 0 }) {
  const [n, setN] = useS(0);
  const ref = useR(null);
  const fired = useR(false);

  useE(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || fired.current) return;
      fired.current = true;
      const start = performance.now() + startDelay;
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        if (now < start) { requestAnimationFrame(tick); return; }
        const t = Math.min(1, (now - start) / duration);
        setN(value * ease(t));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(n)}</span>;
}

// ── LIKE BUTTON (with magnetic + soft pop) ─────────────────────────────────
function LikeBtn({ count, variant = 'workbench' }) {
  const [liked, setLiked] = useS(false);
  const [pop, setPop] = useS(false);
  const onClick = () => {
    setLiked(l => !l);
    if (!liked) {
      setPop(true);
      setTimeout(() => setPop(false), 600);
    }
  };
  const heart = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? FR_TOKENS.saffron : 'none'} stroke={liked ? FR_TOKENS.saffron : 'currentColor'} strokeWidth="2.2" style={{ transform: pop ? 'scale(1.3)' : 'scale(1)', transition: 'transform .35s cubic-bezier(.34,1.8,.64,1)' }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );

  const dots = pop && (
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {[0,1,2,3,4,5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <span key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5,
            borderRadius: '50%',
            background: i % 2 ? FR_TOKENS.saffron : FR_TOKENS.dijon,
            animation: `frBurst .55s ease-out forwards`,
            ['--bx']: `${Math.cos(a) * 22}px`,
            ['--by']: `${Math.sin(a) * 22}px`,
          }}/>
        );
      })}
    </span>
  );

  return (
    <MagneticBtn
      onClick={onClick}
      strength={0.5}
      className="fr-like"
      style={{
        position: 'relative',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '8px 12px', borderRadius: 10,
        color: liked ? FR_TOKENS.saffron : FR_TOKENS.inkSoft,
        fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
        transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)',
      }}>
      {heart}
      <span style={{ marginInlineStart: 6, fontVariantNumeric: 'tabular-nums' }}>{count + (liked ? 1 : 0)}</span>
      {dots}
    </MagneticBtn>
  );
}

// ── HOVER IMAGE REVEAL ─────────────────────────────────────────────────────
// An image-area placeholder with an overlay that slides in on hover.
// `mode`: 'bottom' | 'right' | 'mask'
function HoverReveal({ tone, label, sub, overlay, mode = 'bottom', height = 320, footer }) {
  const [hov, setHov] = useS(false);

  const tones = {
    walnut:  ['#7a3e1e','#a85a2b','#c9803f','#e8a96b'],
    oak:     ['#9c7a3f','#bd965a','#d6b074','#eccd92'],
    saffron: ['#9d3f15','#c4541e','#e8743b','#f29960'],
    sage:    ['#2f4d40','#446a58','#6c8b78','#a4baa9'],
    iron:    ['#2c2c2c','#4a4a4a','#6e6e6e','#959595'],
    paper:   ['#d8cdb4','#e3d9bf','#ece3cb','#f4ecd7'],
    forest:  ['#1a3a2e','#26513f','#3a6b54','#5c8b72'],
    brick:   ['#5c1e10','#84321c','#a8472b','#c66a4a'],
  };
  const [c1, c2, c3, c4] = tones[tone] || tones.walnut;

  let overlayStyle = {};
  if (mode === 'bottom') {
    overlayStyle = {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      transform: hov ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform .55s cubic-bezier(.22,1,.36,1)',
    };
  } else if (mode === 'right') {
    overlayStyle = {
      position: 'absolute', top: 0, bottom: 0, insetInlineEnd: 0, width: '64%',
      transform: hov ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform .55s cubic-bezier(.22,1,.36,1)',
    };
  } else if (mode === 'mask') {
    overlayStyle = {
      position: 'absolute', inset: 0,
      clipPath: hov ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)',
      transition: 'clip-path .6s cubic-bezier(.76,0,.24,1)',
    };
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        height, width: '100%',
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 40%, ${c3} 75%, ${c4} 100%)`,
      }}>
      {/* subtle grain */}
      <span aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: .25, mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .8 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
      }}/>
      {/* label / monospace */}
      <span style={{
        position: 'absolute', top: 12, insetInlineEnd: 12,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        fontSize: 10, color: 'rgba(255,255,255,.78)', letterSpacing: '.05em',
        padding: '4px 8px', border: '1px solid rgba(255,255,255,.4)', borderRadius: 4,
      }}>{label}</span>
      {sub && (
        <span style={{
          position: 'absolute', bottom: 12, insetInlineStart: 12,
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontSize: 10, color: 'rgba(255,255,255,.7)', letterSpacing: '.05em',
        }}>{sub}</span>
      )}
      {/* overlay */}
      <div style={overlayStyle}>{overlay}</div>
      {footer}
    </div>
  );
}

// ── MOCK DATA ──────────────────────────────────────────────────────────────
const FR_POSTS = [
  {
    id: 'p1',
    kind: 'tutorial',
    author: { id: 'noa',   name: 'נועה קרסיק',  handle: '@noa_makes',     followers: 8420,  verified: true, hue: 28 },
    minutesAgo: 24, location: 'תל-אביב · סדנה משותפת',
    title: 'החזרת חיים לקרש חיתוך מעץ אגוז — 4 שלבים',
    tone: 'walnut', overlayLabel: 'WALNUT · 24×38cm',
    stepCount: 4, estMinutes: 35,
    tags: ['#עץ', '#שיוף', '#שמן_מינרלי'],
    stats: { likes: 312, comments: 47, saves: 89 },
    blurb: 'הקרש הזה ירש סדקים אחרי שלוש שנות עבודה. במקום לזרוק — שייפתי, מילאתי, השריתי בשמן. תוצאה משונה, בכוונה.',
  },
  {
    id: 'p2',
    kind: 'project',
    author: { id: 'yoav',  name: 'יואב מירזא',  handle: '@yoav_metal',    followers: 1840,  verified: false, hue: 14 },
    minutesAgo: 105, location: 'באר-שבע',
    title: 'כיסא ילדים מפיגומי בנייה ממוחזרים',
    tone: 'saffron', overlayLabel: 'STEEL · POWDER-COATED',
    tags: ['#מתכת', '#ריהוט', '#מיחזור'],
    stats: { likes: 891, comments: 124, saves: 233 },
    blurb: 'לקחתי שלושה חיבורי פיגום שנמצאו ליד אתר בנייה. ריתוך, שיוף, צבע אבקה כתום. עכשיו זה כיסא של הבת שלי.',
  },
  {
    id: 'p3',
    kind: 'review',
    author: { id: 'gali',  name: 'גלי בן-עמי',  handle: '@gali_b',        followers: 2310,  verified: false, hue: 140 },
    minutesAgo: 280, location: 'חיפה',
    shop: { name: 'הברזל של אלי', area: 'הדר · רחוב הקישון', rating: 4.5 },
    tone: 'iron', overlayLabel: 'SHOP · HADAR / HAIFA',
    tags: ['#חנויות', '#חיפה', '#כלי_עבודה'],
    stats: { likes: 156, comments: 28, saves: 41 },
    blurb: 'בדקתי את החנות בשביל מקדחי SDS איכותיים. המחירים בסדר, היחס מצוין, אבל המבחר באזמלים מוגבל.',
  },
  {
    id: 'p4',
    kind: 'project',
    author: { id: 'eden',  name: 'עדן רוזנברג', handle: '@eden_makes',    followers: 5620,  verified: true, hue: 95 },
    minutesAgo: 410, location: 'ירושלים · שכונת הקטמונים',
    title: 'מנורת קיר מצינור נחושת — סקיצה לאב-טיפוס',
    tone: 'sage', overlayLabel: 'COPPER · 15mm Ø',
    tags: ['#תאורה', '#נחושת', '#אב_טיפוס'],
    stats: { likes: 1240, comments: 198, saves: 412 },
    blurb: 'התחיל מסקיצה על מפית, נגמר ב-CAD. בדרך גיליתי שאני לא יודע להלחים כלום — סרטוני YouTube ארוכים מאוד.',
  },
];

// Expose
Object.assign(window, { FR_TOKENS, FR_POSTS, MagneticBtn, CountUp, LikeBtn, HoverReveal });
