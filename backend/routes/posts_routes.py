"""Posts: create / read / delete, the global + following feeds, hashtags and search."""
import json
import re

from flask import Blueprint, jsonify, request

from auth import current_user, is_moderator, login_required
from moderation import resolve_reports
from notifications import notify, notify_mentions
from db import commit, execute, query
from utils import (UploadError, html_to_text, iso, parse_json_list, public_user,
                   sanitize_html, save_image)

bp = Blueprint('posts', __name__, url_prefix='/api')

DEFAULT_PAGE = 10
MAX_PAGE = 30
MAX_IMAGES = 6
MAX_TAGS = 10
MAX_BODY_CHARS = 5000
STEP_THUMBS = ['ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night']
HASHTAG_RE = re.compile(r'#([\w֐-׿]{1,50})')


# ── Loading posts ───────────────────────────────────────────────────────────
_POST_SELECT = """
    SELECT p.id, p.kind, p.title, p.body_html, p.location, p.steps, p.shared_post_id, p.created_at,
           u.id AS u_id, u.username AS u_username, u.name AS u_name, u.avatar_url AS u_avatar_url,
           u.cover AS u_cover, u.verified AS u_verified, u.is_agent AS u_is_agent
    FROM posts p JOIN users u ON u.id = p.author_id
"""


def _in_clause(ids):
    """SQL placeholders for an IN (...) list: "%s, %s, ..." (one per id)."""
    return ', '.join(['%s'] * len(ids))


def _serialize_posts(rows, embed_shared=True):
    """Post rows → API dicts (images, tags, like/comment/save counts, my like/save, author, shared original)."""
    if not rows:
        return []
    ids = [r['id'] for r in rows]
    # A share post carries a preview of the original (None when it was deleted or its author is banned)
    shared = {}
    shared_ids = list({r['shared_post_id'] for r in rows if r['shared_post_id']}) if embed_shared else []
    if shared_ids:
        originals = query(f'{_POST_SELECT} WHERE p.id IN ({_in_clause(shared_ids)}) AND u.is_banned = FALSE', shared_ids)
        shared = {p['id']: p for p in _serialize_posts(originals, embed_shared=False)}
    images, tags = {}, {}
    for r in query(f'SELECT post_id, url FROM post_images WHERE post_id IN ({_in_clause(ids)}) '
                   'ORDER BY position', ids):
        images.setdefault(r['post_id'], []).append(r['url'])
    for r in query(f'SELECT pt.post_id, t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id '
                   f'WHERE pt.post_id IN ({_in_clause(ids)}) ORDER BY t.name', ids):
        tags.setdefault(r['post_id'], []).append('#' + r['name'])

    likes = {r['post_id']: int(r['n']) for r in query(
        f'SELECT post_id, COUNT(*) AS n FROM post_likes WHERE post_id IN ({_in_clause(ids)}) GROUP BY post_id', ids)}
    comments = {r['post_id']: int(r['n']) for r in query(
        f'SELECT post_id, COUNT(*) AS n FROM comments WHERE post_id IN ({_in_clause(ids)}) GROUP BY post_id', ids)}
    saves = {r['post_id']: int(r['n']) for r in query(
        f'SELECT post_id, COUNT(*) AS n FROM saved_posts WHERE post_id IN ({_in_clause(ids)}) GROUP BY post_id', ids)}
    me = current_user()
    liked, saved = set(), set()
    if me:
        liked = {r['post_id'] for r in query(
            f'SELECT post_id FROM post_likes WHERE user_id = %s AND post_id IN ({_in_clause(ids)})',
            (me['id'], *ids))}
        saved = {r['post_id'] for r in query(
            f'SELECT post_id FROM saved_posts WHERE user_id = %s AND post_id IN ({_in_clause(ids)})',
            (me['id'], *ids))}

    result = []
    for r in rows:
        steps = r['steps']
        if isinstance(steps, (str, bytes)):
            steps = parse_json_list(steps)
        result.append({
            'id': r['id'],
            'kind': r['kind'],
            'title': r['title'],
            'body_html': r['body_html'],
            'location': r['location'],
            'steps': steps or [],
            'shared_post_id': r['shared_post_id'],
            'shared_post': shared.get(r['shared_post_id']),
            'images': images.get(r['id'], []),
            'tags': tags.get(r['id'], []),
            'created_at': iso(r['created_at']),
            'likes_count': likes.get(r['id'], 0),
            'comments_count': comments.get(r['id'], 0),
            'liked_by_me': r['id'] in liked,
            'saves_count': saves.get(r['id'], 0),
            'saved_by_me': r['id'] in saved,
            'author': {
                'id': r['u_id'], 'username': r['u_username'], 'name': r['u_name'],
                'avatar_url': r['u_avatar_url'], 'cover': r['u_cover'],
                'verified': bool(r['u_verified']), 'is_agent': bool(r['u_is_agent']),
            },
        })
    return result


