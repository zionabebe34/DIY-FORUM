// V2 — SHOP FLOOR (chunky, tactile, ticket-stub)
// 2px hard borders, hard-offset shadows in dijon, perforated ticket strips,
// HoverReveal in 'right' mode (spec sheet slides in from right), kraft paper.

const fr2 = FR_TOKENS;

// ── Hard-shadow utility ────────────────────────────────────────────────────
const hardShadow = `4px 4px 0 ${fr2.ink}`;

function StubAvatar({ person, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      background: `linear-gradient(135deg, oklch(.65 .14 ${person.hue}) 0%, oklch(.5 .15 ${(person.hue + 30) % 360}) 100%)`,
      display: 'grid', placeItems: 'center',
      color: fr2.cream, fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 700,
      fontSize: size * 0.45,
      border: `2px solid ${fr2.ink}`,
      flexShrink: 0,
    }}>
      {person.name.charAt(0)}
    </div>
  );
}

function Tag2({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 11, color: fr2.ink, fontWeight: 600,
      padding: '4px 10px', background: fr2.dijon,
      border: `1.5px solid ${fr2.ink}`,
      borderRadius: 3,
    }}>{children}</span>
  );
}

// Perforated divider — like ticket stubs
function Perforation({ vertical = false }) {
  return (
    <div style={{
      [vertical ? 'width' : 'height']: 1,
      [vertical ? 'height' : 'width']: '100%',
      backgroundImage: `repeating-linear-gradient(${vertical ? 'to bottom' : 'to right'}, ${fr2.ink} 0 6px, transparent 6px 12px)`,
      [vertical ? 'backgroundSize' : 'backgroundSize']: vertical ? '1px 12px' : '12px 1px',
    }}/>
  );
}

// ── HEADER ─────────────────────────────────────────────────────────────────
function HeaderV2() {
  return (
    <header style={{
      background: fr2.ink, color: fr2.cream,
      padding: '14px 28px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `3px solid ${fr2.ink}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          width: 42, height: 42, borderRadius: 4,
          background: fr2.dijon, color: fr2.ink,
          display: 'grid', placeItems: 'center',
          border: `2px solid ${fr2.cream}`,
          transform: 'rotate(-4deg)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4l6 6-3 3-6-6 3-3zM11 7L4 14v4h4l7-7"/>
          </svg>
        </span>
        <div>
          <div style={{
            fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 800,
            fontSize: 26, lineHeight: 1, letterSpacing: '-0.03em',
          }}>HandyHub</div>
          <div style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
            color: fr2.dijon, marginTop: 4, letterSpacing: '.18em',
          }}>SHOP FLOOR · אצלך בסדנה</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {['פיד', 'שוק', 'חנויות'].map((l, i) => (
          <button key={l} style={{
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            padding: '7px 14px', borderRadius: 3, cursor: 'pointer',
            background: i === 0 ? fr2.saffron : 'transparent',
            color: i === 0 ? fr2.cream : fr2.cream,
            border: `2px solid ${i === 0 ? fr2.saffron : 'rgba(251,246,236,.25)'}`,
          }}>{l}</button>
        ))}
      </div>
    </header>
  );
}

