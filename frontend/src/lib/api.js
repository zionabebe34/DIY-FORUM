// Thin fetch wrapper for the Flask API + adapters that turn API rows into the
// shapes the design components expect (person.id = username, post.minutesAgo …).

import { announcePostsChanged } from './intents.js';

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
    personality: u.personality || '',
    role: u.role || 'user',
    isStaff: u.role === 'moderator' || u.role === 'admin',
    isBanned: !!u.is_banned,
    email: u.email,
    twoFactor: !!u.two_factor,
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
    likedByMe: !!p.liked_by_me,
    savedByMe: !!p.saved_by_me,
    sharedPostId: p.shared_post_id ?? null,
    sharedPost: p.shared_post ? toPost(p.shared_post) : null,
    stats: { likes: p.likes_count || 0, comments: p.comments_count || 0, saves: p.saves_count || 0 },
  };
}

export function toComment(c) {
  return {
    id: c.id,
    postId: c.post_id,
    parentId: c.parent_id,
    body: c.body,
    createdAt: c.created_at,
    author: toPerson(c.author),
  };
}

export function toListing(l) {
  return {
    id: l.id,
    listingType: l.listing_type,
    name: l.title,
    description: l.description,
    category: l.category,
    cond: l.condition,
    price: l.price,
    dailyPrice: l.daily_price,
    weeklyPrice: l.weekly_price,
    deposit: l.deposit,
    image: l.image_url,
    bg: l.cover,
    createdAt: l.created_at,
    savedByMe: !!l.saved_by_me,
    seller: toPerson(l.seller),
  };
}

export function toStore(s) {
  return {
    id: s.id, name: s.name, area: s.area, bg: s.cover, address: s.address, phone: s.phone, hours: s.hours,
    summary: s.summary, tags: s.tags || [], reviews: s.reviews_count, rating: s.avg_rating,
  };
}

export function toReview(r) {
  return { id: r.id, rating: r.rating, body: r.body, pros: r.pros, cons: r.cons, createdAt: r.created_at,
           author: toPerson(r.author) };
}

export function toMessage(m) {
  return { id: m.id, text: m.body, createdAt: m.created_at, from: m.from_me ? 'me' : 'them', read: m.read,
           listing: m.listing ? toListing(m.listing) : null };
}

export function toNotification(n) {
  return { id: n.id, kind: n.kind, text: n.text, createdAt: n.created_at, read: n.read, commentId: n.comment_id,
           actor: n.actor ? toPerson(n.actor) : null, post: n.post };
}

const page = (mapper) => (data) => ({ items: data.items.map(mapper), nextCursor: data.next_cursor });

