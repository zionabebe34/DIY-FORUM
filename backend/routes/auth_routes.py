"""Sign-up, login, logout, and "who am I"."""
from flask import Blueprint, jsonify, make_response, request
from mysql.connector import errors as mysql_errors

from auth import (SESSION_COOKIE, check_password, clear_session_cookie, create_session,
                  current_user, delete_session, hash_password, set_session_cookie)
from db import commit, execute, query
from utils import EMAIL_RE, USERNAME_RE, private_user

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _login_response(user_row, status=200):
    token = create_session(user_row['id'])
    commit()
    response = make_response(jsonify({'user': private_user(user_row)}), status)
    set_session_cookie(response, token)
    return response


@bp.post('/signup')
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    username = (data.get('username') or '').strip().lstrip('@')
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or len(name) > 80:
        return jsonify({'error': 'יש להזין שם (עד 80 תווים)'}), 400
    if not USERNAME_RE.match(username):
        return jsonify({'error': 'שם משתמש: 3–30 תווים, אותיות באנגלית, ספרות, _ או .'}), 400
    if not EMAIL_RE.match(email):
        return jsonify({'error': 'כתובת אימייל לא תקינה'}), 400
    if len(password) < 8:
        return jsonify({'error': 'הסיסמה חייבת להכיל לפחות 8 תווים'}), 400

    existing = query('SELECT username, email FROM users WHERE username = %s OR email = %s',
                     (username, email))
    if any(r['email'] == email for r in existing):
        return jsonify({'error': 'האימייל כבר רשום במערכת'}), 409
    if existing:
        return jsonify({'error': 'שם המשתמש תפוס'}), 409

    try:
        user_id, _ = execute(
            'INSERT INTO users (username, email, password_hash, name, skills) VALUES (%s, %s, %s, %s, %s)',
            (username, email, hash_password(password), name, '[]'))
    except mysql_errors.IntegrityError:  # lost a race with a concurrent signup
        return jsonify({'error': 'שם המשתמש או האימייל כבר תפוסים'}), 409

    user = query('SELECT * FROM users WHERE id = %s', (user_id,), one=True)
    return _login_response(user, 201)


@bp.post('/login')
def login():
    data = request.get_json(silent=True) or {}
    login_id = (data.get('login') or '').strip().lstrip('@')
    password = data.get('password') or ''
    if not login_id or not password:
        return jsonify({'error': 'יש להזין אימייל/שם משתמש וסיסמה'}), 400

    user = query('SELECT * FROM users WHERE email = %s OR username = %s',
                 (login_id.lower(), login_id), one=True)
    if user is None or not check_password(password, user['password_hash']):
        return jsonify({'error': 'פרטי התחברות שגויים'}), 401
    return _login_response(user)


@bp.post('/logout')
def logout():
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        delete_session(token)
        commit()
    response = make_response(jsonify({'ok': True}))
    clear_session_cookie(response)
    return response


@bp.get('/me')
def me():
    user = current_user()
    return jsonify({'user': private_user(user) if user else None})
