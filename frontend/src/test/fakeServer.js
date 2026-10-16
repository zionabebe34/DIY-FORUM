// An in-memory stand-in for the Flask API, installed as `fetch` in tests.
// It mirrors the real endpoints' URLs, status codes and JSON shapes closely
// enough for the UI to run end to end (login → post → like → comment → report …).

const iso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60000).toISOString().replace(/\.\d+Z$/, 'Z');

export const TOTP_BACKUP = ['aaaa-bbbb-cccc', 'dddd-eeee-ffff', 'gggg-hhhh-iiii', 'jjjj-kkkk-llll',
                            'mmmm-nnnn-oooo', 'pppp-qqqq-rrrr', 'ssss-tttt-uuuu', 'vvvv-wwww-xxxx'];

export function createFakeServer() {
  let nextId = 100;
  const id = () => ++nextId;

  const db = {
    users: [
      { id: 1, username: 'alice', name: 'Alice Cohen', email: 'alice@example.com', password: 'password123', bio: 'Woodworker',
        avatar_url: null, cover: 'ph-wood', location: 'Tel Aviv', skills: ['carpentry'], verified: true, is_agent: false,
        role: 'admin', is_banned: false, created_at: iso(60 * 24 * 400) },
      { id: 2, username: 'bob', name: 'Bob Levi', email: 'bob@example.com', password: 'password123', bio: '',
        avatar_url: null, cover: 'ph-steel', location: '', skills: [], verified: false, is_agent: false,
        role: 'user', is_banned: false, created_at: iso(60 * 24 * 100) },
      { id: 3, username: 'carol', name: 'Carol Mizrahi', email: 'carol@example.com', password: 'password123', bio: 'Welder',
        avatar_url: '/uploads/carol.png', cover: 'ph-clay', location: 'Haifa', skills: ['welding', 'TIG'], verified: false,
        is_agent: false, role: 'user', is_banned: false, created_at: iso(60 * 24 * 30) },
      { id: 4, username: 'benchbot', name: 'BenchBot', email: 'bot@example.com', password: 'password123', bio: 'AI helper', personality: 'The Helpful Fact-Checker',
        avatar_url: null, cover: 'ph-night', location: 'Cloud', skills: [], verified: false, is_agent: true,
        role: 'user', is_banned: false, created_at: iso(60 * 24 * 10) },
    ],
    follows: [{ follower: 2, followee: 1 }, { follower: 3, followee: 1 }, { follower: 1, followee: 3 }],
    posts: [],
    likes: [],            // { user, post }
    comments: [],         // { id, post_id, author, parent_id, body, created_at }
    reports: [],
    resets: [],           // { token, user, used }
    listings: [
      { id: 1, seller: 3, listing_type: 'lend', title: 'TIG welder', description: 'with mask', category: 'machines',
        condition: 'good', price: null, daily_price: 90, weekly_price: 420, deposit: 1500, image_url: null, cover: 'ph-clay' },
      { id: 2, seller: 1, listing_type: 'sale', title: 'Chisel set', description: '', category: 'hand',
        condition: 'used — fine', price: 400, daily_price: null, weekly_price: null, deposit: null, image_url: '/uploads/c.png', cover: 'ph-wood' },
      { id: 3, seller: 4, listing_type: 'sale', title: 'Impact driver', description: '', category: 'power',
        condition: 'new', price: 320, daily_price: null, weekly_price: null, deposit: null, image_url: null, cover: 'ph-night' },
    ],
    stores: [{ id: 1, name: 'Wood & Steel', area: 'Tel Aviv', cover: 'ph-steel', address: 'Herzl 84', phone: '03-555',
               hours: 'Sun–Thu 9–18', summary: 'Hand tools', tags: ['hand tools'] },
             { id: 2, name: 'Empty Shop', area: '', cover: 'ph-wood', address: null, phone: null, hours: null, summary: '', tags: [] }],
    reviews: [{ id: 1, store_id: 1, author: 3, rating: 4.5, body: 'Helpful staff', pros: ['service'], cons: ['parking'] },
              { id: 2, store_id: 1, author: 4, rating: 3, body: 'OK', pros: [], cons: [] }],
    messages: [   // { id, from, to, body, listing_id, read }
      { id: 1, from: 3, to: 2, body: 'Hi Bob, still need the welder?', listing_id: 1, read: false },
      { id: 2, from: 2, to: 1, body: 'Hello Alice', listing_id: null, read: true },
    ],
    saves: [],            // { user, post }
    savedListings: [],    // { user, listing }
    notifications: [],    // { id, user, actor, kind, post, text, read }
    sessionUser: null,    // id of the logged-in user (stands in for the cookie)
    calls: [],            // [method, path] log for assertions
  };

  // 25 posts so the feed needs more than one page
  for (let i = 0; i < 25; i++) {
    const author = [1, 3, 4][i % 3];
    db.posts.push({
      id: i + 1, author, kind: i === 1 ? 'tutorial' : 'project',
      title: i === 1 ? 'Concrete countertop' : null,
      body_html: `<p>Post number ${i + 1} <strong>bold</strong></p>`,
      location: 'Tel Aviv',
      steps: i === 1 ? [{ title: 'Mix', note: '1:3', thumb: 'ph-steel' }, { title: 'Pour', note: '', thumb: 'ph-clay' }] : [],
      images: i === 0 ? ['/uploads/a.png'] : i === 3 ? ['/uploads/a.png', '/uploads/b.png'] : i === 6 ? ['/a', '/b', '/c', '/d', '/e'] : [],
      tags: i % 2 ? ['#woodwork'] : ['#welding', '#metal'],
      created_at: iso((25 - i) * 90),
    });
  }
  db.comments.push({ id: id(), post_id: 25, author: 3, parent_id: null, body: 'Great job!', created_at: iso(30) });
  db.comments.push({ id: id(), post_id: 25, author: 1, parent_id: db.comments[0].id, body: 'Thanks!', created_at: iso(20) });
  db.likes.push({ user: 2, post: 25 }, { user: 3, post: 25 });
  db.notifications.push(
    { id: id(), user: 1, actor: null, kind: 'system', post: null, text: 'Welcome to HandyHub', read: true },
    { id: id(), user: 1, actor: 2, kind: 'follow', post: null, text: null, read: false },
    { id: id(), user: 1, actor: 3, kind: 'comment', post: 25, text: 'Great job!', read: false },
    { id: id(), user: 1, actor: 4, kind: 'like', post: 22, text: null, read: false },
  );

  // ── helpers ────────────────────────────────────────────────────────────
  const me = () => db.users.find(u => u.id === db.sessionUser && !u.is_banned) || null;
  const byName = (n) => db.users.find(u => u.username === n);
  const pub = (u, extra = {}) => ({
    id: u.id, username: u.username, name: u.name, bio: u.bio, avatar_url: u.avatar_url, cover: u.cover,
    location: u.location, skills: u.skills, verified: u.verified, is_agent: u.is_agent, role: u.role,
    is_banned: u.is_banned, created_at: u.created_at, ...(u.is_agent ? { personality: u.personality } : {}), ...extra,
  });
  const priv = (u) => ({ ...pub(u), email: u.email, two_factor: !!u.totp });
  const following = (a, b) => db.follows.some(f => f.follower === a && f.followee === b);
  const postOut = (p, embed = true) => {
    const u = db.users.find(x => x.id === p.author);
    const original = p.shared_post_id && db.posts.find(x => x.id === p.shared_post_id);
    return {
      shared_post_id: p.shared_post_id || null,
      shared_post: embed && original && visible(original) ? postOut(original, false) : null,
      ...p, author: undefined, likes_count: db.likes.filter(l => l.post === p.id).length,
      comments_count: db.comments.filter(c => c.post_id === p.id).length,
      liked_by_me: !!me() && db.likes.some(l => l.post === p.id && l.user === me().id),
      saves_count: db.saves.filter(x => x.post === p.id).length,
      saved_by_me: !!me() && db.saves.some(x => x.post === p.id && x.user === me().id),
      author: { id: u.id, username: u.username, name: u.name, avatar_url: u.avatar_url, cover: u.cover,
                verified: u.verified, is_agent: u.is_agent },
    };
  };
  const commentOut = (c) => {
    const u = db.users.find(x => x.id === c.author);
    return { id: c.id, post_id: c.post_id, parent_id: c.parent_id, body: c.body, created_at: c.created_at,
             author: { id: u.id, username: u.username, name: u.name, avatar_url: u.avatar_url, verified: u.verified, is_agent: u.is_agent } };
  };
  const visible = (p) => !db.users.find(u => u.id === p.author).is_banned;
  const page = (list, q) => {
    const limit = Number(q.get('limit') || 10);
    const before = Number(q.get('before') || 0);
    let items = list.filter(visible).sort((a, b) => b.id - a.id);
    if (before) items = items.filter(p => p.id < before);
    const tag = (q.get('tag') || '').replace(/^#/, '');
    if (tag) items = items.filter(p => p.tags.includes('#' + tag));
    const pageItems = items.slice(0, limit);
    return { items: pageItems.map(p => postOut(p)), next_cursor: items.length > limit ? pageItems[pageItems.length - 1].id : null };
  };
  const notify = (user, actor, kind, post = null, text = null) => {
    if (user !== actor) db.notifications.push({ id: id(), user, actor, kind, post, text, read: false });
  };
  const unnotify = (user, actor, kind, post = null) => {
    db.notifications = db.notifications.filter(n => !(n.user === user && n.actor === actor && n.kind === kind && n.post === post));
  };
  const isStaff = (u) => u && (u.role === 'moderator' || u.role === 'admin');

  // ── router ─────────────────────────────────────────────────────────────
  const routes = [];
  const on = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern + '$'), fn });
  const err = (status, error) => ({ status, body: { error } });
  const ok = (body, status = 200) => ({ status, body });
  const needLogin = (fn) => (...a) => (me() ? fn(...a) : err(401, 'נדרשת התחברות'));
  const needStaff = (fn) => (...a) => (!me() ? err(401, 'נדרשת התחברות') : !isStaff(me()) ? err(403, 'אין הרשאת ניהול') : fn(...a));

  // auth
  on('GET', '/api/auth/me', () => ok({ user: me() ? priv(me()) : null }));
  on('POST', '/api/auth/login', (_, __, body) => {
    const u = db.users.find(x => x.email === body.login || x.username === body.login.replace(/^@/, ''));
    if (!u || u.password !== body.password) return err(401, 'פרטי התחברות שגויים');
    if (u.is_banned) return err(403, 'החשבון נחסם על ידי צוות הניהול');
    if (u.totp) {
      db.challenge = { token: 'ch-' + u.username, user: u.id, attempts: 0 };
      return ok({ two_factor_required: true, challenge: db.challenge.token });
    }
    db.sessionUser = u.id;
    return ok({ user: priv(u) });
  });
  // 2FA — the fake authenticator always shows 123456; backup codes are listed in TOTP_BACKUP
  on('POST', '/api/auth/login/2fa', (_, __, body) => {
    const c = db.challenge;
    if (!c || c.token !== body.challenge) return err(401, 'פג תוקף ההתחברות — הזינו שוב את הסיסמה.');
    const u = db.users.find(x => x.id === c.user);
    const backup = u.backup.indexOf((body.code || '').toLowerCase());
    if (body.code !== '123456' && backup < 0) {
      c.attempts += 1;
      if (c.attempts >= 3) { db.challenge = null; return err(429, 'יותר מדי ניסיונות שגויים — הזינו שוב את הסיסמה.'); }
      return err(401, 'הקוד שגוי או שפג תוקפו');
    }
    db.challenge = null;
    db.sessionUser = u.id;
    if (backup >= 0) { u.backup.splice(backup, 1); return ok({ user: priv(u), recovery_codes_left: u.backup.length }); }
    return ok({ user: priv(u) });
  });
  on('GET', '/api/auth/2fa', needLogin(() => ok({ enabled: !!me().totp, recovery_codes_left: me().totp ? me().backup.length : 0 })));
  on('POST', '/api/auth/2fa/setup', needLogin(() => {
    if (me().totp) return err(400, 'אימות דו-שלבי כבר פעיל');
    return ok({ secret: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/HandyHub', qr: 'data:image/svg+xml,qr' });
  }));
  on('POST', '/api/auth/2fa/enable', needLogin((_, __, body) => {
    if (body.code !== '123456') return err(400, 'הקוד שגוי — ודאו שהשעה בטלפון מעודכנת ונסו את הקוד הנוכחי');
    me().totp = true;
    me().backup = [...TOTP_BACKUP];
    return ok({ enabled: true, recovery_codes: [...TOTP_BACKUP] });
  }));
  const confirmIdentity = (body) => body.password !== me().password ? err(400, 'הסיסמה שגויה')
    : body.code !== '123456' && !me().backup.includes(body.code) ? err(400, 'הקוד שגוי או שפג תוקפו') : null;
  on('POST', '/api/auth/2fa/disable', needLogin((_, __, body) => {
    const failed = confirmIdentity(body);
    if (failed) return failed;
    me().totp = false;
    me().backup = [];
    return ok({ enabled: false });
  }));
  on('POST', '/api/auth/2fa/recovery-codes', needLogin((_, __, body) => {
    const failed = confirmIdentity(body);
    if (failed) return failed;
    me().backup = TOTP_BACKUP.map(c => c.replace('a', 'n'));
    return ok({ recovery_codes: [...me().backup] });
  }));
  on('POST', '/api/auth/signup', (_, __, body) => {
    if (db.users.some(u => u.username === body.username)) return err(409, 'שם המשתמש תפוס');
    const u = { id: id(), username: body.username, name: body.name, email: body.email, password: body.password, bio: '',
                avatar_url: null, cover: 'ph-night', location: '', skills: [], verified: false, is_agent: false,
                role: 'user', is_banned: false, created_at: iso() };
    db.users.push(u);
    db.sessionUser = u.id;
    return ok({ user: priv(u) }, 201);
  });
  on('POST', '/api/auth/logout', () => { db.sessionUser = null; return ok({ ok: true }); });
  on('POST', '/api/auth/forgot', (_, __, body) => {
    if (!/@/.test(body.email || '')) return err(400, 'כתובת אימייל לא תקינה');
    const u = db.users.find(x => x.email === body.email);
    if (u) db.resets.push({ token: 'tok-' + u.username, user: u.id, used: false });
    return ok({ ok: true, message: 'אם הכתובת רשומה אצלנו, שלחנו אליה קישור לאיפוס הסיסמה.' });
  });
  on('GET', '/api/auth/reset/(.+)', ([token]) => {
    const r = db.resets.find(x => x.token === token && !x.used);
    return ok({ valid: !!r, username: r ? db.users.find(u => u.id === r.user).username : null });
  });
  on('POST', '/api/auth/reset', (_, __, body) => {
    const r = db.resets.find(x => x.token === body.token && !x.used);
    if (!r) return err(400, 'הקישור לא תקף או שפג תוקפו.');
    if ((body.password || '').length < 8) return err(400, 'הסיסמה חייבת להכיל לפחות 8 תווים');
    r.used = true;
    db.users.find(u => u.id === r.user).password = body.password;
    if (db.sessionUser === r.user) db.sessionUser = null;
    return ok({ ok: true });
  });

  // feed & posts
  on('GET', '/api/feed', (_, q) => {
    if (q.get('scope') === 'following') {
      if (!me()) return err(401, 'נדרשת התחברות');
      const ids = new Set([me().id, ...db.follows.filter(f => f.follower === me().id).map(f => f.followee)]);
      return ok(page(db.posts.filter(p => ids.has(p.author)), q));
    }
    return ok(page(db.posts, q));
  });
  on('GET', '/api/users/([^/]+)/posts', ([name], q) => {
    const u = byName(name);
    return u ? ok(page(db.posts.filter(p => p.author === u.id), q)) : err(404, 'המשתמש לא נמצא');
  });
  on('POST', '/api/posts', needLogin((_, __, body) => {
    const form = body;
    const kind = form.get('kind') || 'project';
    const html = form.get('body') || '';
    const files = form.getAll('images');
    let shared = Number(form.get('shared_post_id')) || null;
    if (shared) {
      const original = db.posts.find(x => x.id === shared);
      if (!original) return err(400, 'הפוסט ששיתפתם לא נמצא');
      shared = original.shared_post_id || original.id;
    } else if (kind === 'project' && !html.replace(/<[^>]+>/g, '').trim() && !files.length) return err(400, 'הפוסט ריק');
    const tags = JSON.parse(form.get('tags') || '[]').map(t => '#' + t.replace(/^#/, ''));
    const p = { id: id(), author: me().id, kind, title: form.get('title') || null, body_html: html, location: '',
                steps: JSON.parse(form.get('steps') || '[]'), images: files.map((_, i) => `/uploads/new${i}.png`),
                tags, shared_post_id: shared, created_at: iso() };
    db.posts.push(p);
    return ok({ post: postOut(p) }, 201);
  }));
  on('DELETE', '/api/posts/(\\d+)', needLogin(([pid]) => {
    const p = db.posts.find(x => x.id === +pid);
    if (!p) return err(404, 'הפוסט לא נמצא');
    if (p.author !== me().id && !isStaff(me())) return err(403, 'אפשר למחוק רק פוסטים שלך');
    db.posts = db.posts.filter(x => x !== p);
    db.reports.filter(r => r.target_type === 'post' && r.target_id === p.id && r.status === 'open')
      .forEach(r => { r.status = 'resolved'; r.resolution = 'content_deleted'; r.resolved_by = me().username; });
    return ok({ ok: true });
  }));
  on('GET', '/api/posts/(\\d+)', ([pid]) => {
    const p = db.posts.find(x => x.id === +pid);
    return p && visible(p) ? ok({ post: postOut(p) }) : err(404, 'הפוסט לא נמצא');
  });
  on('POST', '/api/posts/(\\d+)/like', needLogin(([pid]) => {
    if (!db.likes.some(l => l.post === +pid && l.user === me().id)) {
      db.likes.push({ user: me().id, post: +pid });
      notify(db.posts.find(p => p.id === +pid).author, me().id, 'like', +pid);
    }
    return ok({ liked: true, likes_count: db.likes.filter(l => l.post === +pid).length });
  }));
  on('DELETE', '/api/posts/(\\d+)/like', needLogin(([pid]) => {
    db.likes = db.likes.filter(l => !(l.post === +pid && l.user === me().id));
    unnotify(db.posts.find(p => p.id === +pid).author, me().id, 'like', +pid);
    return ok({ liked: false, likes_count: db.likes.filter(l => l.post === +pid).length });
  }));
  on('GET', '/api/posts/(\\d+)/comments', ([pid]) => ok({ items: db.comments.filter(c => c.post_id === +pid).map(commentOut) }));
  on('POST', '/api/posts/(\\d+)/comments', needLogin(([pid], __, body) => {
    if (!body.body?.trim()) return err(400, 'התגובה ריקה');
    if (body.body.includes('FAIL')) return err(400, 'שגיאה מדומה');
    const parent = body.parent_id ? db.comments.find(c => c.id === body.parent_id) : null;
    const c = { id: id(), post_id: +pid, author: me().id, parent_id: parent ? (parent.parent_id || parent.id) : null,
                body: body.body.trim(), created_at: iso() };
    db.comments.push(c);
    notify(db.posts.find(p => p.id === +pid).author, me().id, 'comment', +pid, c.body);
    return ok({ comment: commentOut(c) }, 201);
  }));
  on('DELETE', '/api/comments/(\\d+)', needLogin(([cid]) => {
    db.comments = db.comments.filter(c => c.id !== +cid && c.parent_id !== +cid);
    return ok({ ok: true });
  }));

  // users
  on('GET', '/api/users/suggested', () => ok({ items: db.users
    .filter(u => (!me() || (u.id !== me().id && !following(me().id, u.id))) && !u.is_banned)
    .slice(0, 3).map(u => pub(u, { is_following: false, mutuals: u.id === 4 ? 1 : 0 })) }));
  on('GET', '/api/users/search', (_, q) => ok({ items: db.users.filter(u => u.username.includes(q.get('q') || '###'))
    .map(u => pub(u, { is_following: !!me() && following(me().id, u.id) })) }));
  on('PUT', '/api/users/me', needLogin((_, __, body) => {
    const u = me();
    if (body.get('name') === '') return err(400, 'יש להזין שם');
    u.name = body.get('name') ?? u.name;
    u.bio = body.get('bio') ?? u.bio;
    u.location = body.get('location') ?? u.location;
    u.cover = body.get('cover') ?? u.cover;
    if (body.get('skills')) u.skills = JSON.parse(body.get('skills'));
    if (body.get('avatar')) u.avatar_url = '/uploads/avatar.png';
    if (body.get('remove_avatar')) u.avatar_url = null;
    return ok({ user: priv(u) });
  }));
  on('GET', '/api/users/([^/]+)/(followers|following)', ([name, which], q) => {
    const u = byName(name);
    if (!u) return err(404, 'המשתמש לא נמצא');
    const ids = which === 'followers'
      ? db.follows.filter(f => f.followee === u.id).map(f => f.follower)
      : db.follows.filter(f => f.follower === u.id).map(f => f.followee);
    const offset = Number(q.get('cursor') || 0);
    const all = ids.map(i => db.users.find(x => x.id === i));
    return ok({ items: all.slice(offset, offset + 20).map(x => pub(x, { is_following: !!me() && following(me().id, x.id) })),
                next_cursor: all.length > offset + 20 ? offset + 20 : null });
  });
  on('POST', '/api/users/([^/]+)/follow', needLogin(([name]) => {
    const u = byName(name);
    if (!following(me().id, u.id)) { db.follows.push({ follower: me().id, followee: u.id }); notify(u.id, me().id, 'follow'); }
    return ok({ is_following: true, followers_count: db.follows.filter(f => f.followee === u.id).length });
  }));
  on('DELETE', '/api/users/([^/]+)/follow', needLogin(([name]) => {
    const u = byName(name);
    db.follows = db.follows.filter(f => !(f.follower === me().id && f.followee === u.id));
    unnotify(u.id, me().id, 'follow');
    return ok({ is_following: false, followers_count: db.follows.filter(f => f.followee === u.id).length });
  }));
  on('GET', '/api/users/([^/]+)', ([name]) => {
    const u = byName(name);
    if (!u) return err(404, 'המשתמש לא נמצא');
    const m = me();
    return ok({ user: pub(u, {
      followers_count: db.follows.filter(f => f.followee === u.id).length,
      following_count: db.follows.filter(f => f.follower === u.id).length,
      posts_count: db.posts.filter(p => p.author === u.id).length,
      is_following: !!m && following(m.id, u.id), follows_you: !!m && following(u.id, m.id), is_me: !!m && m.id === u.id,
    }) });
  });

  // discovery
  on('GET', '/api/tags/trending', () => {
    const counts = {};
    db.posts.filter(visible).forEach(p => p.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return ok({ items: Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
      .map(([tag, posts]) => ({ tag, posts, recent: posts })) });
  });
  on('GET', '/api/search', (_, q) => {
    const term = (q.get('q') || '').toLowerCase();
    return ok({
      people: db.users.filter(u => u.username.includes(term) || u.name.toLowerCase().includes(term)).map(u => pub(u)),
      posts: db.posts.filter(p => p.body_html.toLowerCase().includes(term)).slice(0, 2).map(p => postOut(p)),
      tags: term.startsWith('w') ? [{ tag: 'woodwork', posts: 12 }] : [],
    });
  });

  // moderation
  on('POST', '/api/reports', needLogin((_, __, body) => {
    if (!body.reason) return err(400, 'יש לבחור סיבה לדיווח');
    const target = body.target_type === 'post' ? db.posts.find(p => p.id === body.target_id)
      : body.target_type === 'comment' ? db.comments.find(c => c.id === body.target_id)
      : db.users.find(u => u.id === body.target_id);
    const author = target.author || target.id;
    db.reports.push({ id: id(), reporter: me().username, target_type: body.target_type, target_id: body.target_id,
                      author, reason: body.reason, details: body.details || null, status: 'open',
                      snapshot: (target.body_html || target.body || target.name).replace(/<[^>]+>/g, ''), created_at: iso() });
    return ok({ ok: true }, 201);
  }));
  on('GET', '/api/admin/stats', needStaff(() => ok({
    open_reports: db.reports.filter(r => r.status === 'open').length,
    open_cases: new Set(db.reports.filter(r => r.status === 'open').map(r => r.target_type + r.target_id)).size,
    users: db.users.length, banned_users: db.users.filter(u => u.is_banned).length, posts: db.posts.length, comments: db.comments.length,
  })));
  on('GET', '/api/admin/reports', needStaff((_, q) => {
    const open = q.get('status') !== 'closed';
    const cases = {};
    db.reports.filter(r => (r.status === 'open') === open).forEach(r => {
      const key = r.target_type + r.target_id;
      const author = db.users.find(u => u.id === r.author);
      const exists = r.target_type === 'post' ? db.posts.some(p => p.id === r.target_id)
        : r.target_type === 'comment' ? db.comments.some(c => c.id === r.target_id) : true;
      cases[key] = cases[key] || {
        target_type: r.target_type, target_id: r.target_id, post_id: r.target_id, target_exists: exists,
        snapshot: r.snapshot, target_user: pub(author), status: r.status, resolution: r.resolution || null,
        resolved_by: r.resolved_by || null, resolved_at: r.status === 'open' ? null : iso(), last_reported_at: r.created_at,
        report_ids: [], reports: [], reasons: {},
      };
      const c = cases[key];
      c.report_ids.push(r.id);
      c.reasons[r.reason] = (c.reasons[r.reason] || 0) + 1;
      c.reports.push({ id: r.id, reason: r.reason, details: r.details, created_at: r.created_at,
                       reporter: r.reporter ? pub(byName(r.reporter)) : null, automatic: !r.reporter });
    });
    return ok({ items: Object.values(cases).map(c => ({ ...c, count: c.reports.length })) });
  }));
  on('POST', '/api/admin/cases/dismiss', needStaff((_, __, body) => {
    db.reports.filter(r => r.target_type === body.target_type && r.target_id === body.target_id && r.status === 'open')
      .forEach(r => { r.status = 'dismissed'; r.resolution = 'dismissed'; r.resolved_by = me().username; });
    return ok({ ok: true });
  }));
  on('GET', '/api/admin/users', needStaff((_, q) => {
    let list = db.users;
    if (q.get('filter') === 'banned') list = list.filter(u => u.is_banned);
    if (q.get('filter') === 'staff') list = list.filter(u => u.role !== 'user');
    if (q.get('q')) list = list.filter(u => u.username.includes(q.get('q')));
    return ok({ items: list.map(u => ({ ...pub(u), email: u.email, ban_reason: u.ban_reason || null, banned_at: null,
                                        posts_count: db.posts.filter(p => p.author === u.id).length,
                                        reports_count: db.reports.filter(r => r.author === u.id).length })) });
  }));
  on('POST', '/api/admin/users/([^/]+)/ban', needStaff(([name], __, body) => {
    const u = byName(name);
    if (u.role === 'admin') return err(403, 'אין הרשאה לחסום את המשתמש הזה');
    u.is_banned = true;
    u.ban_reason = body.reason;
    if (body.delete_content) db.posts = db.posts.filter(p => p.author !== u.id);
    db.reports.filter(r => r.author === u.id && r.status === 'open')
      .forEach(r => { r.status = 'resolved'; r.resolution = 'user_banned'; r.resolved_by = me().username; });
    return ok({ ok: true, is_banned: true });
  }));
  on('POST', '/api/admin/users/([^/]+)/unban', needStaff(([name]) => {
    byName(name).is_banned = false;
    return ok({ ok: true, is_banned: false });
  }));
  on('PUT', '/api/admin/users/([^/]+)/role', needStaff(([name], __, body) => {
    if (me().role !== 'admin') return err(403, 'רק מנהל ראשי יכול לשנות תפקידים');
    byName(name).role = body.role;
    return ok({ ok: true, role: body.role });
  }));

  // marketplace
  const listingOut = (l) => {
    const u = db.users.find(x => x.id === l.seller);
    return { ...l, seller: { id: u.id, username: u.username, name: u.name, avatar_url: u.avatar_url, verified: u.verified,
                             is_agent: u.is_agent, location: u.location }, status: 'active', created_at: iso(5),
             saved_by_me: !!me() && db.savedListings.some(x => x.listing === l.id && x.user === me().id) };
  };
  on('GET', '/api/listings', (_, q) => {
    let list = db.listings.filter(l => !db.users.find(u => u.id === l.seller).is_banned);
    if (q.get('category')) list = list.filter(l => l.category === q.get('category'));
    if (q.get('seller')) list = list.filter(l => byName(q.get('seller'))?.id === l.seller);
    const counts = { all: list.length, sale: list.filter(l => l.listing_type === 'sale').length,
                     lend: list.filter(l => l.listing_type === 'lend').length };
    if (q.get('type')) list = list.filter(l => l.listing_type === q.get('type'));
    list = [...list].sort((a, b) => b.id - a.id);
    const limit = Number(q.get('limit') || 12);
    return ok({ items: list.slice(0, limit).map(listingOut), next_cursor: null, counts });
  });
  on('POST', '/api/listings', needLogin((_, __, form) => {
    if (!form.get('title')) return err(400, 'יש להזין שם לכלי');
    const lend = form.get('listing_type') === 'lend';
    const l = { id: id(), seller: me().id, listing_type: form.get('listing_type'), title: form.get('title'),
                description: form.get('description') || '', category: form.get('category') || 'other',
                condition: form.get('condition'), price: lend ? null : Number(form.get('price')),
                daily_price: lend ? Number(form.get('daily_price')) : null,
                weekly_price: lend ? Number(form.get('weekly_price') || form.get('daily_price') * 5) : null,
                deposit: lend ? Number(form.get('deposit') || 0) : null,
                image_url: form.get('image') ? '/uploads/listing.png' : null, cover: 'ph-steel' };
    db.listings.push(l);
    return ok({ listing: listingOut(l) }, 201);
  }));
  on('DELETE', '/api/listings/(\\d+)', needLogin(([lid]) => {
    db.listings = db.listings.filter(l => l.id !== +lid);
    return ok({ ok: true });
  }));

  // saved items
  on('POST', '/api/posts/(\\d+)/save', needLogin(([pid]) => {
    const p = db.posts.find(x => x.id === +pid);
    if (!p) return err(404, 'הפוסט לא נמצא');
    if (!db.saves.some(x => x.post === p.id && x.user === me().id)) {
      db.saves.push({ user: me().id, post: p.id });
      notify(p.author, me().id, 'save', p.id);
    }
    return ok({ saved: true, saves_count: db.saves.filter(x => x.post === p.id).length });
  }));
  on('DELETE', '/api/posts/(\\d+)/save', needLogin(([pid]) => {
    db.saves = db.saves.filter(x => !(x.post === +pid && x.user === me().id));
    return ok({ saved: false, saves_count: db.saves.filter(x => x.post === +pid).length });
  }));
  on('POST', '/api/listings/(\\d+)/save', needLogin(([lid]) => {
    if (!db.listings.some(l => l.id === +lid)) return err(404, 'המודעה לא נמצאה');
    if (!db.savedListings.some(x => x.listing === +lid && x.user === me().id)) db.savedListings.push({ user: me().id, listing: +lid });
    return ok({ saved: true });
  }));
  on('DELETE', '/api/listings/(\\d+)/save', needLogin(([lid]) => {
    db.savedListings = db.savedListings.filter(x => !(x.listing === +lid && x.user === me().id));
    return ok({ saved: false });
  }));
  on('GET', '/api/saved', needLogin(() => ok({
    posts: [...db.saves].reverse().filter(x => x.user === me().id).map(x => db.posts.find(p => p.id === x.post))
      .filter(p => p && visible(p)).map(p => postOut(p)),
    listings: [...db.savedListings].reverse().filter(x => x.user === me().id)
      .map(x => db.listings.find(l => l.id === x.listing)).filter(Boolean).map(listingOut),
  })));

  // notifications
  const notificationOut = (n) => {
    const a = n.actor && db.users.find(u => u.id === n.actor);
    const p = n.post && db.posts.find(x => x.id === n.post);
    return { id: n.id, kind: n.kind, text: n.text, created_at: iso(5), read: n.read, comment_id: null,
             actor: a ? { id: a.id, username: a.username, name: a.name, avatar_url: a.avatar_url, verified: a.verified,
                          is_agent: a.is_agent, location: a.location } : null,
             post: p ? { id: p.id, kind: p.kind, title: p.title || p.body_html.replace(/<[^>]+>/g, '').slice(0, 80) } : null };
  };
  const myNotifications = () => db.notifications.filter(n => n.user === me().id &&
    !(n.actor && db.users.find(u => u.id === n.actor).is_banned));
  const unreadCount = () => myNotifications().filter(n => !n.read).length;
  on('GET', '/api/notifications', needLogin((_, q) => {
    let list = [...myNotifications()].sort((a, b) => b.id - a.id);
    if (q.get('filter') === 'unread') list = list.filter(n => !n.read);
    if (q.get('filter') === 'mentions') list = list.filter(n => ['comment', 'reply', 'mention'].includes(n.kind));
    const before = Number(q.get('before') || 0);
    if (before) list = list.filter(n => n.id < before);
    const pageItems = list.slice(0, 30);
    return ok({ items: pageItems.map(notificationOut), unread: unreadCount(),
                next_cursor: list.length > 30 ? pageItems[pageItems.length - 1].id : null });
  }));
  on('GET', '/api/notifications/unread', needLogin(() => ok({ count: unreadCount() })));
  on('POST', '/api/notifications/read', needLogin((_, __, body) => {
    myNotifications().filter(n => !body.ids || body.ids.includes(n.id)).forEach(n => { n.read = true; });
    return ok({ unread: unreadCount() });
  }));

  // stores
  const storeOut = (st) => {
    const rs = db.reviews.filter(r => r.store_id === st.id);
    return { ...st, reviews_count: rs.length, avg_rating: rs.length ? rs.reduce((n, r) => n + r.rating, 0) / rs.length : null };
  };
  const reviewOut = (r) => {
    const u = db.users.find(x => x.id === r.author);
    return { ...r, author: { id: u.id, username: u.username, name: u.name, avatar_url: u.avatar_url, verified: u.verified,
                             is_agent: u.is_agent }, created_at: iso(60) };
  };
  on('GET', '/api/stores', () => ok({ items: db.stores.map(storeOut) }));
  on('GET', '/api/stores/(\\d+)', ([sid], q) => {
    const st = db.stores.find(x => x.id === +sid);
    if (!st) return err(404, 'החנות לא נמצאה');
    let rs = db.reviews.filter(r => r.store_id === st.id);
    if (q.get('sort') === 'highest') rs = [...rs].sort((a, b) => b.rating - a.rating);
    if (q.get('sort') === 'lowest') rs = [...rs].sort((a, b) => a.rating - b.rating);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rs.forEach(r => { distribution[Math.round(r.rating)] += 1; });
    return ok({ store: storeOut(st), reviews: rs.map(reviewOut), distribution });
  });
  on('POST', '/api/stores/reviews', needLogin((_, __, body) => {
    if (!body.rating) return err(400, 'יש לבחור דירוג');
    let sid = body.store_id;
    if (!sid) {
      const found = db.stores.find(x => x.name === body.store_name && x.area === (body.area || ''));
      sid = found ? found.id : id();
      if (!found) db.stores.push({ id: sid, name: body.store_name, area: body.area || '', cover: 'ph-wood', address: null,
                                   phone: null, hours: null, summary: '', tags: [] });
    }
    db.reviews = db.reviews.filter(r => !(r.store_id === sid && r.author === me().id));
    const r = { id: id(), store_id: sid, author: me().id, rating: body.rating, body: body.body, pros: body.pros, cons: body.cons };
    db.reviews.push(r);
    return ok({ store_id: sid, review: reviewOut(r) }, 201);
  }));
  on('DELETE', '/api/stores/reviews/(\\d+)', needLogin(([rid]) => {
    db.reviews = db.reviews.filter(r => r.id !== +rid);
    return ok({ ok: true });
  }));

  // private messages
  const msgOut = (m) => ({ id: m.id, body: m.body, created_at: iso(2), from_me: m.from === me().id, read: m.read,
                           listing: m.listing_id ? listingOut(db.listings.find(l => l.id === m.listing_id)) : null });
  on('GET', '/api/messages/conversations', needLogin(() => {
    const mine = db.messages.filter(m => m.from === me().id || m.to === me().id);
    const byOther = {};
    mine.forEach(m => { byOther[m.from === me().id ? m.to : m.from] = m; });
    const items = Object.entries(byOther).sort((a, b) => b[1].id - a[1].id).map(([other, last]) => {
      const u = db.users.find(x => x.id === +other);
      return { with: { ...pub(u) }, last: { body: last.body, created_at: iso(2), from_me: last.from === me().id },
               unread: mine.filter(m => m.from === u.id && !m.read).length };
    });
    return ok({ items });
  }));
  on('GET', '/api/messages/with/([^/]+)', needLogin(([name], q) => {
    const u = byName(name);
    if (!u) return err(404, 'המשתמש לא נמצא');
    const after = Number(q.get('after') || 0);
    const items = db.messages.filter(m => ((m.from === me().id && m.to === u.id) || (m.from === u.id && m.to === me().id)) && m.id > after);
    items.forEach(m => { if (m.to === me().id) m.read = true; });
    return ok({ with: pub(u), items: items.map(msgOut) });
  }));
  on('POST', '/api/messages/with/([^/]+)', needLogin(([name], __, body) => {
    const u = byName(name);
    if (!u) return err(404, 'המשתמש לא נמצא');
    if (body.body.includes('FAIL')) return err(400, 'שגיאה מדומה');
    const m = { id: id(), from: me().id, to: u.id, body: body.body, listing_id: body.listing_id || null, read: false };
    db.messages.push(m);
    return ok({ message: msgOut(m) }, 201);
  }));
  on('GET', '/api/messages/unread', needLogin(() => {
    const unread = db.messages.filter(m => m.to === me().id && !m.read);
    const latest = unread[unread.length - 1];
    return ok({ count: unread.length, latest: latest ? { id: latest.id, body: latest.body,
      from: pub(db.users.find(x => x.id === latest.from)) } : null });
  }));

  // ── fetch ──────────────────────────────────────────────────────────────
  async function fetch(input, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const url = new URL(input, 'http://localhost');
    const path = decodeURIComponent(url.pathname);
    db.calls.push([method, path + url.search]);
    let body = opts.body;
    if (typeof body === 'string') body = JSON.parse(body);
    // Simulate one server error (before touching any data). failNext = true fails the next
    // request; failNext = 'DELETE /api/posts' fails the next one whose "METHOD path" contains it.
    const f = fetch.failNext;
    if (f && (f === true || `${method} ${path}`.includes(f))) {
      fetch.failNext = false;
      return { ok: false, status: 500, json: async () => ({ error: 'שגיאת שרת' }) };
    }
    let res = err(404, 'Not found');
    for (const r of routes) {
      const m = r.method === method && path.match(r.re);
      if (m) { res = r.fn(m.slice(1), url.searchParams, body || {}); break; }
    }
    return { ok: res.status < 400, status: res.status, json: async () => res.body };
  }

  return {
    fetch,
    db,
    loginAs(username) { db.sessionUser = byName(username).id; },
  };
}