// ── Endpoints ───────────────────────────────────────────────────────────────
export const api = {
  me: () => request('/api/auth/me').then(d => d.user),
  // → { user } or, for an account with 2FA, { two_factor_required, challenge }
  login: (login, password) => request('/api/auth/login', { method: 'POST', json: { login, password } }),
  loginWithCode: (challenge, code) => request('/api/auth/login/2fa', { method: 'POST', json: { challenge, code } }),
  twoFactor: {
    status: () => request('/api/auth/2fa'),
    setup: () => request('/api/auth/2fa/setup', { method: 'POST' }),
    enable: (code) => request('/api/auth/2fa/enable', { method: 'POST', json: { code } }),
    disable: (password, code) => request('/api/auth/2fa/disable', { method: 'POST', json: { password, code } }),
    newRecoveryCodes: (password, code) =>
      request('/api/auth/2fa/recovery-codes', { method: 'POST', json: { password, code } }),
  },
  signup: (fields) => request('/api/auth/signup', { method: 'POST', json: fields }).then(d => d.user),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  forgotPassword: (email) => request('/api/auth/forgot', { method: 'POST', json: { email } }),
  checkResetToken: (token) => request(`/api/auth/reset/${encodeURIComponent(token)}`),
  resetPassword: (token, password) => request('/api/auth/reset', { method: 'POST', json: { token, password } }),

  feed: ({ scope = 'global', tag, before, limit = 10 }) =>
    request('/api/feed' + qs({ scope, tag, before, limit })).then(page(toPost)),
  userPosts: (username, { before, limit = 10 } = {}) =>
    request(`/api/users/${encodeURIComponent(username)}/posts` + qs({ before, limit })).then(page(toPost)),
  createPost: (formData) => request('/api/posts', { method: 'POST', form: formData })
    .then(d => { announcePostsChanged(); return toPost(d.post); }),
  deletePost: (id) => request(`/api/posts/${id}`, { method: 'DELETE' })
    .then(d => { announcePostsChanged(); return d; }),
  like: (id) => request(`/api/posts/${id}/like`, { method: 'POST' }),
  unlike: (id) => request(`/api/posts/${id}/like`, { method: 'DELETE' }),
  comments: (id) => request(`/api/posts/${id}/comments`).then(d => d.items.map(toComment)),
  addComment: (id, body, parentId) =>
    request(`/api/posts/${id}/comments`, { method: 'POST', json: { body, parent_id: parentId ?? null } })
      .then(d => toComment(d.comment)),
  deleteComment: (commentId) => request(`/api/comments/${commentId}`, { method: 'DELETE' }),
  post: (id) => request(`/api/posts/${id}`).then(d => toPost(d.post)),

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

  // Marketplace
  listings: ({ type, category, seller, before, limit = 12 } = {}) =>
    request('/api/listings' + qs({ type: type === 'all' ? '' : type, category: category === 'all' ? '' : category,
                                   seller, before, limit }))
      .then(d => ({ items: d.items.map(toListing), nextCursor: d.next_cursor, counts: d.counts })),
  createListing: (formData) => request('/api/listings', { method: 'POST', form: formData }).then(d => toListing(d.listing)),
  deleteListing: (id) => request(`/api/listings/${id}`, { method: 'DELETE' }),

  // Store reviews
  stores: () => request('/api/stores').then(d => d.items.map(toStore)),
  store: (id, sort) => request(`/api/stores/${id}` + qs({ sort })).then(d => ({
    store: toStore(d.store), reviews: d.reviews.map(toReview), distribution: d.distribution })),
  reviewStore: (fields) => request('/api/stores/reviews', { method: 'POST', json: fields }),
  deleteReview: (id) => request(`/api/stores/reviews/${id}`, { method: 'DELETE' }),

  // Private messages
  conversations: () => request('/api/messages/conversations').then(d => d.items.map(c => ({
    with: toPerson(c.with), last: { text: c.last.body, createdAt: c.last.created_at, fromMe: c.last.from_me },
    unread: c.unread }))),
  thread: (username, after) => request(`/api/messages/with/${encodeURIComponent(username)}` + qs({ after }))
    .then(d => ({ with: toPerson(d.with), items: d.items.map(toMessage) })),
  sendMessage: (username, body, listingId) =>
    request(`/api/messages/with/${encodeURIComponent(username)}`, { method: 'POST', json: { body, listing_id: listingId ?? null } })
      .then(d => toMessage(d.message)),
  unreadMessages: () => request('/api/messages/unread'),
  searchUsers: (q) => request('/api/users/search' + qs({ q })).then(d => d.items.map(toPerson)),

  // Notifications
  notifications: ({ filter, before } = {}) => request('/api/notifications' + qs({ filter, before }))
    .then(d => ({ items: d.items.map(toNotification), nextCursor: d.next_cursor, unread: d.unread })),
  unreadNotifications: () => request('/api/notifications/unread').then(d => d.count),
  markNotificationsRead: (ids) => request('/api/notifications/read', { method: 'POST', json: ids ? { ids } : {} })
    .then(d => d.unread),

  // Saved items
  savePost: (id) => request(`/api/posts/${id}/save`, { method: 'POST' }),
  unsavePost: (id) => request(`/api/posts/${id}/save`, { method: 'DELETE' }),
  saveListing: (id) => request(`/api/listings/${id}/save`, { method: 'POST' }),
  unsaveListing: (id) => request(`/api/listings/${id}/save`, { method: 'DELETE' }),
  saved: () => request('/api/saved').then(d => ({ posts: d.posts.map(toPost), listings: d.listings.map(toListing) })),

  // Reporting + moderation
  report: (targetType, targetId, reason, details) =>
    request('/api/reports', { method: 'POST', json: { target_type: targetType, target_id: targetId, reason, details } }),
  admin: {
    stats: () => request('/api/admin/stats'),
    cases: (status = 'open') => request('/api/admin/reports' + qs({ status })).then(d => d.items),
    dismiss: (targetType, targetId) =>
      request('/api/admin/cases/dismiss', { method: 'POST', json: { target_type: targetType, target_id: targetId } }),
    users: (q, filter) => request('/api/admin/users' + qs({ q, filter })).then(d => d.items),
    ban: (username, reason, deleteContent) => request(`/api/admin/users/${encodeURIComponent(username)}/ban`,
      { method: 'POST', json: { reason, delete_content: !!deleteContent } }),
    unban: (username) => request(`/api/admin/users/${encodeURIComponent(username)}/unban`, { method: 'POST' }),
    setRole: (username, role) => request(`/api/admin/users/${encodeURIComponent(username)}/role`,
      { method: 'PUT', json: { role } }),
  },
};
