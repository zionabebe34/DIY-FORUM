"""Profiles, profile editing, follow graph, user search and suggestions."""
import json

from flask import Blueprint, jsonify, request
from mysql.connector import errors as mysql_errors

from auth import current_user, login_required
from db import commit, execute, query
from notifications import notify, unnotify
from utils import COVERS, UploadError, parse_json_list, private_user, public_user, save_image

bp = Blueprint('users', __name__, url_prefix='/api/users')

PAGE_SIZE = 20


def _like_escape(text):
    """Escape %, _ and backslash for a SQL LIKE pattern."""
    return text.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def _me_id():
    """The viewer's user id, or 0 when logged out."""
    me = current_user()
    return me['id'] if me else 0  # 0 never matches a real user id


def _user_or_404(username):
    """The user row of a username, or None."""
    return query('SELECT * FROM users WHERE username = %s', (username,), one=True)


def _user_list(rows):
    """User rows → public user dicts with is_following."""
    return [public_user(r, {'is_following': bool(r['is_following'])}) for r in rows]


# Selects users plus whether the viewer (%s) follows each of them.
_USER_WITH_FOLLOWING = """
    SELECT u.*, (vf.follower_id IS NOT NULL) AS is_following
    FROM users u
    LEFT JOIN follows vf ON vf.followee_id = u.id AND vf.follower_id = %s
"""


@bp.get('/search')
def search_users():
    """Search users by username / name (best match first, up to 8)."""
    q = (request.args.get('q') or '').strip().lstrip('@')
    if not q:
        return jsonify({'items': []})
    like = _like_escape(q)
    rows = query(
        _USER_WITH_FOLLOWING + """
        WHERE u.is_banned = FALSE AND (u.username LIKE %s OR u.name LIKE %s)
        ORDER BY (u.username LIKE %s) DESC,
                 (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) DESC,
                 u.username
        LIMIT 8""",
        (_me_id(), f'%{like}%', f'%{like}%', f'{like}%'))
    return jsonify({'items': _user_list(rows)})


@bp.get('/suggested')
def suggested_users():
    """People you don't follow yet, ranked by mutual follows, then popularity."""
    me = _me_id()
    rows = query(
        """SELECT u.*, FALSE AS is_following,
                  (SELECT COUNT(*) FROM follows m
                     JOIN follows mine ON mine.followee_id = m.follower_id AND mine.follower_id = %s
                    WHERE m.followee_id = u.id) AS mutuals,
                  (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers
           FROM users u
           WHERE u.id <> %s AND u.is_banned = FALSE
             AND NOT EXISTS (SELECT 1 FROM follows x WHERE x.follower_id = %s AND x.followee_id = u.id)
           ORDER BY mutuals DESC, followers DESC, u.id
           LIMIT 5""",
        (me, me, me))
    return jsonify({'items': [public_user(r, {'is_following': False, 'mutuals': int(r['mutuals'])})
                              for r in rows]})


@bp.get('/<username>')
def get_profile(username):
    """A user's profile with follower / following / post counts and the follow status between us."""
    user = _user_or_404(username)
    if user is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    me = _me_id()
    counts = query(
        """SELECT
             (SELECT COUNT(*) FROM follows WHERE followee_id = %s) AS followers,
             (SELECT COUNT(*) FROM follows WHERE follower_id = %s) AS following,
             (SELECT COUNT(*) FROM posts   WHERE author_id   = %s) AS posts,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = %s AND followee_id = %s) AS is_following,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = %s AND followee_id = %s) AS follows_you""",
        (user['id'], user['id'], user['id'], me, user['id'], user['id'], me), one=True)
    return jsonify({'user': public_user(user, {
        'followers_count': int(counts['followers']),
        'following_count': int(counts['following']),
        'posts_count': int(counts['posts']),
        'is_following': bool(counts['is_following']),
        'follows_you': bool(counts['follows_you']),
        'is_me': user['id'] == me,
    })})


