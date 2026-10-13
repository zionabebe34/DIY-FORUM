"""Sign-up, login, logout, and "who am I"."""
import secrets
from html import escape

from flask import Blueprint, current_app, jsonify, make_response, request
from mysql.connector import errors as mysql_errors

from auth import (SESSION_COOKIE, check_password, clear_session_cookie, create_session,
                  current_user, delete_session, hash_password, set_session_cookie, token_hash)
from db import commit, execute, query
from mailer import send_email
from notifications import notify_system
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
    notify_system(user_id, f'ברוכים הבאים ל-HandyHub, {name}! שתפו את הפרויקט הראשון שלכם 🛠️')

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
    if user['is_banned']:
        return jsonify({'error': 'החשבון נחסם על ידי צוות הניהול'}), 403
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


# ── Password reset by email ─────────────────────────────────────────────────
RESET_MINUTES = 30
RESETS_PER_HOUR = 3
FORGOT_MESSAGE = 'אם הכתובת רשומה אצלנו, שלחנו אליה קישור לאיפוס הסיסמה. הקישור תקף ל-30 דקות.'


def _valid_reset(token):
    """The unexpired, unused reset row for this token (joined with its user), or None."""
    if not token or len(token) > 200:
        return None
    return query("""SELECT r.id AS reset_id, u.* FROM password_resets r JOIN users u ON u.id = r.user_id
                    WHERE r.token_hash = %s AND r.used_at IS NULL AND r.expires_at > UTC_TIMESTAMP()
                      AND u.is_banned = FALSE""", (token_hash(token),), one=True)


def _reset_email(user, link):
    text = (f'שלום {user["name"]},\n\n'
            f'קיבלנו בקשה לאפס את הסיסמה לחשבון HandyHub שלך (@{user["username"]}).\n'
            f'לבחירת סיסמה חדשה היכנסו לקישור (תקף ל-{RESET_MINUTES} דקות):\n{link}\n\n'
            'אם לא ביקשתם איפוס — אפשר להתעלם מהמייל, הסיסמה שלכם לא השתנתה.\n\nצוות HandyHub')
    html = f"""<div dir="rtl" style="font-family:Arial,sans-serif;background:#fbf6ec;padding:24px;color:#162a23">
  <div style="max-width:480px;margin:auto;background:#fff;border:1px solid #e7dcc4;border-radius:16px;padding:24px">
    <h2 style="margin:0 0 12px">איפוס סיסמה ל-HandyHub</h2>
    <p>שלום {escape(user['name'])},</p>
    <p>קיבלנו בקשה לאפס את הסיסמה לחשבון <b>@{escape(user['username'])}</b>.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="{escape(link)}" style="background:#c8551d;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold">בחירת סיסמה חדשה</a>
    </p>
    <p style="font-size:13px;color:#5d7068">הקישור תקף ל-{RESET_MINUTES} דקות וניתן לשימוש פעם אחת.
    אם לא ביקשתם איפוס — אפשר להתעלם מהמייל, הסיסמה שלכם לא השתנתה.</p>
  </div>
</div>"""
    return text, html


def _dev_note(message):
    """Explain in the server log why no email went out. The HTTP response stays
    identical either way, so nothing leaks to the browser."""
    print(f'[password reset] {message}', flush=True)


@bp.post('/forgot')
def forgot_password():
    """Always answers the same way, so it can't be used to discover which emails are registered."""
    email = ((request.get_json(silent=True) or {}).get('email') or '').strip().lower()
    if not EMAIL_RE.match(email):
        return jsonify({'error': 'כתובת אימייל לא תקינה'}), 400

    user = query('SELECT * FROM users WHERE email = %s AND is_banned = FALSE', (email,), one=True)
    if user is None:
        _dev_note(f'no active account with email {email} — no email sent')
    else:
        recent = query("""SELECT COUNT(*) AS n FROM password_resets
                          WHERE user_id = %s AND created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR""",
                       (user['id'],), one=True)['n']
        if recent < RESETS_PER_HOUR:
            token = secrets.token_urlsafe(32)
            # Only the newest link works
            execute('UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE user_id = %s AND used_at IS NULL',
                    (user['id'],))
            execute("""INSERT INTO password_resets (user_id, token_hash, expires_at)
                       VALUES (%s, %s, UTC_TIMESTAMP() + INTERVAL %s MINUTE)""",
                    (user['id'], token_hash(token), RESET_MINUTES))
            commit()
            link = f"{current_app.config['APP_URL']}/#/reset/{token}"
            text, html = _reset_email(user, link)
            send_email(user['email'], 'איפוס סיסמה — HandyHub', text, html)
        else:
            _dev_note(f'{email} already got {RESETS_PER_HOUR} reset emails this hour — no email sent')
    return jsonify({'ok': True, 'message': FORGOT_MESSAGE})


@bp.get('/reset/<token>')
def check_reset_token(token):
    user = _valid_reset(token)
    return jsonify({'valid': user is not None, 'username': user['username'] if user else None})


@bp.post('/reset')
def reset_password():
    data = request.get_json(silent=True) or {}
    password = data.get('password') or ''
    user = _valid_reset(data.get('token') or '')
    if user is None:
        return jsonify({'error': 'הקישור לא תקף או שפג תוקפו. בקשו קישור חדש.'}), 400
    if len(password) < 8:
        return jsonify({'error': 'הסיסמה חייבת להכיל לפחות 8 תווים'}), 400

    execute('UPDATE users SET password_hash = %s WHERE id = %s', (hash_password(password), user['id']))
    execute('UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE id = %s', (user['reset_id'],))
    execute('DELETE FROM sessions WHERE user_id = %s', (user['id'],))   # log out every device
    commit()
    return jsonify({'ok': True})
