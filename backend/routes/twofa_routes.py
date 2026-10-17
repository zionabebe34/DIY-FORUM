"""Two-factor login (TOTP — Google Authenticator, Microsoft Authenticator, 1Password …).

Setup:  POST /2fa/setup → secret + QR  →  POST /2fa/enable {code} → backup codes (shown once).
Login:  POST /api/auth/login (right password) → {two_factor_required, challenge}
        POST /api/auth/login/2fa {challenge, code} → session cookie.
A code is accepted once (replay protection), ±30 s of clock drift is allowed, a challenge
lives 5 minutes and allows 5 attempts. Backup codes are single-use and stored as SHA-256.
"""
import hmac
import secrets
import time

import pyotp
import segno
from flask import Blueprint, jsonify, request

from auth import check_password, current_user, login_required, login_response, token_hash
from db import commit, execute, query

bp = Blueprint('twofa', __name__, url_prefix='/api/auth')

ISSUER = 'HandyHub'
STEP_SECONDS = 30
DRIFT_STEPS = 1
RECOVERY_CODES = 8
CHALLENGE_MINUTES = 5
MAX_ATTEMPTS = 5


# ── Codes ───────────────────────────────────────────────────────────────────
def _clean(code):
    """Normalize a typed code: letters and digits only, lower-case."""
    return ''.join(ch for ch in str(code or '') if ch.isalnum()).lower()


def matching_step(secret, code, last_step=None):
    """The 30-second step `code` belongs to (within the allowed drift), or None.
    Steps at or before `last_step` were already used and are rejected."""
    code = _clean(code)
    if len(code) != 6 or not code.isdigit():
        return None
    totp = pyotp.TOTP(secret)
    now = int(time.time()) // STEP_SECONDS
    for step in range(now - DRIFT_STEPS, now + DRIFT_STEPS + 1):
        if last_step is not None and step <= last_step:
            continue
        if hmac.compare_digest(totp.at(step * STEP_SECONDS), code):
            return step
    return None


def _new_recovery_codes(user_id):
    """Replace the user's backup codes; returns the plain codes (shown once)."""
    codes = [f'{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}' for _ in range(RECOVERY_CODES)]
    execute('DELETE FROM totp_recovery_codes WHERE user_id = %s', (user_id,))
    for c in codes:
        execute('INSERT INTO totp_recovery_codes (user_id, code_hash) VALUES (%s, %s)', (user_id, token_hash(_clean(c))))
    return codes


def _recovery_left(user_id):
    """How many unused backup codes the user has."""
    return int(query('SELECT COUNT(*) AS n FROM totp_recovery_codes WHERE user_id = %s AND used_at IS NULL',
                     (user_id,), one=True)['n'])


def verify_second_factor(user, code):
    """Check an authenticator code or a backup code for `user` (marks it used, no commit).
    → 'totp' | 'recovery' | None."""
    step = matching_step(user['totp_secret'], code, user['totp_last_step'])
    if step is not None:
        execute('UPDATE users SET totp_last_step = %s WHERE id = %s', (step, user['id']))
        return 'totp'
    row = query('SELECT id FROM totp_recovery_codes WHERE user_id = %s AND code_hash = %s AND used_at IS NULL',
                (user['id'], token_hash(_clean(code))), one=True)
    if row is not None:
        execute('UPDATE totp_recovery_codes SET used_at = UTC_TIMESTAMP() WHERE id = %s', (row['id'],))
        return 'recovery'
    return None


# ── Login step 2 ────────────────────────────────────────────────────────────
def start_challenge(user):
    """Called by /login after the password checked out for a 2FA user."""
    token = secrets.token_urlsafe(32)
    execute('DELETE FROM login_challenges WHERE user_id = %s OR expires_at < UTC_TIMESTAMP()', (user['id'],))
    execute("""INSERT INTO login_challenges (user_id, token_hash, expires_at)
               VALUES (%s, %s, UTC_TIMESTAMP() + INTERVAL %s MINUTE)""",
            (user['id'], token_hash(token), CHALLENGE_MINUTES))
    commit()
    return token


