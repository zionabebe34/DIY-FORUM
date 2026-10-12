// Thin fetch wrapper for the Flask API + adapters that turn API rows into the
// shapes the design components expect (person.id = username, post.minutesAgo …).

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', json, form } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (form) {
    opts.body = form;
  } else if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new ApiError('אין חיבור לשרת', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(data?.error || 'שגיאת שרת', res.status);
  return data;
}

const qs = (params) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') s.set(k, v); });
  const str = s.toString();
  return str ? '?' + str : '';
};

// ── Adapters ────────────────────────────────────────────────────────────────
export function minutesSince(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function toPerson(u) {
  if (!u) return null;
  return {
    id: u.username,               // design components key people by id → username
    uid: u.id,
    username: u.username,
    name: u.name,
    handle: '@' + u.username,
    bio: u.bio || '',
    avatar: u.avatar_url || null,
    cover: u.cover || 'ph-night',
    loc: u.location || '',
    joined: u.created_at ? new Date(u.created_at).getFullYear() : null,
    skills: u.skills || [],
    verified: !!u.verified,
    agent: !!u.is_agent,
    email: u.email,
    followersCount: u.followers_count,
    followingCount: u.following_count,
    postsCount: u.posts_count,
    isFollowing: !!u.is_following,
    followsYou: !!u.follows_you,
    isMe: !!u.is_me,
    mutuals: u.mutuals,
  };
}

export function toPost(p) {
  return {
    id: p.id,
    kind: p.kind,
    author: toPerson(p.author),
    createdAt: p.created_at,
    location: p.location,
    title: p.title,
    bodyHtml: p.body_html,
    images: p.images || [],
    tags: p.tags || [],
    steps: p.steps || [],
    // Likes / comments / saves arrive with part 2 of the project.
    stats: { likes: 0, comments: 0, saves: 0 },
  };
}

const page = (mapper) => (data) => ({ items: data.items.map(mapper), nextCursor: data.next_cursor });

// ── Endpoints ───────────────────────────────────────────────────────────────
export const api = {
  me: () => request('/api/auth/me').then(d => d.user),
  login: (login, password) => request('/api/auth/login', { method: 'POST', json: { login, password } }).then(d => d.user),
  signup: (fields) => request('/api/auth/signup', { method: 'POST', json: fields }).then(d => d.user),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  feed: ({ scope = 'global', tag, before, limit = 10 }) =>
    request('/api/feed' + qs({ scope, tag, before, limit })).then(page(toPost)),
  userPosts: (username, { before, limit = 10 } = {}) =>
    request(`/api/users/${encodeURIComponent(username)}/posts` + qs({ before, limit })).then(page(toPost)),
  createPost: (formData) => request('/api/posts', { method: 'POST', form: formData }).then(d => toPost(d.post)),
  deletePost: (id) => request(`/api/posts/${id}`, { method: 'DELETE' }),

  profile: (username) => request(`/api/users/${encodeURIComponent(username)}`).then(d => toPerson(d.user)),
  updateProfile: (formData) => request('/api/users/me', { method: 'PUT', form: formData }).then(d => d.user),
  follow: (username) => request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' }),
  unfollow: (username) => request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' }),
  followers: (username, { before } = {}) =>
    request(`/api/users/${encodeURIComponent(username)}/followers` + qs({ cursor: before })).then(page(toPerson)),
  following: (username, { before } = {}) =>
    request(`/api/users/${encodeURIComponent(username)}/following` + qs({ cursor: before })).then(page(toPerson)),
  suggested: () => request('/api/users/suggested').then(d => d.items.map(toPerson)),

  search: (q) => request('/api/search' + qs({ q })).then(d => ({
    people: d.people.map(toPerson),
    posts: d.posts.map(toPost),
    tags: d.tags,
  })),
  trending: () => request('/api/tags/trending').then(d => d.items),
};
