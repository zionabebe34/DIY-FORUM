"""Sign-up, login, logout, Google OAuth 2.0, password reset, and "who am I"."""
import json
import re
import secrets
import ssl
import urllib.error
import urllib.parse
import urllib.request
from html import escape

import certifi
from flask import Blueprint, current_app, jsonify, make_response, redirect, request
from mysql.connector import errors as mysql_errors

from auth import (SESSION_COOKIE, check_password, clear_session_cookie, create_session, current_user,
                  delete_session, hash_password, login_response, set_session_cookie, token_hash)
from db import commit, execute, query
from mailer import send_email
from notifications import notify_system
from routes.twofa_routes import start_challenge
from utils import EMAIL_RE, USERNAME_RE, private_user

bp = Blueprint('auth', __name__, url_prefix='/api/auth')
OAUTH_STATE_COOKIE = 'hh_oauth_state'
_SSL_CTX = ssl.create_default_context(cafile=certifi.where())


@bp.post('/signup')
def signup():
    """Register with name, username, email and password, then log the new user in."""
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
    return login_response(user, 201)


@bp.post('/login')
def login():
    """Log in with email / username + password (2FA users get a challenge instead of a session)."""
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
    if user['totp_enabled']:
        # Right password, but no session until the authenticator code (step 2: /login/2fa)
        return jsonify({'two_factor_required': True, 'challenge': start_challenge(user)})
    return login_response(user)


@bp.post('/logout')
def logout():
    """Delete the session and clear the cookie."""
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        delete_session(token)
        commit()
    response = make_response(jsonify({'ok': True}))
    clear_session_cookie(response)
    return response


@bp.get('/me')
def me():
    """The logged-in user, or null (the app asks on load)."""
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
    """The password-reset email (plain text + HTML) with the link."""
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
    """Is this reset link still valid? (the #/reset/<token> page asks before showing the form)"""
    user = _valid_reset(token)
    return jsonify({'valid': user is not None, 'username': user['username'] if user else None})


@bp.post('/reset')
def reset_password():
    """Set a new password with a valid reset token; logs out every device."""
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


# ── Google OAuth 2.0 (Login with Google) ────────────────────────────────────
def _google_redirect_uri():
    """The callback URL Google sends the user back to."""
    return f"{current_app.config['APP_URL']}/api/auth/google/callback"


def _oauth_redirect(params=None):
    """Redirect back to the app (with an error / 2FA query param) and drop the OAuth state cookie."""
    qs = ('?' + urllib.parse.urlencode(params)) if params else ''
    resp = make_response(redirect(f"{current_app.config['APP_URL']}/{qs}#/"))
    resp.delete_cookie(OAUTH_STATE_COOKIE, samesite='Lax')
    return resp


def _unique_username(email):
    """A free username made from the email's local part (name, name_2, …)."""
    base = re.sub(r'[^A-Za-z0-9_.]', '_', email.split('@')[0]).strip('_.')[:22]
    if len(base) < 3:
        base = 'maker'
    candidate = base
    n = 2
    while query('SELECT 1 FROM users WHERE username = %s', (candidate,), one=True) is not None:
        candidate = f'{base}_{n}'
        n += 1
    return candidate


def _google_fetch_profile(code):
    """Exchange an authorization code with Google and fetch the verified user profile."""
    payload = urllib.parse.urlencode({
        'code': code,
        'client_id': current_app.config['GOOGLE_CLIENT_ID'],
        'client_secret': current_app.config['GOOGLE_CLIENT_SECRET'],
        'redirect_uri': _google_redirect_uri(),
        'grant_type': 'authorization_code',
    }).encode('utf-8')
    try:
        token_req = urllib.request.Request(
            'https://oauth2.googleapis.com/token', data=payload,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        with urllib.request.urlopen(token_req, timeout=10, context=_SSL_CTX) as resp:
            token_data = json.loads(resp.read().decode('utf-8'))
        access_token = token_data.get('access_token')
        if not access_token:
            return None
        info_req = urllib.request.Request(
            'https://openidconnect.googleapis.com/v1/userinfo',
            headers={'Authorization': f'Bearer {access_token}'})
        with urllib.request.urlopen(info_req, timeout=10, context=_SSL_CTX) as resp:
            info = json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, ValueError, KeyError):
        return None
    if not isinstance(info, dict) or not info.get('sub') or not info.get('email') or not info.get('email_verified'):
        return None
    return info


