"""Password hashing, session tokens and the login_required decorator."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
from flask import current_app, g, jsonify, make_response, request

from db import commit, execute, query
from utils import private_user

SESSION_COOKIE = 'hh_session'
SESSION_DAYS = 14


def hash_password(plain):
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def check_password(plain, hashed):
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def create_session(user_id):
    """Create a session row and return the raw token (only the hash is stored)."""
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=SESSION_DAYS)
    execute('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%s, %s, %s)',
            (user_id, token_hash(token), expires))
    return token


def delete_session(token):
    execute('DELETE FROM sessions WHERE token_hash = %s', (token_hash(token),))


def set_session_cookie(response, token):
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite='Lax',
        secure=current_app.config['COOKIE_SECURE'],
    )


def clear_session_cookie(response):
    response.delete_cookie(SESSION_COOKIE, samesite='Lax')


def login_response(user_row, status=200, extra=None):
    """Start a session: set the cookie and return the user (plus any `extra` fields)."""
    token = create_session(user_row['id'])
    commit()
    response = make_response(jsonify({'user': private_user(user_row), **(extra or {})}), status)
    set_session_cookie(response, token)
    return response


def current_user():
    """The logged-in user row (cached per request), or None."""
    if 'user' in g:
        return g.user
    g.user = None
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        g.user = query(
            """SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.token_hash = %s AND s.expires_at > UTC_TIMESTAMP() AND u.is_banned = FALSE""",
            (token_hash(token),), one=True)
    return g.user


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if current_user() is None:
            return jsonify({'error': 'נדרשת התחברות'}), 401
        return view(*args, **kwargs)
    return wrapper


def is_moderator(user):
    return user is not None and user.get('role') in ('moderator', 'admin')


def is_admin(user):
    return user is not None and user.get('role') == 'admin'


def moderator_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({'error': 'נדרשת התחברות'}), 401
        if not is_moderator(user):
            return jsonify({'error': 'אין הרשאת ניהול'}), 403
        return view(*args, **kwargs)
    return wrapper
