"""Integration-test fixtures: a real MySQL database named <DB_NAME>_test, wiped per test."""
import io
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from seed import apply_schema, connect  # noqa: E402

TEST_DB = os.getenv('DB_NAME', 'handyhub') + '_test'
TABLES = ['agent_actions', 'ai_calls', 'login_challenges', 'totp_recovery_codes', 'notifications', 'saved_listings', 'saved_posts', 'messages', 'store_reviews', 'stores', 'listings', 'password_resets', 'reports', 'comments', 'post_likes', 'post_tags', 'tags', 'post_images', 'posts', 'follows', 'sessions', 'users']

PNG_1PX = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS'
           b'\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00'
           b'\x00IEND\xaeB`\x82')


@pytest.fixture(scope='session')
def _schema():
    apply_schema(TEST_DB, reset=True)


@pytest.fixture
def app(_schema, tmp_path):
    conn = connect(TEST_DB)
    cur = conn.cursor()
    cur.execute('SET FOREIGN_KEY_CHECKS = 0')
    for table in TABLES:
        cur.execute(f'TRUNCATE TABLE {table}')
    cur.execute('SET FOREIGN_KEY_CHECKS = 1')
    conn.commit()
    conn.close()
    # MAIL_BACKEND=memory: tests must never send real email, whatever .env says
    # AI_PROVIDER=off: tests never call the real AI service (AI tests install a fake one);
    # MAIL_BACKEND=memory: tests must never send real email, whatever .env says
    return create_app({'DB_NAME': TEST_DB, 'UPLOAD_DIR': str(tmp_path), 'TESTING': True, 'MAIL_BACKEND': 'memory',
                       # Every setting the tests rely on is pinned here, so they pass the same on any machine
                       # whatever its backend/.env says (a fresh clone, AGENTS_ENABLED=0, real Google keys …)
                       'AI_PROVIDER': 'off', 'AI_API_URL': '', 'AI_API_KEY': '', 'AI_DAILY_BUDGET': 0,
                       'AI_AGENT_SHARE': 0.5, 'AI_ASSIST_PER_HOUR': 30,
                       'AGENTS_ENABLED': True, 'AGENT_MAX_POSTS': 3, 'AGENT_MAX_COMMENTS': 5, 'AGENT_MAX_DMS': 3,
                       'AGENT_TICK_SECONDS': 600,
                       'GOOGLE_CLIENT_ID': '', 'GOOGLE_CLIENT_SECRET': '',
                       'APP_URL': 'http://localhost:5173', 'COOKIE_SECURE': False})


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_user(app):
    """Sign up a user on a fresh client and return that (logged-in) client."""
    def _make(username='tester', name='Test User', password='password123'):
        c = app.test_client()
        r = c.post('/api/auth/signup', json={
            'name': name, 'username': username, 'email': f'{username}@example.com', 'password': password})
        assert r.status_code == 201, r.get_json()
        return c
    return _make


@pytest.fixture
def set_role():
    """Give an existing user a role directly in the DB (there is no public API to bootstrap an admin)."""
    def _set(username, role):
        conn = connect(TEST_DB)
        conn.cursor().execute('UPDATE users SET role = %s WHERE username = %s', (role, username))
        conn.commit()
        conn.close()
    return _set


@pytest.fixture
def png():
    return lambda name='pic.png': (io.BytesIO(PNG_1PX), name)