def _google_find_or_create_user(info):
    """The user of a Google profile: by google_id, else linked by email, else a new account."""
    sub = str(info['sub']).strip()[:64]
    email = str(info['email']).strip().lower()
    name = (str(info.get('name') or '').strip() or email.split('@')[0])[:80]
    picture = str(info.get('picture') or '').strip()[:500] or None

    user = query('SELECT * FROM users WHERE google_id = %s', (sub,), one=True)
    if user is not None:
        return user

    by_email = query('SELECT * FROM users WHERE email = %s', (email,), one=True)
    if by_email is not None:
        if by_email['is_agent'] or (by_email.get('google_id') and by_email['google_id'] != sub):
            return None
        avatar = by_email['avatar_url'] or picture
        execute('UPDATE users SET google_id = %s, avatar_url = %s WHERE id = %s', (sub, avatar, by_email['id']))
        commit()
        return query('SELECT * FROM users WHERE id = %s', (by_email['id'],), one=True)

    username = _unique_username(email)
    user_id, _ = execute(
        """INSERT INTO users (username, email, password_hash, name, avatar_url, google_id, skills)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (username, email, hash_password(secrets.token_urlsafe(24)), name, picture, sub, '[]'))
    notify_system(user_id, f'ברוכים הבאים ל-HandyHub, {name}! שתפו את הפרויקט הראשון שלכם 🛠️')
    commit()
    return query('SELECT * FROM users WHERE id = %s', (user_id,), one=True)


@bp.get('/google')
def google_start():
    """Start Login with Google: set a state cookie and redirect to Google's consent screen."""
    client_id = current_app.config['GOOGLE_CLIENT_ID']
    if not client_id or not current_app.config['GOOGLE_CLIENT_SECRET']:
        return _oauth_redirect({'oauth_error': 'not_configured'})
    state = secrets.token_urlsafe(24)
    params = urllib.parse.urlencode({
        'client_id': client_id,
        'redirect_uri': _google_redirect_uri(),
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'prompt': 'select_account',
    })
    resp = make_response(redirect(f'https://accounts.google.com/o/oauth2/v2/auth?{params}'))
    resp.set_cookie(OAUTH_STATE_COOKIE, token_hash(state), max_age=600, httponly=True,
                    samesite='Lax', secure=current_app.config['COOKIE_SECURE'])
    return resp


@bp.get('/google/callback')
def google_callback():
    """Google sends the user back here: check the state, fetch the profile, log in (or start 2FA)."""
    if request.args.get('error'):
        return _oauth_redirect({'oauth_error': 'cancelled'})
    state = request.args.get('state') or ''
    expected = request.cookies.get(OAUTH_STATE_COOKIE) or ''
    code = request.args.get('code') or ''
    if not state or not expected or not code or token_hash(state) != expected:
        return _oauth_redirect({'oauth_error': 'failed'})
    info = _google_fetch_profile(code)
    if info is None:
        return _oauth_redirect({'oauth_error': 'failed'})
    user = _google_find_or_create_user(info)
    if user is None:
        return _oauth_redirect({'oauth_error': 'failed'})
    if user['is_banned']:
        return _oauth_redirect({'oauth_error': 'banned'})
    if user['totp_enabled']:
        return _oauth_redirect({'twofa': start_challenge(user)})
    token = create_session(user['id'])
    commit()
    resp = _oauth_redirect()
    set_session_cookie(resp, token)
    return resp

