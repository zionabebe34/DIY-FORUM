"""Reporting content (any user) and the moderation dashboard API (moderators / admins)."""
from flask import Blueprint, jsonify, request

from auth import current_user, is_admin, login_required, moderator_required
from db import commit, execute, query
from moderation import resolve_reports, resolve_reports_about_user, target_info
from utils import iso, public_user

bp = Blueprint('moderation', __name__, url_prefix='/api')

REASONS = {'spam', 'harassment', 'hate', 'violence', 'misinformation', 'other'}
TARGETS = {'post', 'comment', 'user'}
ROLES = {'user', 'moderator', 'admin'}
ROLE_RANK = {'user': 0, 'moderator': 1, 'admin': 2}


# ── Reporting (any logged-in user) ─────────────────────────────────────────
@bp.post('/reports')
@login_required
def create_report():
    me = current_user()
    data = request.get_json(silent=True) or {}
    target_type = data.get('target_type')
    reason = data.get('reason')
    details = (data.get('details') or '').strip()[:500] or None
    try:
        target_id = int(data.get('target_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'יעד הדיווח לא תקין'}), 400
    if target_type not in TARGETS:
        return jsonify({'error': 'יעד הדיווח לא תקין'}), 400
    if reason not in REASONS:
        return jsonify({'error': 'יש לבחור סיבה לדיווח'}), 400

    info = target_info(target_type, target_id)
    if info is None:
        return jsonify({'error': 'התוכן המדווח לא נמצא'}), 404
    target_user_id, snapshot = info
    if target_user_id == me['id']:
        return jsonify({'error': 'אי אפשר לדווח על עצמך'}), 400

    # One open report per user per target — reporting twice is a no-op
    existing = query("""SELECT id FROM reports WHERE reporter_id = %s AND target_type = %s
                        AND target_id = %s AND status = 'open'""", (me['id'], target_type, target_id), one=True)
    if existing is None:
        execute("""INSERT INTO reports (reporter_id, target_type, target_id, target_user_id, snapshot, reason, details)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (me['id'], target_type, target_id, target_user_id, snapshot, reason, details))
        commit()
    return jsonify({'ok': True}), 201


# ── Dashboard ───────────────────────────────────────────────────────────────
@bp.get('/admin/stats')
@moderator_required
def stats():
    row = query("""SELECT
        (SELECT COUNT(*) FROM reports WHERE status = 'open') AS open_reports,
        (SELECT COUNT(DISTINCT target_type, target_id) FROM reports WHERE status = 'open') AS open_cases,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE is_banned = TRUE) AS banned_users,
        (SELECT COUNT(*) FROM posts) AS posts,
        (SELECT COUNT(*) FROM comments) AS comments""", one=True)
    return jsonify({k: int(v) for k, v in row.items()})


def _user_brief(row, prefix):
    if row[f'{prefix}_id'] is None:
        return None
    return {'id': row[f'{prefix}_id'], 'username': row[f'{prefix}_username'], 'name': row[f'{prefix}_name'],
            'avatar_url': row[f'{prefix}_avatar_url'], 'is_banned': bool(row.get(f'{prefix}_is_banned')),
            'role': row.get(f'{prefix}_role') or 'user'}


@bp.get('/admin/reports')
@moderator_required
def list_reports():
    """Reports grouped into "cases" (one per reported target), newest activity first."""
    status = request.args.get('status', 'open')
    if status not in ('open', 'closed'):
        return jsonify({'error': 'סטטוס לא תקין'}), 400
    status_sql = "r.status = 'open'" if status == 'open' else "r.status <> 'open'"
    rows = query(f"""
        SELECT r.*,
               rep.id AS rep_id, rep.username AS rep_username, rep.name AS rep_name, rep.avatar_url AS rep_avatar_url,
               tu.id AS tu_id, tu.username AS tu_username, tu.name AS tu_name, tu.avatar_url AS tu_avatar_url,
               tu.is_banned AS tu_is_banned, tu.role AS tu_role,
               mod_u.username AS resolved_by_username,
               CASE r.target_type
                 WHEN 'post'    THEN EXISTS(SELECT 1 FROM posts p WHERE p.id = r.target_id)
                 WHEN 'comment' THEN EXISTS(SELECT 1 FROM comments c WHERE c.id = r.target_id)
                 ELSE EXISTS(SELECT 1 FROM users x WHERE x.id = r.target_id) END AS target_exists,
               (SELECT c.post_id FROM comments c WHERE r.target_type = 'comment' AND c.id = r.target_id) AS comment_post_id
        FROM reports r
        LEFT JOIN users rep   ON rep.id = r.reporter_id
        LEFT JOIN users tu    ON tu.id = r.target_user_id
        LEFT JOIN users mod_u ON mod_u.id = r.resolved_by
        WHERE {status_sql}
        ORDER BY r.id DESC
        LIMIT 500""")

    cases = {}
    for r in rows:
        key = (r['target_type'], r['target_id'])
        case = cases.get(key)
        if case is None:
            case = cases[key] = {
                'target_type': r['target_type'],
                'target_id': r['target_id'],
                'post_id': r['target_id'] if r['target_type'] == 'post' else r['comment_post_id'],
                'target_exists': bool(r['target_exists']),
                'snapshot': r['snapshot'],
                'target_user': _user_brief(r, 'tu'),
                'status': r['status'],
                'resolution': r['resolution'],
                'resolved_by': r['resolved_by_username'],
                'resolved_at': iso(r['resolved_at']),
                'last_reported_at': iso(r['created_at']),
                'report_ids': [],
                'reports': [],
                'reasons': {},
            }
        case['report_ids'].append(r['id'])
        case['reasons'][r['reason']] = case['reasons'].get(r['reason'], 0) + 1
        case['reports'].append({
            'id': r['id'], 'reason': r['reason'], 'details': r['details'], 'created_at': iso(r['created_at']),
            'reporter': _user_brief(r, 'rep'),   # None = automatic flag
            'automatic': r['reporter_id'] is None,
        })
    items = list(cases.values())
    for case in items:
        case['count'] = len(case['reports'])
    return jsonify({'items': items})


@bp.post('/admin/cases/dismiss')
@moderator_required
def dismiss_case():
    """Mark a case as "no violation": closes every open report on the target."""
    data = request.get_json(silent=True) or {}
    if data.get('target_type') not in TARGETS or not isinstance(data.get('target_id'), int):
        return jsonify({'error': 'יעד לא תקין'}), 400
    resolve_reports(data['target_type'], data['target_id'], 'dismissed', current_user()['id'])
    commit()
    return jsonify({'ok': True})


# ── Users: search, ban / unban, roles ───────────────────────────────────────
def _target_user(username):
    return query('SELECT * FROM users WHERE username = %s', (username,), one=True)


def _can_act_on(me, target):
    """Moderators may act on regular users; admins on anyone but themselves."""
    if target['id'] == me['id']:
        return False
    return ROLE_RANK[me['role']] > ROLE_RANK[target['role']] or is_admin(me)


@bp.get('/admin/users')
@moderator_required
def admin_users():
    q = (request.args.get('q') or '').strip().lstrip('@')
    filt = request.args.get('filter', 'all')
    clauses, params = [], []
    if q:
        like = '%' + q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        clauses.append('(u.username LIKE %s OR u.name LIKE %s OR u.email LIKE %s)')
        params += [like, like, like]
    if filt == 'banned':
        clauses.append('u.is_banned = TRUE')
    elif filt == 'staff':
        clauses.append("u.role <> 'user'")
    where = ('WHERE ' + ' AND '.join(clauses)) if clauses else ''
    rows = query(f"""SELECT u.*,
                       (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts_count,
                       (SELECT COUNT(*) FROM reports r WHERE r.target_user_id = u.id) AS reports_count
                     FROM users u {where}
                     ORDER BY reports_count DESC, u.id DESC LIMIT 50""", params)
    return jsonify({'items': [public_user(r, {
        'email': r['email'], 'ban_reason': r['ban_reason'], 'banned_at': iso(r['banned_at']),
        'posts_count': int(r['posts_count']), 'reports_count': int(r['reports_count']),
    }) for r in rows]})


@bp.post('/admin/users/<username>/ban')
@moderator_required
def ban_user(username):
    me = current_user()
    target = _target_user(username)
    if target is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    if not _can_act_on(me, target):
        return jsonify({'error': 'אין הרשאה לחסום את המשתמש הזה'}), 403
    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or '').strip()[:300] or None
    execute('UPDATE users SET is_banned = TRUE, ban_reason = %s, banned_at = UTC_TIMESTAMP() WHERE id = %s',
            (reason, target['id']))
    execute('DELETE FROM sessions WHERE user_id = %s', (target['id'],))   # log them out everywhere
    if data.get('delete_content'):
        execute('DELETE FROM posts WHERE author_id = %s', (target['id'],))
        execute('DELETE FROM comments WHERE author_id = %s', (target['id'],))
    resolve_reports_about_user(target['id'], 'user_banned', me['id'])
    commit()
    return jsonify({'ok': True, 'is_banned': True})


@bp.post('/admin/users/<username>/unban')
@moderator_required
def unban_user(username):
    me = current_user()
    target = _target_user(username)
    if target is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    if not _can_act_on(me, target):
        return jsonify({'error': 'אין הרשאה'}), 403
    execute('UPDATE users SET is_banned = FALSE, ban_reason = NULL, banned_at = NULL WHERE id = %s', (target['id'],))
    commit()
    return jsonify({'ok': True, 'is_banned': False})


@bp.put('/admin/users/<username>/role')
@moderator_required
def set_role(username):
    me = current_user()
    if not is_admin(me):
        return jsonify({'error': 'רק מנהל ראשי יכול לשנות תפקידים'}), 403
    target = _target_user(username)
    if target is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    if target['id'] == me['id']:
        return jsonify({'error': 'אי אפשר לשנות את התפקיד של עצמך'}), 400
    role = (request.get_json(silent=True) or {}).get('role')
    if role not in ROLES:
        return jsonify({'error': 'תפקיד לא חוקי'}), 400
    execute('UPDATE users SET role = %s WHERE id = %s', (role, target['id']))
    commit()
    return jsonify({'ok': True, 'role': role})
