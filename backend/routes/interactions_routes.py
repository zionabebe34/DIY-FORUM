"""Likes ("hearts") on posts and the comment threads under them."""
from flask import Blueprint, jsonify, request
from mysql.connector import errors as mysql_errors

from auth import current_user, is_moderator, login_required
from moderation import resolve_reports
from notifications import notify, notify_mentions, unnotify
import toxicity
from db import commit, execute, query
from utils import iso

bp = Blueprint('interactions', __name__, url_prefix='/api')

MAX_COMMENT_CHARS = 1000
MAX_COMMENTS = 300   # per request — plenty for a post's thread


def _post_exists(post_id):
    return query('SELECT id FROM posts WHERE id = %s', (post_id,), one=True) is not None


def _post_author(post_id):
    row = query('SELECT author_id FROM posts WHERE id = %s', (post_id,), one=True)
    return row and row['author_id']


def _likes_count(post_id):
    return int(query('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = %s', (post_id,), one=True)['n'])


# ── Likes ───────────────────────────────────────────────────────────────────
@bp.post('/posts/<int:post_id>/like')
@login_required
def like(post_id):
    author_id = _post_author(post_id)
    if author_id is None:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    me = current_user()['id']
    try:
        execute('INSERT INTO post_likes (user_id, post_id) VALUES (%s, %s)', (me, post_id))
        notify(author_id, me, 'like', post_id)
        commit()
    except mysql_errors.IntegrityError:
        pass  # already liked — liking is idempotent
    return jsonify({'liked': True, 'likes_count': _likes_count(post_id)})


@bp.delete('/posts/<int:post_id>/like')
@login_required
def unlike(post_id):
    author_id = _post_author(post_id)
    if author_id is None:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    me = current_user()['id']
    execute('DELETE FROM post_likes WHERE user_id = %s AND post_id = %s', (me, post_id))
    unnotify(author_id, me, 'like', post_id)
    commit()
    return jsonify({'liked': False, 'likes_count': _likes_count(post_id)})


# ── Comments ────────────────────────────────────────────────────────────────
_COMMENT_SELECT = """
    SELECT c.id, c.post_id, c.parent_id, c.body, c.created_at,
           u.id AS u_id, u.username, u.name, u.avatar_url, u.verified, u.is_agent
    FROM comments c JOIN users u ON u.id = c.author_id
"""


def _serialize_comment(r):
    return {
        'id': r['id'],
        'post_id': r['post_id'],
        'parent_id': r['parent_id'],
        'body': r['body'],
        'created_at': iso(r['created_at']),
        'author': {
            'id': r['u_id'], 'username': r['username'], 'name': r['name'], 'avatar_url': r['avatar_url'],
            'verified': bool(r['verified']), 'is_agent': bool(r['is_agent']),
        },
    }


@bp.get('/posts/<int:post_id>/comments')
def list_comments(post_id):
    """The whole thread, oldest first. Replies carry parent_id of their top-level comment."""
    if not _post_exists(post_id):
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    rows = query(f'{_COMMENT_SELECT} WHERE c.post_id = %s AND u.is_banned = FALSE ORDER BY c.id LIMIT %s',
                 (post_id, MAX_COMMENTS))
    return jsonify({'items': [_serialize_comment(r) for r in rows]})


@bp.post('/posts/<int:post_id>/comments')
@login_required
def add_comment(post_id):
    post_author = _post_author(post_id)
    if post_author is None:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    data = request.get_json(silent=True) or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'התגובה ריקה'}), 400
    if len(body) > MAX_COMMENT_CHARS:
        return jsonify({'error': f'התגובה ארוכה מדי (עד {MAX_COMMENT_CHARS} תווים)'}), 400

    parent_id, parent_author = data.get('parent_id'), None
    if parent_id is not None:
        parent = query('SELECT id, post_id, parent_id, author_id FROM comments WHERE id = %s', (parent_id,), one=True)
        if parent is None or parent['post_id'] != post_id:
            return jsonify({'error': 'התגובה שעונים לה לא נמצאה'}), 400
        # Only one level of nesting: a reply to a reply joins the same top-level thread
        parent_id = parent['parent_id'] or parent['id']
        parent_author = parent['author_id']

    me = current_user()['id']
    # Toxicity check before publishing (part 2 e.iii): block → 422; warn → 409 until the author confirms
    blocked, verdict = toxicity.guard(body, bool(data.get('confirm')), me)
    if blocked:
        return blocked
    comment_id, _ = execute('INSERT INTO comments (post_id, author_id, parent_id, body) VALUES (%s, %s, %s, %s)',
                            (post_id, me, parent_id, body))
    # The person replied to hears about a reply; the post's author about any other comment
    if parent_author and parent_author != me:
        notify(parent_author, me, 'reply', post_id, comment_id, body)
    if post_author != parent_author:
        notify(post_author, me, 'comment', post_id, comment_id, body)
    notify_mentions(body, me, post_id, comment_id, skip={me, post_author, parent_author})
    toxicity.flag_if_needed(verdict, 'comment', comment_id)   # published after a warning → a moderator takes a look
    commit()
    row = query(f'{_COMMENT_SELECT} WHERE c.id = %s', (comment_id,), one=True)
    return jsonify({'comment': _serialize_comment(row)}), 201


@bp.delete('/comments/<int:comment_id>')
@login_required
def delete_comment(comment_id):
    """The comment's author, the post's author, or a moderator may delete it (with its replies)."""
    row = query('SELECT c.author_id, p.author_id AS post_author FROM comments c '
                'JOIN posts p ON p.id = c.post_id WHERE c.id = %s', (comment_id,), one=True)
    if row is None:
        return jsonify({'error': 'התגובה לא נמצאה'}), 404
    me = current_user()
    if me['id'] not in (row['author_id'], row['post_author']) and not is_moderator(me):
        return jsonify({'error': 'אין הרשאה למחוק את התגובה'}), 403
    execute('DELETE FROM comments WHERE id = %s', (comment_id,))
    resolve_reports('comment', comment_id, 'content_deleted', me['id'])
    commit()
    return jsonify({'ok': True})
