"""Creating / removing notifications from the routes that cause them (no commit — the caller commits)."""
import re

from db import execute, query

MENTION_RE = re.compile(r'(?<![\w@])@([A-Za-z0-9_.]{3,30})')
MAX_MENTIONS = 5
SNIPPET_CHARS = 140


def notify(user_id, actor_id, kind, post_id=None, comment_id=None, text=None):
    """Tell `user_id` that `actor_id` did something. Nobody is notified about their own actions."""
    if user_id is None or user_id == actor_id:
        return
    execute('INSERT INTO notifications (user_id, actor_id, kind, post_id, comment_id, text) '
            'VALUES (%s, %s, %s, %s, %s, %s)',
            (user_id, actor_id, kind, post_id, comment_id, (text or '')[:SNIPPET_CHARS] or None))


def unnotify(user_id, actor_id, kind, post_id=None):
    """Undo: unlike / unfollow / unsave removes the matching notification."""
    execute('DELETE FROM notifications WHERE user_id = %s AND actor_id = %s AND kind = %s AND post_id <=> %s',
            (user_id, actor_id, kind, post_id))


def notify_mentions(text, actor_id, post_id, comment_id=None, skip=()):
    """@username in a post or comment → a 'mention' notification for that user (up to MAX_MENTIONS)."""
    names = list(dict.fromkeys(MENTION_RE.findall(text or '')))[:MAX_MENTIONS]
    if not names:
        return
    marks = ', '.join(['%s'] * len(names))
    rows = query(f'SELECT id FROM users WHERE username IN ({marks}) AND is_banned = FALSE', names)
    for r in rows:
        if r['id'] not in skip:
            notify(r['id'], actor_id, 'mention', post_id, comment_id, text)


def notify_system(user_id, text):
    execute("INSERT INTO notifications (user_id, kind, text) VALUES (%s, 'system', %s)", (user_id, text))
