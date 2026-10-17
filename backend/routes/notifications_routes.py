"""The logged-in user's notifications: list, unread count (polled), mark as read."""
from flask import Blueprint, jsonify, request

from auth import current_user, login_required
from db import commit, execute, query
from utils import html_to_text, iso, user_brief, user_brief_sql

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

PAGE = 30
FILTERS = {
    'all': '',
    'unread': 'AND n.read_at IS NULL',
    'mentions': "AND n.kind IN ('comment', 'reply', 'mention')",
}


def _post_label(r):
    """Short {id, kind, title} of the notification's post (None if it has none)."""
    if r['post_id'] is None:
        return None
    text = r['p_title'] or html_to_text(r['p_body_html'] or '')
    return {'id': r['post_id'], 'kind': r['p_kind'], 'title': text[:80]}


def _serialize(r):
    """Notification row → API dict (actor, post label, read)."""
    return {
        'id': r['id'], 'kind': r['kind'], 'text': r['text'], 'created_at': iso(r['created_at']),
        'read': r['read_at'] is not None, 'comment_id': r['comment_id'],
        'actor': user_brief(r, 'a_') if r['a_id'] is not None else None,
        'post': _post_label(r),
    }


def _unread_count(user_id):
    """The user's unread notifications (ignores ones from banned users)."""
    return int(query("""SELECT COUNT(*) AS n FROM notifications n LEFT JOIN users a ON a.id = n.actor_id
                        WHERE n.user_id = %s AND n.read_at IS NULL AND (a.id IS NULL OR a.is_banned = FALSE)""",
                     (user_id,), one=True)['n'])


@bp.get('')
@login_required
def list_notifications():
    """Newest first. ?filter=all|unread|mentions, keyset paging with ?before=<id>."""
    me = current_user()['id']
    where = FILTERS.get(request.args.get('filter'), '')
    before = request.args.get('before', type=int)
    params = [me]
    if before:
        where += ' AND n.id < %s'
        params.append(before)
    rows = query(f"""
        SELECT n.*, {user_brief_sql('a', 'a_')}, p.kind AS p_kind, p.title AS p_title, p.body_html AS p_body_html
        FROM notifications n
        LEFT JOIN users a ON a.id = n.actor_id
        LEFT JOIN posts p ON p.id = n.post_id
        WHERE n.user_id = %s AND (a.id IS NULL OR a.is_banned = FALSE) {where}
        ORDER BY n.id DESC LIMIT %s""", (*params, PAGE + 1))
    has_more = len(rows) > PAGE
    rows = rows[:PAGE]
    return jsonify({'items': [_serialize(r) for r in rows],
                    'next_cursor': rows[-1]['id'] if has_more else None,
                    'unread': _unread_count(me)})


@bp.get('/unread')
@login_required
def unread():
    """Polled by the browser for the bell badge."""
    return jsonify({'count': _unread_count(current_user()['id'])})


@bp.post('/read')
@login_required
def mark_read():
    """Body {"ids": [...]} marks those; no ids → mark everything as read."""
    me = current_user()['id']
    ids = [i for i in ((request.get_json(silent=True) or {}).get('ids') or []) if isinstance(i, int)]
    if ids:
        marks = ', '.join(['%s'] * len(ids))
        execute(f'UPDATE notifications SET read_at = UTC_TIMESTAMP() '
                f'WHERE user_id = %s AND read_at IS NULL AND id IN ({marks})', (me, *ids))
    else:
        execute('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = %s AND read_at IS NULL', (me,))
    commit()
    return jsonify({'unread': _unread_count(me)})
