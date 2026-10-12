// V1 — WORKBENCH (editorial)
// Cream paper cards, Frank Ruhl Libre display, monospace metadata,
// HoverReveal in 'bottom' mode, magnetic actions, count-up follower counts.
const { useState: useS1, useEffect: useE1 } = React;

// ── helper bits ────────────────────────────────────────────────────────────
const fr1 = FR_TOKENS;

function AuthorAvatar({ person, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `conic-gradient(from ${person.hue}deg at 50% 50%, oklch(.7 .12 ${person.hue}), oklch(.55 .14 ${(person.hue + 60) % 360}), oklch(.7 .12 ${person.hue}))`,
      display: 'grid', placeItems: 'center',
      color: '#fff', fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
      fontSize: size * 0.42, letterSpacing: '-0.02em',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.1)',
      flexShrink: 0,
    }}>
      {person.name.charAt(0)}
    </div>
  );
}

function Tag1({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 11, color: fr1.inkSoft,
      padding: '3px 8px', border: `1px solid ${fr1.paperLo}`,
      borderRadius: 999, letterSpacing: '-0.01em',
    }}>{children}</span>
  );
}

function MetaRow({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 11, color: fr1.inkMute, letterSpacing: '-0.01em',
    }}>{children}</div>
  );
}

function Dot() { return <span style={{ width: 3, height: 3, borderRadius: '50%', background: fr1.inkMute, opacity: .5 }}/>; }

// ── HEADER (sticky-feel) ───────────────────────────────────────────────────
function HeaderV1() {
  return (
    <header style={{
      background: fr1.cream,
      borderBottom: `1px solid ${fr1.paperLo}`,
      padding: '20px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 8, background: fr1.ink,
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fr1.dijon} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4l6 6-3 3-6-6 3-3zM11 7L4 14v4h4l7-7"/>
          </svg>
        </span>
        <div>
          <div style={{
            fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
            fontSize: 22, color: fr1.ink, lineHeight: 1, letterSpacing: '-0.02em',
          }}>HandyHub</div>
          <div style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9.5,
            color: fr1.inkMute, marginTop: 3, letterSpacing: '.12em',
          }}>WORKBENCH · ISSUE 47</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', background: fr1.paper, borderRadius: 999,
          fontFamily: 'inherit', fontSize: 13, color: fr1.inkMute, minWidth: 240,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span>חפש פרויקטים, יוצרים, האשטגים…</span>
        </div>
        <MagneticBtn className="hdr-btn" strength={0.4} style={{
          border: `1px solid ${fr1.ink}`, background: fr1.ink, color: fr1.cream,
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          padding: '9px 18px', borderRadius: 999, cursor: 'pointer',
        }}>
          פרסם פרויקט
        </MagneticBtn>
      </div>
    </header>
  );
}

// ── COMPOSER ───────────────────────────────────────────────────────────────
function ComposerV1() {
  return (
    <article style={{
      background: fr1.cream, border: `1px solid ${fr1.paperLo}`,
      padding: '20px 24px', borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <AuthorAvatar person={{ name: 'דניאל', hue: 18 }} size={42}/>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: '"Frank Ruhl Libre", serif', fontSize: 18,
          color: fr1.inkMute, fontStyle: 'italic',
        }}>
          על מה אתה עובד היום?
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { label: 'תמונה',  d: 'M4 5h16v14H4zM4 15l5-5 5 5 3-3 3 3' },
          { label: 'מדריך',  d: 'M5 5h14v14H5zM8 9h8M8 13h8M8 17h5' },
          { label: 'כלי',    d: 'M14 4l6 6-3 3-6-6 3-3zM11 7L4 14v4h4l7-7' },
        ].map(b => (
          <button key={b.label} title={b.label} style={{
            width: 40, height: 40, borderRadius: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center', color: fr1.inkSoft,
            transition: 'background .25s ease, color .25s ease',
          }} onMouseEnter={e => { e.currentTarget.style.background = fr1.paper; e.currentTarget.style.color = fr1.saffron; }}
             onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = fr1.inkSoft; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={b.d}/></svg>
          </button>
        ))}
      </div>
    </article>
  );
}

