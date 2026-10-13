"""Shared moderation helpers: content snapshots for reports and closing reports."""
from db import execute, query
from utils import html_to_text

SNAPSHOT_CHARS = 500


def target_info(target_type, target_id):
    """(author/user id, text snapshot) of a reportable target, or None if it doesn't exist."""
    if target_type == 'post':
        row = query('SELECT author_id, title, body_html FROM posts WHERE id = %s', (target_id,), one=True)
        if row is None:
            return None
        text = ' — '.join(t for t in (row['title'], html_to_text(row['body_html'])) if t)
        return row['author_id'], text[:SNAPSHOT_CHARS]
    if target_type == 'comment':
        row = query('SELECT author_id, body FROM comments WHERE id = %s', (target_id,), one=True)
        return None if row is None else (row['author_id'], row['body'][:SNAPSHOT_CHARS])
    if target_type == 'user':
        row = query('SELECT id, username, name, bio FROM users WHERE id = %s', (target_id,), one=True)
        if row is None:
            return None
        return row['id'], f"@{row['username']} · {row['name']} · {row['bio'] or ''}"[:SNAPSHOT_CHARS]
    return None


def resolve_reports(target_type, target_id, resolution, actor_id):
    """Close every open report about one target (no commit)."""
    execute("""UPDATE reports SET status = %s, resolution = %s, resolved_by = %s, resolved_at = UTC_TIMESTAMP()
               WHERE target_type = %s AND target_id = %s AND status = 'open'""",
            ('dismissed' if resolution == 'dismissed' else 'resolved', resolution, actor_id,
             target_type, target_id))


def resolve_reports_about_user(user_id, resolution, actor_id):
    """Close every open report on a user and on anything they wrote (no commit)."""
    execute("""UPDATE reports SET status = 'resolved', resolution = %s, resolved_by = %s, resolved_at = UTC_TIMESTAMP()
               WHERE target_user_id = %s AND status = 'open'""",
            (resolution, actor_id, user_id))