@bp.post('/login/2fa')
def login_second_step():
    """Login step 2: the authenticator / backup code for a 2FA challenge (5 wrong tries → start over)."""
    data = request.get_json(silent=True) or {}
    challenge = str(data.get('challenge') or '')
    row = query("""SELECT c.id AS challenge_id, c.attempts, u.* FROM login_challenges c JOIN users u ON u.id = c.user_id
                   WHERE c.token_hash = %s AND c.expires_at > UTC_TIMESTAMP()""",
                (token_hash(challenge),), one=True) if challenge else None
    if row is None:
        return jsonify({'error': 'פג תוקף ההתחברות — הזינו שוב את הסיסמה.'}), 401
    if row['is_banned']:
        return jsonify({'error': 'החשבון נחסם על ידי צוות הניהול'}), 403

    used = verify_second_factor(row, data.get('code'))
    if used is None:
        attempts = row['attempts'] + 1
        if attempts >= MAX_ATTEMPTS:
            execute('DELETE FROM login_challenges WHERE id = %s', (row['challenge_id'],))
            commit()
            return jsonify({'error': 'יותר מדי ניסיונות שגויים — הזינו שוב את הסיסמה.'}), 429
        execute('UPDATE login_challenges SET attempts = %s WHERE id = %s', (attempts, row['challenge_id']))
        commit()
        return jsonify({'error': 'הקוד שגוי או שפג תוקפו', 'attempts_left': MAX_ATTEMPTS - attempts}), 401

    execute('DELETE FROM login_challenges WHERE id = %s', (row['challenge_id'],))
    extra = {'recovery_codes_left': _recovery_left(row['id'])} if used == 'recovery' else None
    return login_response(row, extra=extra)    # commits


# ── Settings ────────────────────────────────────────────────────────────────
@bp.get('/2fa')
@login_required
def status():
    """Is 2FA on for me, and how many backup codes are left."""
    me = current_user()
    return jsonify({'enabled': bool(me['totp_enabled']),
                    'recovery_codes_left': _recovery_left(me['id']) if me['totp_enabled'] else 0})


@bp.post('/2fa/setup')
@login_required
def setup():
    """A fresh secret + QR code. Nothing changes for login until /2fa/enable confirms a code."""
    me = current_user()
    if me['totp_enabled']:
        return jsonify({'error': 'אימות דו-שלבי כבר פעיל'}), 400
    secret = pyotp.random_base32()
    execute('UPDATE users SET totp_pending = %s WHERE id = %s', (secret, me['id']))
    commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=me['email'], issuer_name=ISSUER)
    qr = segno.make(uri, error='m').svg_data_uri(scale=5, border=2)
    return jsonify({'secret': secret, 'otpauth_uri': uri, 'qr': qr})


@bp.post('/2fa/enable')
@login_required
def enable():
    """Turn 2FA on once a code from the new secret checks out; returns backup codes, logs out other browsers."""
    me = current_user()
    if me['totp_enabled']:
        return jsonify({'error': 'אימות דו-שלבי כבר פעיל'}), 400
    if not me['totp_pending']:
        return jsonify({'error': 'התחילו מחדש את ההגדרה'}), 400
    step = matching_step(me['totp_pending'], (request.get_json(silent=True) or {}).get('code'))
    if step is None:
        return jsonify({'error': 'הקוד שגוי — ודאו שהשעה בטלפון מעודכנת ונסו את הקוד הנוכחי'}), 400
    execute("""UPDATE users SET totp_enabled = TRUE, totp_secret = totp_pending, totp_pending = NULL,
                                totp_last_step = %s WHERE id = %s""", (step, me['id']))
    codes = _new_recovery_codes(me['id'])
    # Other browsers that were logged in with just the password are signed out
    execute('DELETE FROM sessions WHERE user_id = %s AND token_hash <> %s',
            (me['id'], token_hash(request.cookies.get('hh_session', ''))))
    commit()
    return jsonify({'enabled': True, 'recovery_codes': codes})


def _confirm_identity(me, data):
    """Turning 2FA off / new backup codes needs the password and a current code."""
    if not check_password(str(data.get('password') or ''), me['password_hash']):
        return jsonify({'error': 'הסיסמה שגויה'}), 400
    if verify_second_factor(me, data.get('code')) is None:
        return jsonify({'error': 'הקוד שגוי או שפג תוקפו'}), 400
    return None


@bp.post('/2fa/disable')
@login_required
def disable():
    """Turn 2FA off (needs the password + a current code)."""
    me = current_user()
    if not me['totp_enabled']:
        return jsonify({'error': 'אימות דו-שלבי לא פעיל'}), 400
    data = request.get_json(silent=True) or {}
    failed = _confirm_identity(me, data)
    if failed:
        return failed
    execute("""UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, totp_pending = NULL, totp_last_step = NULL
               WHERE id = %s""", (me['id'],))
    execute('DELETE FROM totp_recovery_codes WHERE user_id = %s', (me['id'],))
    commit()
    return jsonify({'enabled': False})


@bp.post('/2fa/recovery-codes')
@login_required
def regenerate_recovery_codes():
    """New backup codes (needs the password + a current code); the old ones stop working."""
    me = current_user()
    if not me['totp_enabled']:
        return jsonify({'error': 'אימות דו-שלבי לא פעיל'}), 400
    failed = _confirm_identity(me, request.get_json(silent=True) or {})
    if failed:
        return failed
    codes = _new_recovery_codes(me['id'])
    commit()
    return jsonify({'recovery_codes': codes})