def _page(where, params):
    """Keyset pagination on post id (newest first): ?before=<id>&limit=<n>."""
    limit = min(max(request.args.get('limit', DEFAULT_PAGE, type=int), 1), MAX_PAGE)
    before = request.args.get('before', type=int)
    clauses, values = ['u.is_banned = FALSE', *where], list(params)
    if before:
        clauses.append('p.id < %s')
        values.append(before)
    tag = (request.args.get('tag') or '').strip().lstrip('#')
    if tag:
        clauses.append('EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id '
                       'WHERE pt.post_id = p.id AND t.name = %s)')
        values.append(tag)
    where_sql = ('WHERE ' + ' AND '.join(clauses)) if clauses else ''
    rows = query(f'{_POST_SELECT} {where_sql} ORDER BY p.id DESC LIMIT %s', (*values, limit + 1))
    has_more = len(rows) > limit
    rows = rows[:limit]
    return jsonify({
        'items': _serialize_posts(rows),
        'next_cursor': rows[-1]['id'] if has_more else None,
    })


@bp.get('/feed')
def feed():
    """Home feed: all posts, or (?scope=following) mine + the people I follow."""
    scope = request.args.get('scope', 'global')
    if scope == 'following':
        me = current_user()
        if me is None:
            return jsonify({'error': 'נדרשת התחברות'}), 401
        return _page(['(p.author_id = %s OR p.author_id IN '
                      '(SELECT followee_id FROM follows WHERE follower_id = %s))'],
                     [me['id'], me['id']])
    return _page([], [])


@bp.get('/users/<username>/posts')
def user_posts(username):
    """One user's posts (profile page), paged."""
    user = query('SELECT id FROM users WHERE username = %s', (username,), one=True)
    if user is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    return _page(['p.author_id = %s'], [user['id']])


@bp.get('/posts/<int:post_id>')
def get_post(post_id):
    """A single post by id (the #/post/<id> page)."""
    rows = query(f'{_POST_SELECT} WHERE p.id = %s AND u.is_banned = FALSE', (post_id,))
    if not rows:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    return jsonify({'post': _serialize_posts(rows)[0]})


# ── Creating posts ──────────────────────────────────────────────────────────
def normalize_tag(raw):
    """Clean a tag name: drop the '#', spaces → '_', max 50 chars (None if empty)."""
    tag = re.sub(r'\s+', '_', str(raw).strip().lstrip('#'))
    return tag[:50] if tag else None


def _save_tags(post_id, names):
    """Create the missing tags and link them all to the post."""
    for name in names:
        execute('INSERT IGNORE INTO tags (name) VALUES (%s)', (name,))
    rows = query(f'SELECT id FROM tags WHERE name IN ({_in_clause(names)})', names)
    for r in rows:
        execute('INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (%s, %s)', (post_id, r['id']))


@bp.post('/posts')
@login_required
def create_post():
    """Publish a post (project / tutorial / share) with images, steps and tags; notify the shared author + @mentions."""
    me = current_user()
    form = request.form
    kind = form.get('kind', 'project')
    if kind not in ('project', 'tutorial'):
        return jsonify({'error': 'סוג פוסט לא נתמך'}), 400

    body_html = sanitize_html(form.get('body', ''))
    body_text = html_to_text(body_html)
    if len(body_text) > MAX_BODY_CHARS:
        return jsonify({'error': f'הטקסט ארוך מדי (עד {MAX_BODY_CHARS} תווים)'}), 400

    files = [f for f in request.files.getlist('images') if f and f.filename]
    if len(files) > MAX_IMAGES:
        return jsonify({'error': f'עד {MAX_IMAGES} תמונות לפוסט'}), 400

    title, steps = None, None
    if kind == 'tutorial':
        title = (form.get('title') or '').strip()
        if not title or len(title) > 200:
            return jsonify({'error': 'למדריך חייבת להיות כותרת (עד 200 תווים)'}), 400
        steps = []
        for i, s in enumerate(parse_json_list(form.get('steps'))):
            if not isinstance(s, dict) or not str(s.get('title', '')).strip():
                continue
            thumb = s.get('thumb') if s.get('thumb') in STEP_THUMBS else STEP_THUMBS[i % len(STEP_THUMBS)]
            steps.append({'title': str(s['title']).strip()[:120],
                          'note': str(s.get('note', '')).strip()[:300], 'thumb': thumb})
        if not steps:
            return jsonify({'error': 'הוסיפו לפחות שלב אחד למדריך'}), 400

    shared_post_id = form.get('shared_post_id', type=int)
    if shared_post_id:
        original = query('SELECT p.id, p.author_id, p.shared_post_id FROM posts p JOIN users u ON u.id = p.author_id '
                         'WHERE p.id = %s AND u.is_banned = FALSE', (shared_post_id,), one=True)
        if original is None:
            return jsonify({'error': 'הפוסט ששיתפתם לא נמצא'}), 400
        if kind != 'project':
            return jsonify({'error': 'אפשר לשתף רק כפוסט רגיל'}), 400
        # Sharing a share quotes the original post
        if original['shared_post_id']:
            original = query('SELECT id, author_id FROM posts WHERE id = %s', (original['shared_post_id'],), one=True) \
                or original
        shared_post_id = original['id']
    elif kind == 'project' and not body_text and not files:
        return jsonify({'error': 'הפוסט ריק — כתבו משהו או הוסיפו תמונה'}), 400

    # Tags from the tag box + any #hashtags written in the text
    tags = [normalize_tag(t) for t in parse_json_list(form.get('tags'))]
    tags += HASHTAG_RE.findall(body_text)
    tags = list(dict.fromkeys(t for t in tags if t))[:MAX_TAGS]

    try:
        image_urls = [save_image(f) for f in files]
    except UploadError as e:
        return jsonify({'error': str(e)}), 400

    location = (form.get('location') or me.get('location') or '').strip()[:80] or None
    post_id, _ = execute(
        'INSERT INTO posts (author_id, kind, title, body_html, location, steps, shared_post_id) '
        'VALUES (%s, %s, %s, %s, %s, %s, %s)',
        (me['id'], kind, title, body_html, location,
         json.dumps(steps, ensure_ascii=False) if steps is not None else None, shared_post_id))
    for pos, url in enumerate(image_urls):
        execute('INSERT INTO post_images (post_id, url, position) VALUES (%s, %s, %s)', (post_id, url, pos))
    if tags:
        _save_tags(post_id, tags)
    if shared_post_id:
        notify(original['author_id'], me['id'], 'share', post_id, text=body_text)   # opens (and goes with) the share
    notify_mentions(' '.join(t for t in (title, body_text) if t), me['id'], post_id, skip={me['id']})
    commit()

    rows = query(f'{_POST_SELECT} WHERE p.id = %s', (post_id,))
    return jsonify({'post': _serialize_posts(rows)[0]}), 201


