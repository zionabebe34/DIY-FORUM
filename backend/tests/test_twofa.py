import pyotp
import pytest

from routes import twofa_routes

T0 = 1_800_000_000   # a fixed "now" (a multiple of 30 s)


@pytest.fixture
def clock(monkeypatch):
    """Freeze time for the TOTP checks; clock.now += 30 moves one step forward."""
    class Clock:
        now = T0
    c = Clock()
    monkeypatch.setattr(twofa_routes.time, 'time', lambda: c.now)
    return c


def code_at(secret, t):
    return pyotp.TOTP(secret).at(t)


def enable_2fa(c, clock):
    setup = c.post('/api/auth/2fa/setup').get_json()
    r = c.post('/api/auth/2fa/enable', json={'code': code_at(setup['secret'], clock.now)})
    assert r.status_code == 200, r.get_json()
    return setup['secret'], r.get_json()['recovery_codes']


def login(client, password='password123'):
    return client.post('/api/auth/login', json={'login': 'alice', 'password': password})


def test_setup_and_enable(make_user, client, clock):
    alice = make_user('alice')
    assert client.post('/api/auth/2fa/setup').status_code == 401
    assert alice.get('/api/auth/2fa').get_json() == {'enabled': False, 'recovery_codes_left': 0}
    assert alice.post('/api/auth/2fa/enable', json={'code': '123456'}).status_code == 400   # no setup yet

    setup = alice.post('/api/auth/2fa/setup').get_json()
    assert setup['qr'].startswith('data:image/svg+xml')
    assert setup['otpauth_uri'].startswith('otpauth://totp/HandyHub') and 'alice%40example.com' in setup['otpauth_uri']
    # still a normal login until a code confirms the setup
    assert alice.get('/api/auth/me').get_json()['user']['two_factor'] is False
    bad = alice.post('/api/auth/2fa/enable', json={'code': 'abc'})
    assert bad.status_code == 400

    r = alice.post('/api/auth/2fa/enable', json={'code': code_at(setup['secret'], clock.now - 30)})   # 30 s drift is ok
    data = r.get_json()
    assert data['enabled'] is True and len(data['recovery_codes']) == 8 and len(set(data['recovery_codes'])) == 8
    assert alice.get('/api/auth/2fa').get_json() == {'enabled': True, 'recovery_codes_left': 8}
    assert alice.get('/api/auth/me').get_json()['user']['two_factor'] is True
    assert alice.post('/api/auth/2fa/setup').status_code == 400
    assert alice.post('/api/auth/2fa/enable', json={'code': '000000'}).status_code == 400


def test_enabling_signs_out_other_browsers(make_user, app, clock):
    alice = make_user('alice')
    other = app.test_client()
    assert login(other).status_code == 200
    enable_2fa(alice, clock)
    assert other.get('/api/auth/me').get_json()['user'] is None
    assert alice.get('/api/auth/me').get_json()['user']['username'] == 'alice'


def test_login_needs_the_code(make_user, app, clock):
    alice = make_user('alice')
    secret, _ = enable_2fa(alice, clock)
    c = app.test_client()

    assert login(c, 'wrong-password').status_code == 401
    r = login(c)
    data = r.get_json()
    assert data['two_factor_required'] is True and 'user' not in data
    assert 'hh_session' not in (r.headers.get('Set-Cookie') or '')
    assert c.get('/api/auth/me').get_json()['user'] is None

    # the code used to enable 2FA can't be replayed
    used = code_at(secret, clock.now)
    assert c.post('/api/auth/login/2fa', json={'challenge': data['challenge'], 'code': used}).status_code == 401
    clock.now += 30
    ok = c.post('/api/auth/login/2fa', json={'challenge': data['challenge'], 'code': code_at(secret, clock.now)})
    assert ok.status_code == 200 and ok.get_json()['user']['username'] == 'alice'
    assert 'recovery_codes_left' not in ok.get_json()
    assert c.get('/api/auth/me').get_json()['user']['two_factor'] is True
    # the challenge is single-use
    assert c.post('/api/auth/login/2fa', json={'challenge': data['challenge'], 'code': '123456'}).status_code == 401
    assert c.post('/api/auth/login/2fa', json={}).status_code == 401


def test_too_many_wrong_codes(make_user, app, clock):
    alice = make_user('alice')
    enable_2fa(alice, clock)
    c = app.test_client()
    challenge = login(c).get_json()['challenge']
    for left in (4, 3, 2, 1):
        r = c.post('/api/auth/login/2fa', json={'challenge': challenge, 'code': '000000'})
        assert r.status_code == 401 and r.get_json()['attempts_left'] == left
    assert c.post('/api/auth/login/2fa', json={'challenge': challenge, 'code': '000000'}).status_code == 429
    assert c.post('/api/auth/login/2fa', json={'challenge': challenge, 'code': '000000'}).status_code == 401  # gone


def test_recovery_code_login_once(make_user, app, clock):
    alice = make_user('alice')
    _, codes = enable_2fa(alice, clock)
    c = app.test_client()
    r = c.post('/api/auth/login/2fa', json={'challenge': login(c).get_json()['challenge'], 'code': codes[0].upper()})
    assert r.status_code == 200 and r.get_json()['recovery_codes_left'] == 7
    c2 = app.test_client()
    again = c2.post('/api/auth/login/2fa', json={'challenge': login(c2).get_json()['challenge'], 'code': codes[0]})
    assert again.status_code == 401


def test_banned_user_cant_finish_login(make_user, set_role, app, clock):
    alice = make_user('alice')
    boss = make_user('boss')
    set_role('boss', 'admin')
    secret, _ = enable_2fa(alice, clock)
    c = app.test_client()
    challenge = login(c).get_json()['challenge']
    boss.post('/api/admin/users/alice/ban')
    clock.now += 30
    r = c.post('/api/auth/login/2fa', json={'challenge': challenge, 'code': code_at(secret, clock.now)})
    assert r.status_code == 403


def test_disable_and_new_recovery_codes(make_user, clock):
    alice = make_user('alice')
    assert alice.post('/api/auth/2fa/disable', json={}).status_code == 400
    assert alice.post('/api/auth/2fa/recovery-codes', json={}).status_code == 400
    secret, codes = enable_2fa(alice, clock)

    clock.now += 30
    assert alice.post('/api/auth/2fa/recovery-codes',
                      json={'password': 'nope', 'code': code_at(secret, clock.now)}).status_code == 400
    r = alice.post('/api/auth/2fa/recovery-codes', json={'password': 'password123', 'code': code_at(secret, clock.now)})
    new_codes = r.get_json()['recovery_codes']
    assert len(new_codes) == 8 and not set(new_codes) & set(codes)

    assert alice.post('/api/auth/2fa/disable', json={'password': 'password123', 'code': '000000'}).status_code == 400
    # a backup code also proves it's you
    r = alice.post('/api/auth/2fa/disable', json={'password': 'password123', 'code': new_codes[0]})
    assert r.get_json() == {'enabled': False}
    assert alice.get('/api/auth/2fa').get_json() == {'enabled': False, 'recovery_codes_left': 0}
    assert alice.post('/api/auth/logout').status_code == 200
    assert alice.post('/api/auth/login', json={'login': 'alice', 'password': 'password123'}).get_json()['user']
