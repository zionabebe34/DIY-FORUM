// An in-memory stand-in for the Flask API, installed as `fetch` in tests.
// It mirrors the real endpoints' URLs, status codes and JSON shapes closely
// enough for the UI to run end to end (login → post → like → comment → report …).

const iso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60000).toISOString().replace(/\.\d+Z$/, 'Z');

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
      { id: 4, username: 'benchbot', name: 'BenchBot', email: 'bot@example.com', password: 'password123', bio: 'AI helper',
        avatar_url: null, cover: 'ph-night', location: 'Cloud', skills: [], verified: false, is_agent: true,
        role: 'user', is_banned: false, created_at: iso(60 * 24 * 10) },
    ],
    follows: [{ follower: 2, followee: 1 }, { follower: 3, followee: 1 }, { follower: 1, followee: 3 }],
    posts: [],
    likes: [],            // { user, post }
    comments: [],         // { id, post_id, author, parent_id, body, created_at }
    reports: [],
    resets: [],           // { token, user, used }
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

  // ── helpers ────────────────────────────────────────────────────────────
  const me = () => db.users.find(u => u.id === db.sessionUser && !u.is_banned) || null;
  const byName = (n) => db.users.find(u => u.username === n);
  const pub = (u, extra = {}) => ({
    id: u.id, username: u.username, name: u.name, bio: u.bio, avatar_url: u.avatar_url, cover: u.cover,
    location: u.location, skills: u.skills, verified: u.verified, is_agent: u.is_agent, role: u.role,
    is_banned: u.is_banned, created_at: u.created_at, ...extra,
  });
  const priv = (u) => ({ ...pub(u), email: u.email });
  const following = (a, b) => db.follows.some(f => f.follower === a && f.followee === b);
  const postOut = (p) => {
    const u = db.users.find(x => x.id === p.author);
    return {
      ...p, author: undefined, likes_count: db.likes.filter(l => l.post === p.id).length,
      comments_count: db.comments.filter(c => c.post_id === p.id).length,
      liked_by_me: !!me() && db.likes.some(l => l.post === p.id && l.user === me().id),
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
    return { items: pageItems.map(postOut), next_cursor: items.length > limit ? pageItems[pageItems.length - 1].id : null };
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
    db.sessionUser = u.id;
    return ok({ user: priv(u) });
  });
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
    if (kind === 'project' && !html.replace(/<[^>]+>/g, '').trim() && !files.length) return err(400, 'הפוסט ריק');
    const tags = JSON.parse(form.get('tags') || '[]').map(t => '#' + t.replace(/^#/, ''));
    const p = { id: id(), author: me().id, kind, title: form.get('title') || null, body_html: html, location: '',
                steps: JSON.parse(form.get('steps') || '[]'), images: files.map((_, i) => `/uploads/new${i}.png`),
                tags, created_at: iso() };
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
  on('POST', '/api/posts/(\\d+)/like', needLogin(([pid]) => {
    if (!db.likes.some(l => l.post === +pid && l.user === me().id)) db.likes.push({ user: me().id, post: +pid });
    return ok({ liked: true, likes_count: db.likes.filter(l => l.post === +pid).length });
  }));
  on('DELETE', '/api/posts/(\\d+)/like', needLogin(([pid]) => {
    db.likes = db.likes.filter(l => !(l.post === +pid && l.user === me().id));
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
    if (!following(me().id, u.id)) db.follows.push({ follower: me().id, followee: u.id });
    return ok({ is_following: true, followers_count: db.follows.filter(f => f.followee === u.id).length });
  }));
  on('DELETE', '/api/users/([^/]+)/follow', needLogin(([name]) => {
    const u = byName(name);
    db.follows = db.follows.filter(f => !(f.follower === me().id && f.followee === u.id));
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
  on('GET', '/api/tags/trending', () => ok({ items: [{ tag: '#woodwork', posts: 12 }, { tag: '#welding', posts: 7 }] }));
  on('GET', '/api/search', (_, q) => {
    const term = (q.get('q') || '').toLowerCase();
    return ok({
      people: db.users.filter(u => u.username.includes(term) || u.name.toLowerCase().includes(term)).map(u => pub(u)),
      posts: db.posts.filter(p => p.body_html.toLowerCase().includes(term)).slice(0, 2).map(postOut),
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
