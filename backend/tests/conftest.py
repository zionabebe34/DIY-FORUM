"""Integration-test fixtures: a real MySQL database named <DB_NAME>_test, wiped per test."""
import io
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from seed import apply_schema, connect  # noqa: E402

TEST_DB = os.getenv('DB_NAME', 'handyhub') + '_test'
TABLES = ['post_tags', 'tags', 'post_images', 'posts', 'follows', 'sessions', 'users']

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
    return create_app({'DB_NAME': TEST_DB, 'UPLOAD_DIR': str(tmp_path), 'TESTING': True})


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
def png():
    return lambda name='pic.png': (io.BytesIO(PNG_1PX), name)
