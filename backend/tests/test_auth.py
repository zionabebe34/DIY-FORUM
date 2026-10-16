import io
import json
import urllib.error
import urllib.parse

from routes import auth_routes
from seed import connect
from tests.conftest import TEST_DB


def signup(client, **overrides):
    data = {'name': 'Dana', 'username': 'dana', 'email': 'dana@example.com', 'password': 'password123'}
    data.update(overrides)
    return client.post('/api/auth/signup', json=data)


def test_signup_logs_in_and_hides_password(client):
    r = signup(client)
    assert r.status_code == 201
    user = r.get_json()['user']
    assert user['username'] == 'dana' and user['email'] == 'dana@example.com'
    assert 'password_hash' not in user
    assert 'hh_session' in r.headers['Set-Cookie'] and 'HttpOnly' in r.headers['Set-Cookie']
    assert client.get('/api/auth/me').get_json()['user']['username'] == 'dana'


def test_password_is_stored_hashed(client):
    signup(client)
    conn = connect(TEST_DB)
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users WHERE username = 'dana'")
    stored = cur.fetchone()[0]
    conn.close()
    assert stored != 'password123' and stored.startswith('$2b$')


def test_signup_validation(client):
    assert signup(client, name='').status_code == 400
    assert signup(client, username='a b').status_code == 400
    assert signup(client, email='not-an-email').status_code == 400
    assert signup(client, password='short').status_code == 400


def test_signup_duplicates(client):
    signup(client)
    assert signup(client, username='other').status_code == 409          # same email
    assert signup(client, email='x@example.com').status_code == 409     # same username


def test_login_with_email_or_username(app):
    signup(app.test_client())
    for login_id in ('dana@example.com', 'DANA@example.com', 'dana', '@dana'):
        c = app.test_client()
        r = c.post('/api/auth/login', json={'login': login_id, 'password': 'password123'})
        assert r.status_code == 200, login_id
        assert c.get('/api/auth/me').get_json()['user']['username'] == 'dana'


def test_login_failures(client):
    signup(client)
    assert client.post('/api/auth/login', json={'login': 'dana', 'password': 'wrong-pass'}).status_code == 401
    assert client.post('/api/auth/login', json={'login': 'nobody', 'password': 'password123'}).status_code == 401
    assert client.post('/api/auth/login', json={}).status_code == 400


def test_logout_invalidates_session(client):
    signup(client)
    assert client.post('/api/auth/logout').status_code == 200
    assert client.get('/api/auth/me').get_json()['user'] is None


def test_me_anonymous(client):
    assert client.get('/api/auth/me').get_json() == {'user': None}


def test_bad_cookie_is_anonymous(client):
    client.set_cookie('hh_session', 'forged-token')
    assert client.get('/api/auth/me').get_json()['user'] is None
    assert client.post('/api/posts', data={'body': 'hi'}).status_code == 401


def test_health_and_404(client):
    assert client.get('/api/health').get_json() == {'ok': True}
    r = client.get('/api/nope')
    assert r.status_code == 404 and 'error' in r.get_json()


# ── Google OAuth 2.0 ────────────────────────────────────────────────────────
def _start_google(client):
    r = client.get('/api/auth/google')
    assert r.status_code == 302 and 'accounts.google.com' in r.headers['Location']
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(r.headers['Location']).query)
    return qs['state'][0]