@bp.put('/me')
@login_required
def update_me():
    """Edit own profile. Accepts multipart/form-data (to allow an avatar file) or JSON."""
    me = current_user()
    data = request.form if request.files or request.form else (request.get_json(silent=True) or {})
    fields = {}

    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name or len(name) > 80:
            return jsonify({'error': 'יש להזין שם (עד 80 תווים)'}), 400
        fields['name'] = name
    if 'bio' in data:
        bio = (data.get('bio') or '').strip()
        if len(bio) > 500:
            return jsonify({'error': 'הביו ארוך מדי (עד 500 תווים)'}), 400
        fields['bio'] = bio
    if 'location' in data:
        location = (data.get('location') or '').strip()
        if len(location) > 80:
            return jsonify({'error': 'מיקום ארוך מדי'}), 400
        fields['location'] = location
    if 'cover' in data:
        if data.get('cover') not in COVERS:
            return jsonify({'error': 'רקע לא חוקי'}), 400
        fields['cover'] = data.get('cover')
    if 'skills' in data:
        skills = [str(s).strip()[:30] for s in parse_json_list(data.get('skills')) if str(s).strip()]
        if len(skills) > 12:
            return jsonify({'error': 'עד 12 תחומי התמחות'}), 400
        fields['skills'] = json.dumps(skills, ensure_ascii=False)
    if data.get('remove_avatar') in ('1', 'true', True):
        fields['avatar_url'] = None
    if 'avatar' in request.files:
        try:
            fields['avatar_url'] = save_image(request.files['avatar'])
        except UploadError as e:
            return jsonify({'error': str(e)}), 400

    if fields:
        assignments = ', '.join(f'{col} = %s' for col in fields)
        execute(f'UPDATE users SET {assignments} WHERE id = %s', (*fields.values(), me['id']))
        commit()
    user = query('SELECT * FROM users WHERE id = %s', (me['id'],), one=True)
    return jsonify({'user': private_user(user)})


def _follow_list(username, join_col, match_col):
    """A user's followers or following, paged (offset cursor)."""
    user = _user_or_404(username)
    if user is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    offset = max(request.args.get('cursor', 0, type=int), 0)
    rows = query(
        _USER_WITH_FOLLOWING + f"""
        JOIN follows f ON f.{join_col} = u.id
        WHERE f.{match_col} = %s
        ORDER BY f.created_at DESC, u.id DESC
        LIMIT %s OFFSET %s""",
        (_me_id(), user['id'], PAGE_SIZE + 1, offset))
    has_more = len(rows) > PAGE_SIZE
    return jsonify({'items': _user_list(rows[:PAGE_SIZE]),
                    'next_cursor': offset + PAGE_SIZE if has_more else None})


@bp.get('/<username>/followers')
def followers(username):
    """Who follows this user."""
    return _follow_list(username, join_col='follower_id', match_col='followee_id')


@bp.get('/<username>/following')
def following(username):
    """Who this user follows."""
    return _follow_list(username, join_col='followee_id', match_col='follower_id')


@bp.post('/<username>/follow')
@login_required
def follow(username):
    """Follow a user (idempotent) and notify them."""
    me = current_user()
    target = _user_or_404(username)
    if target is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    if target['id'] == me['id']:
        return jsonify({'error': 'אי אפשר לעקוב אחרי עצמך'}), 400
    try:
        execute('INSERT INTO follows (follower_id, followee_id) VALUES (%s, %s)', (me['id'], target['id']))
        notify(target['id'], me['id'], 'follow')
        commit()
    except mysql_errors.IntegrityError:
        pass  # already following — follow is idempotent
    return jsonify({'is_following': True, 'followers_count': _followers_count(target['id'])})


@bp.delete('/<username>/follow')
@login_required
def unfollow(username):
    """Unfollow a user and remove the follow notification."""
    me = current_user()
    target = _user_or_404(username)
    if target is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    execute('DELETE FROM follows WHERE follower_id = %s AND followee_id = %s', (me['id'], target['id']))
    unnotify(target['id'], me['id'], 'follow')
    commit()
    return jsonify({'is_following': False, 'followers_count': _followers_count(target['id'])})


def _followers_count(user_id):
    """Number of followers a user has."""
    return int(query('SELECT COUNT(*) AS n FROM follows WHERE followee_id = %s', (user_id,), one=True)['n'])