@bp.delete('/posts/<int:post_id>')
@login_required
def delete_post(post_id):
    """Delete a post (its author or a moderator) and close the reports on it."""
    post = query('SELECT author_id FROM posts WHERE id = %s', (post_id,), one=True)
    if post is None:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    me = current_user()
    if post['author_id'] != me['id'] and not is_moderator(me):
        return jsonify({'error': 'אפשר למחוק רק פוסטים שלך'}), 403
    execute('DELETE FROM posts WHERE id = %s', (post_id,))
    # Comments on the post go with it (cascade) — close reports on both
    resolve_reports('post', post_id, 'content_deleted', me['id'])
    commit()
    return jsonify({'ok': True})


# ── Hashtags & search ───────────────────────────────────────────────────────
@bp.get('/tags/trending')
def trending_tags():
    """Top 5 hashtags, ranked by how many posts used them in the last `hours` (default: one week).
    `posts` is the exact number of visible posts that carry the tag (all time, banned authors excluded)."""
    hours = min(max(request.args.get('hours', 24 * 7, type=int), 1), 24 * 365)
    rows = query(
        """SELECT t.name, COUNT(*) AS posts,
                  SUM(p.created_at >= UTC_TIMESTAMP() - INTERVAL %s HOUR) AS recent
           FROM post_tags pt
           JOIN tags t  ON t.id = pt.tag_id
           JOIN posts p ON p.id = pt.post_id
           JOIN users u ON u.id = p.author_id
           WHERE u.is_banned = FALSE
           GROUP BY t.id, t.name
           ORDER BY recent DESC, posts DESC, t.name
           LIMIT 5""",
        (hours,))
    return jsonify({'items': [{'tag': '#' + r['name'], 'posts': int(r['posts']), 'recent': int(r['recent'])}
                              for r in rows]})


@bp.get('/search')
def search():
    """Navbar search: people (by username / name), posts and hashtags."""
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify({'people': [], 'posts': [], 'tags': []})
    like = '%' + q.lstrip('@#').replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'

    people = query(
        """SELECT u.* FROM users u
           WHERE u.is_banned = FALSE AND (u.username LIKE %s OR u.name LIKE %s)
           ORDER BY (u.username LIKE %s) DESC,
                    (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) DESC
           LIMIT 4""",
        (like, like, like.lstrip('%')))
    posts = query(f'{_POST_SELECT} WHERE u.is_banned = FALSE AND (p.title LIKE %s OR p.body_html LIKE %s) '
                  'ORDER BY p.id DESC LIMIT 4',
                  (like, like))
    tags = query(
        """SELECT t.name, COUNT(u.id) AS posts FROM tags t
           LEFT JOIN post_tags pt ON pt.tag_id = t.id
           LEFT JOIN posts p ON p.id = pt.post_id
           LEFT JOIN users u ON u.id = p.author_id AND u.is_banned = FALSE
           WHERE t.name LIKE %s GROUP BY t.id, t.name ORDER BY posts DESC LIMIT 5""",
        (like,))
    return jsonify({
        'people': [public_user(r) for r in people],
        'posts': _serialize_posts(posts),
        'tags': [{'tag': r['name'], 'posts': int(r['posts'])} for r in tags],
    })