// ── POST CARD ──────────────────────────────────────────────────────────────
function PostV1({ post, idx }) {
  const isReview = post.kind === 'review';
  const isTutorial = post.kind === 'tutorial';

  // Hover overlay content — slides up from bottom
  const overlay = (
    <div style={{
      background: `linear-gradient(to top, rgba(26,58,46,.96) 60%, rgba(26,58,46,0))`,
      padding: '22px 20px 18px', color: fr1.cream,
    }}>
      <div style={{
        fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
        letterSpacing: '.12em', color: fr1.dijon, marginBottom: 8,
      }}>
        {isTutorial ? `${post.stepCount} שלבים · ≈${post.estMinutes} דק'` : isReview ? `דירוג ${post.shop.rating}/5` : 'פרויקט אישי'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['פתח', 'שמור', 'שתף', 'פנה ליוצר'].map(a => (
          <span key={a} style={{
            padding: '5px 10px', borderRadius: 999,
            border: `1px solid rgba(212,185,106,.5)`, color: fr1.cream,
            fontSize: 12, fontFamily: 'inherit',
          }}>{a}</span>
        ))}
      </div>
    </div>
  );

  return (
    <article style={{
      background: fr1.cream,
      border: `1px solid ${fr1.paperLo}`,
      borderRadius: 4, overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Author strip */}
      <div style={{
        padding: '18px 24px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <AuthorAvatar person={post.author} size={42}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
              fontSize: 17, color: fr1.ink, letterSpacing: '-0.01em',
            }}>{post.author.name}</span>
            {post.author.verified && (
              <span title="מאומת" style={{
                width: 14, height: 14, borderRadius: '50%',
                background: fr1.saffron, color: fr1.cream,
                display: 'inline-grid', placeItems: 'center',
                fontSize: 8, fontWeight: 700,
              }}>✓</span>
            )}
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: fr1.inkMute }}>
              {post.author.handle}
            </span>
          </div>
          <MetaRow>
            <CountUp value={post.author.followers} duration={1400} startDelay={idx * 120}
                     format={n => `${Math.round(n).toLocaleString('he-IL')} עוקבים`}/>
            <Dot/>
            <span>{post.location}</span>
          </MetaRow>
        </div>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
          color: fr1.inkMute, letterSpacing: '.05em',
        }}>
          {post.minutesAgo < 60 ? `${post.minutesAgo} דק'` : `${Math.round(post.minutesAgo/60)} שע'`}
        </span>
      </div>

      {/* Title */}
      <h2 style={{
        margin: 0, padding: '0 24px 16px',
        fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
        fontSize: 28, color: fr1.ink, letterSpacing: '-0.02em',
        lineHeight: 1.15, textWrap: 'pretty',
      }}>
        {isReview ? `ביקורת: ${post.shop.name}` : post.title}
      </h2>

      {/* Blurb */}
      <p style={{
        margin: 0, padding: '0 24px 18px',
        fontFamily: '"Assistant", sans-serif', fontSize: 15,
        color: fr1.inkSoft, lineHeight: 1.6,
      }}>{post.blurb}</p>

      {/* Image */}
      <HoverReveal tone={post.tone} label={post.overlayLabel} height={340} mode="bottom" overlay={overlay}/>

      {/* Footer: tags + actions */}
      <div style={{
        padding: '14px 20px 14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {post.tags.map(t => <Tag1 key={t}>{t}</Tag1>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LikeBtn count={post.stats.likes}/>
          <MagneticBtn strength={0.4} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '8px 12px', borderRadius: 10, color: fr1.inkSoft,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8.5 8.5 0 0 1-12.5 7.5L3 21l1.5-5.5A8.5 8.5 0 1 1 21 12z"/></svg>
            <span style={{ marginInlineStart: 6 }}>{post.stats.comments}</span>
          </MagneticBtn>
          <MagneticBtn strength={0.4} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '8px 12px', borderRadius: 10, color: fr1.inkSoft,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span style={{ marginInlineStart: 6 }}>{post.stats.saves}</span>
          </MagneticBtn>
        </div>
      </div>
    </article>
  );
}

// ── FEED ROOT ──────────────────────────────────────────────────────────────
function FeedV1() {
  return (
    <div style={{
      background: fr1.paper,
      color: fr1.ink,
      fontFamily: '"Assistant", sans-serif',
      minHeight: '100%',
    }}>
      <HeaderV1/>
      <div style={{
        maxWidth: 680, margin: '0 auto', padding: '28px 24px 48px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <ComposerV1/>
        {FR_POSTS.map((p, i) => <PostV1 key={p.id} post={p} idx={i}/>)}
      </div>
    </div>
  );
}

window.FeedV1 = FeedV1;