// ── COMPOSER ───────────────────────────────────────────────────────────────
function ComposerV2() {
  return (
    <article style={{
      background: fr2.cream,
      border: `2.5px solid ${fr2.ink}`,
      borderRadius: 6,
      boxShadow: hardShadow,
      padding: 0,
      overflow: 'hidden',
    }}>
      <div style={{
        background: fr2.dijon,
        padding: '8px 16px',
        borderBottom: `2.5px solid ${fr2.ink}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
        letterSpacing: '.15em', color: fr2.ink, fontWeight: 700,
      }}>
        <span>NO. 0048 · NEW ENTRY</span>
        <span>{new Date().toLocaleDateString('he-IL')}</span>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <StubAvatar person={{ name: 'דניאל', hue: 18 }} size={44}/>
        <input placeholder="מה בנית היום?" style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          fontFamily: '"Frank Ruhl Libre", serif', fontSize: 18, color: fr2.ink,
        }}/>
        <MagneticBtn strength={0.4} style={{
          background: fr2.saffron, color: fr2.cream,
          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
          padding: '10px 18px', borderRadius: 4,
          border: `2px solid ${fr2.ink}`, boxShadow: `3px 3px 0 ${fr2.ink}`,
          cursor: 'pointer',
        }}>פרסם</MagneticBtn>
      </div>
    </article>
  );
}

// ── POST CARD ──────────────────────────────────────────────────────────────
function PostV2({ post, idx }) {
  // Right-slide overlay = spec sheet
  const overlay = (
    <div style={{
      background: fr2.cream,
      height: '100%',
      borderInlineStart: `2.5px solid ${fr2.ink}`,
      padding: '18px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: fr2.ink,
    }}>
      <div style={{ fontSize: 9, letterSpacing: '.2em', color: fr2.inkMute }}>SPEC · CARD #{post.id.toUpperCase()}</div>
      <div style={{
        fontFamily: '"Frank Ruhl Libre", serif', fontSize: 18,
        lineHeight: 1.15, fontWeight: 700,
      }}>{post.kind === 'review' ? `${post.shop.name}` : post.title}</div>
      <div style={{ borderTop: `1px dashed ${fr2.ink}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {post.kind === 'tutorial' && <>
          <Row k="שלבים" v={`${post.stepCount}`}/>
          <Row k="זמן משוער" v={`${post.estMinutes} דק'`}/>
          <Row k="קושי" v="בינוני"/>
          <Row k="כלים" v="פלטת שיוף · שמן"/>
        </>}
        {post.kind === 'project' && <>
          <Row k="חומר ראשי" v={post.tone === 'saffron' ? 'מתכת' : 'נחושת'}/>
          <Row k="זמן ביצוע" v="≈ 14 שעות"/>
          <Row k="עלות" v="כ-180 ש״ח"/>
        </>}
        {post.kind === 'review' && <>
          <Row k="מיקום" v={post.shop.area}/>
          <Row k="דירוג" v={`${post.shop.rating} / 5`}/>
          <Row k="ביקרתי" v="3 פעמים"/>
        </>}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
        <span style={{ flex: 1, textAlign: 'center', padding: '8px', background: fr2.ink, color: fr2.cream, borderRadius: 3, fontWeight: 700 }}>פתח</span>
        <span style={{ padding: '8px 12px', border: `1.5px solid ${fr2.ink}`, borderRadius: 3, fontWeight: 700 }}>שמור</span>
      </div>
    </div>
  );

  return (
    <article style={{
      background: fr2.cream,
      border: `2.5px solid ${fr2.ink}`,
      borderRadius: 6,
      boxShadow: hardShadow,
      overflow: 'hidden',
    }}>
      {/* Top ticket strip */}
      <div style={{
        background: fr2.ink, color: fr2.cream,
        padding: '8px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
        letterSpacing: '.15em',
      }}>
        <span>{
          post.kind === 'tutorial' ? 'TUTORIAL · מדריך' :
          post.kind === 'review'   ? 'REVIEW · ביקורת חנות' :
                                     'PROJECT · פרויקט'
        }</span>
        <span style={{ color: fr2.dijon }}>
          {post.minutesAgo < 60 ? `לפני ${post.minutesAgo} דק'` : `לפני ${Math.round(post.minutesAgo/60)} שעות`}
        </span>
      </div>

      {/* Author + title strip */}
      <div style={{
        padding: '16px 18px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        background: fr2.cream,
      }}>
        <StubAvatar person={post.author} size={48}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0,
            fontFamily: '"Frank Ruhl Libre", serif', fontWeight: 800,
            fontSize: 26, color: fr2.ink, lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>
            {post.kind === 'review' ? post.shop.name : post.title}
          </h2>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: fr2.ink }}>{post.author.name}</span>
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: fr2.inkMute,
            }}>{post.author.handle}</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: fr2.inkMute }}/>
            <CountUp value={post.author.followers} duration={1400} startDelay={idx * 120}
                     format={n => `${Math.round(n).toLocaleString('he-IL')} עוקבים`}
                     className=""/>
          </div>
        </div>
      </div>

      <Perforation/>

      {/* Image w/ right-reveal overlay */}
      <HoverReveal tone={post.tone} label={post.overlayLabel} sub={`#${post.id} · ${post.location}`} height={300} mode="right" overlay={overlay}/>

      <Perforation/>

      {/* Blurb + tags */}
      <div style={{ padding: '16px 18px' }}>
        <p style={{
          margin: 0,
          fontFamily: '"Assistant", sans-serif', fontSize: 14.5,
          color: fr2.inkSoft, lineHeight: 1.55,
        }}>{post.blurb}</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {post.tags.map(t => <Tag2 key={t}>{t}</Tag2>)}
        </div>
      </div>

      <Perforation/>

      {/* Actions */}
      <div style={{
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: fr2.paper,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <LikeBtn count={post.stats.likes}/>
          <MagneticBtn strength={0.4} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '8px 12px', color: fr2.inkSoft,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8.5 8.5 0 0 1-12.5 7.5L3 21l1.5-5.5A8.5 8.5 0 1 1 21 12z"/></svg>
            <span style={{ marginInlineStart: 6 }}>{post.stats.comments}</span>
          </MagneticBtn>
        </div>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
          color: fr2.inkMute, letterSpacing: '.1em',
        }}>{post.stats.saves} שמורים</span>
      </div>
    </article>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: fr2.inkMute }}>{k}</span>
      <span style={{ fontWeight: 700 }}>{v}</span>
    </div>
  );
}

// ── FEED ROOT ──────────────────────────────────────────────────────────────
function FeedV2() {
  return (
    <div style={{
      background: fr2.paper,
      color: fr2.ink,
      fontFamily: '"Assistant", sans-serif',
      minHeight: '100%',
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='.7' numOctaves='2'/><feColorMatrix values='0 0 0 0 .42 0 0 0 0 .35 0 0 0 0 .22 0 0 0 .04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
    }}>
      <HeaderV2/>
      <div style={{
        maxWidth: 680, margin: '0 auto', padding: '28px 24px 48px',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        <ComposerV2/>
        {FR_POSTS.map((p, i) => <PostV2 key={p.id} post={p} idx={i}/>)}
      </div>
    </div>
  );
}

window.FeedV2 = FeedV2;