def test_google_oauth_flow_new_and_existing_users(app, monkeypatch):
    c = app.test_client()
    assert c.get('/api/auth/google').headers['Location'].endswith('/?oauth_error=not_configured#/')

    app.config.update(GOOGLE_CLIENT_ID='gid', GOOGLE_CLIENT_SECRET='gsecret')
    state = _start_google(c)
    assert c.get('/api/auth/google/callback?error=access_denied').headers['Location'].endswith('/?oauth_error=cancelled#/')
    assert c.get('/api/auth/google/callback?code=x&state=wrong').headers['Location'].endswith('/?oauth_error=failed#/')

    profile = {'sub': 'g-100', 'email': 'dana@other.com', 'email_verified': True,
               'name': 'Dana Google', 'picture': 'https://lh3.googleusercontent.com/a/photo.png'}
    monkeypatch.setattr(auth_routes, '_google_fetch_profile', lambda code: profile if code == 'ok' else None)

    state = _start_google(c)
    assert c.get(f'/api/auth/google/callback?code=bad&state={state}').headers['Location'].endswith('/?oauth_error=failed#/')

    # Username 'dana' is already taken → new Google user gets 'dana_2'
    signup(app.test_client())
    state = _start_google(c)
    r = c.get(f'/api/auth/google/callback?code=ok&state={state}')
    assert r.status_code == 302 and r.headers['Location'].endswith('/#/')
    me = c.get('/api/auth/me').get_json()['user']
    assert me['username'] == 'dana_2' and me['avatar_url'] == profile['picture']

    # Logging in again with the same google_id finds the existing user
    c2 = app.test_client()
    state = _start_google(c2)
    c2.get(f'/api/auth/google/callback?code=ok&state={state}')
    assert c2.get('/api/auth/me').get_json()['user']['username'] == 'dana_2'

    # Existing email without google_id links the account; conflicting google_id fails; short email prefix → 'maker'
    profile = {'sub': 'g-200', 'email': 'dana@example.com', 'email_verified': True, 'name': 'Dana', 'picture': 'https://img/p.png'}
    c3 = app.test_client()
    state = _start_google(c3)
    c3.get(f'/api/auth/google/callback?code=ok&state={state}')
    assert c3.get('/api/auth/me').get_json()['user']['username'] == 'dana'

    profile = {'sub': 'g-other', 'email': 'dana@example.com', 'email_verified': True, 'name': 'Dana'}
    state = _start_google(c3)
    assert c3.get(f'/api/auth/google/callback?code=ok&state={state}').headers['Location'].endswith('/?oauth_error=failed#/')

    profile = {'sub': 'g-300', 'email': 'a@example.com', 'email_verified': True, 'name': ''}
    c4 = app.test_client()
    state = _start_google(c4)
    c4.get(f'/api/auth/google/callback?code=ok&state={state}')
    assert c4.get('/api/auth/me').get_json()['user']['username'] == 'maker'


def test_google_oauth_banned_and_2fa(app, monkeypatch):
    app.config.update(GOOGLE_CLIENT_ID='gid', GOOGLE_CLIENT_SECRET='gsecret')
    signup(app.test_client())
    conn = connect(TEST_DB)
    cur = conn.cursor()
    cur.execute("UPDATE users SET totp_enabled = TRUE, totp_secret = 'JBSWY3DPEHPK3PXP' WHERE username = 'dana'")
    conn.commit()
    conn.close()

    monkeypatch.setattr(auth_routes, '_google_fetch_profile',
                        lambda code: {'sub': 'g-dana', 'email': 'dana@example.com', 'email_verified': True, 'name': 'Dana'})
    c = app.test_client()
    state = _start_google(c)
    loc = c.get(f'/api/auth/google/callback?code=ok&state={state}').headers['Location']
    assert '?twofa=' in loc and c.get('/api/auth/me').get_json()['user'] is None

    conn = connect(TEST_DB)
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_banned = TRUE WHERE username = 'dana'")
    conn.commit()
    conn.close()
    state = _start_google(c)
    assert c.get(f'/api/auth/google/callback?code=ok&state={state}').headers['Location'].endswith('/?oauth_error=banned#/')


def test_google_fetch_profile_http(app, monkeypatch):
    app.config.update(GOOGLE_CLIENT_ID='gid', GOOGLE_CLIENT_SECRET='gsecret')
    responses = []

    class Resp(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(auth_routes.urllib.request, 'urlopen', lambda req, timeout, context: Resp(responses.pop(0)))
    with app.app_context():
        responses[:] = [b'{"access_token": "tok"}',
                        b'{"sub": "1", "email": "u@example.com", "email_verified": true, "name": "U"}']
        assert auth_routes._google_fetch_profile('code')['email'] == 'u@example.com'

        responses[:] = [b'{}']
        assert auth_routes._google_fetch_profile('code') is None

        responses[:] = [b'{"access_token": "tok"}', b'{"sub": "1", "email": "u@example.com", "email_verified": false}']
        assert auth_routes._google_fetch_profile('code') is None

        def fail(*a, **k):
            raise urllib.error.URLError('down')
        monkeypatch.setattr(auth_routes.urllib.request, 'urlopen', fail)
        assert auth_routes._google_fetch_profile('code') is None

