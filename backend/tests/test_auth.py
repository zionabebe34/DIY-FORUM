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
