// V3 — BULLETIN (minimal, list-driven)
// Horizontal post rows, image on the inline-start (RTL = right side visually),
// HoverReveal in 'mask' mode (clip-path sweep), generous whitespace,
// magnetic inline actions reveal on hover.

const { useState: useS3 } = React;
const fr3 = FR_TOKENS;

function MonoLabel({ children, color }) {
  return (
    <span style={{
      fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
      letterSpacing: '.18em', color: color || fr3.inkMute,
      textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function HairlineAvatar({ person, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, oklch(.75 .12 ${person.hue}), oklch(.45 .14 ${(person.hue + 40) % 360}))`,
      display: 'grid', placeItems: 'center',
      color: fr3.cream, fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
      fontSize: size * 0.45,
      flexShrink: 0,
    }}>
      {person.name.charAt(0)}
    </div>
  );
}

// ── HEADER ─────────────────────────────────────────────────────────────────
function HeaderV3() {
  return (
    <header style={{
      background: fr3.cream,
      padding: '24px 40px 18px',
      borderBottom: `1px solid ${fr3.paperLo}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{
            fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 800,
            fontSize: 36, color: fr3.ink, lineHeight: 1, letterSpacing: '-0.04em',
          }}>HandyHub</span>
          <MonoLabel>BULLETIN · NO. 047</MonoLabel>
        </div>
        <MonoLabel color={fr3.ink}>{new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</MonoLabel>
      </div>

      {/* Tab strip */}
      <div style={{
        marginTop: 18, display: 'flex', alignItems: 'center', gap: 24,
        borderTop: `1px solid ${fr3.paperLo}`, paddingTop: 12,
      }}>
        {['היום', 'מעקב', 'תגיות', 'שמורים', 'ארכיון'].map((t, i) => (
          <button key={t} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: i === 0 ? 700 : 500,
            color: i === 0 ? fr3.ink : fr3.inkMute,
            padding: 0, position: 'relative', paddingBottom: 4,
            borderBottom: i === 0 ? `2px solid ${fr3.saffron}` : '2px solid transparent',
          }}>{t}</button>
        ))}
        <div style={{ flex: 1 }}/>
        <MagneticBtn strength={0.4} style={{
          background: fr3.ink, color: fr3.cream,
          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
          padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
          border: 'none',
        }}>+ פוסט חדש</MagneticBtn>
      </div>
    </header>
  );
}

// ── COMPACT COMPOSER ───────────────────────────────────────────────────────
function ComposerV3() {
  return (
    <div style={{
      padding: '18px 0',
      borderBottom: `1px solid ${fr3.paperLo}`,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <HairlineAvatar person={{ name: 'דניאל', hue: 18 }} size={36}/>
      <input placeholder="כתוב משהו, או שתף פרויקט…" style={{
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        fontFamily: '"Frank Ruhl Libre", serif', fontSize: 19,
        color: fr3.ink, fontStyle: 'italic',
      }}/>
      <MonoLabel>↵ ENTER</MonoLabel>
    </div>
  );
}

// ── POST ROW ───────────────────────────────────────────────────────────────
function PostV3({ post, idx }) {
  const [hov, setHov] = useS3(false);
  const kindLabel =
    post.kind === 'tutorial' ? 'מדריך' :
    post.kind === 'review'   ? 'ביקורת' : 'פרויקט';

  const title = post.kind === 'review' ? post.shop.name : post.title;

  // Mask-style sweep overlay
  const overlay = (
    <div style={{
      background: `linear-gradient(135deg, ${fr3.ink} 0%, ${fr3.inkSoft} 100%)`,
      height: '100%', display: 'grid', placeItems: 'center',
      color: fr3.cream,
    }}>
      <div style={{ textAlign: 'center', padding: 16 }}>
        <div style={{
          fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
          fontSize: 24, color: fr3.dijon, marginBottom: 6,
        }}>פתח</div>
        <MonoLabel color={fr3.cream}>← לחץ לקריאה</MonoLabel>
      </div>
    </div>
  );

  return (
    <article
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '24px 0',
        borderBottom: `1px solid ${fr3.paperLo}`,
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: 24,
        cursor: 'pointer',
        position: 'relative',
      }}>
      {/* Index number */}
      <span style={{
        position: 'absolute', insetInlineEnd: -38, top: 28,
        fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
        fontSize: 14, color: fr3.inkMute,
        fontVariantNumeric: 'tabular-nums',
      }}>{String(idx + 1).padStart(2, '0')}</span>

      {/* Image (square) */}
      <div style={{ width: 180, height: 180, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
        <HoverReveal tone={post.tone} label={post.overlayLabel} height={180} mode="mask" overlay={overlay}/>
      </div>

      {/* Content */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MonoLabel color={fr3.saffron}>{kindLabel}</MonoLabel>
          <span style={{ width: 12, height: 1, background: fr3.paperLo }}/>
          <MonoLabel>{post.minutesAgo < 60 ? `${post.minutesAgo} דק' אחרי` : `${Math.round(post.minutesAgo/60)} שעות אחרי`}</MonoLabel>
          <span style={{ width: 12, height: 1, background: fr3.paperLo }}/>
          <MonoLabel>{post.location}</MonoLabel>
        </div>

        {/* Title */}
        <h2 style={{
          margin: 0,
          fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
          fontSize: 26, color: fr3.ink, lineHeight: 1.15, letterSpacing: '-0.02em',
          textWrap: 'pretty',
        }}>
          {title}
          <span style={{
            display: 'inline-block', marginInlineStart: 8, opacity: hov ? 1 : 0,
            transform: hov ? 'translateX(0)' : 'translateX(8px)',
            transition: 'all .35s cubic-bezier(.22,1,.36,1)',
            color: fr3.saffron,
          }}>←</span>
        </h2>

        {/* Blurb */}
        <p style={{
          margin: 0,
          fontFamily: '"Assistant", sans-serif', fontSize: 14.5,
          color: fr3.inkSoft, lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{post.blurb}</p>

        {/* Author + counts row */}
        <div style={{
          marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HairlineAvatar person={post.author} size={26}/>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: fr3.ink }}>{post.author.name}</span>
              <MonoLabel>
                <CountUp value={post.author.followers} duration={1400} startDelay={idx * 120}
                         format={n => Math.round(n).toLocaleString('he-IL')}/> עוקבים
              </MonoLabel>
            </div>
          </div>

          {/* Reveal-on-hover actions */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            opacity: hov ? 1 : 0.5,
            transform: hov ? 'translateX(0)' : 'translateX(8px)',
            transition: 'all .35s cubic-bezier(.22,1,.36,1)',
          }}>
            <LikeBtn count={post.stats.likes}/>
            <MagneticBtn strength={0.4} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '8px 12px', borderRadius: 10, color: fr3.inkSoft,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8.5 8.5 0 0 1-12.5 7.5L3 21l1.5-5.5A8.5 8.5 0 1 1 21 12z"/></svg>
              <span style={{ marginInlineStart: 6 }}>{post.stats.comments}</span>
            </MagneticBtn>
            <MagneticBtn strength={0.4} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '8px 12px', borderRadius: 10, color: fr3.inkSoft,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </MagneticBtn>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {post.tags.map(t => (
            <span key={t} style={{
              fontFamily: '"IBM Plex Mono", monospace', fontSize: 11,
              color: fr3.inkMute,
            }}>{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

// ── FEED ROOT ──────────────────────────────────────────────────────────────
function FeedV3() {
  return (
    <div style={{
      background: fr3.cream,
      color: fr3.ink,
      fontFamily: '"Assistant", sans-serif',
      minHeight: '100%',
    }}>
      <HeaderV3/>
      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '0 40px 60px',
      }}>
        <ComposerV3/>
        {FR_POSTS.map((p, i) => <PostV3 key={p.id} post={p} idx={i}/>)}
      </div>
    </div>
  );
}

window.FeedV3 = FeedV3;
