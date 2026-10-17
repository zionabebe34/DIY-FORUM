import json
import re
import smtplib

import pytest

from seed import connect
from tests.conftest import TEST_DB


@pytest.fixture
def outbox(app):
    app.config.update(MAIL_BACKEND='memory', MAIL_OUTBOX=[], APP_URL='https://handyhub.test')
    return app.config['MAIL_OUTBOX']


def token_from(msg):
    body = msg.get_body(preferencelist=('plain',)).get_content()
    return re.search(r'#/reset/([\w-]+)', body).group(1)


def forgot(client, email):
    return client.post('/api/auth/forgot', json={'email': email})


def test_full_reset_flow(make_user, client, outbox, app):
    alice = make_user('alice')                      # logged-in session that must be revoked
    r = forgot(client, 'ALICE@example.com')
    assert r.status_code == 200 and 'קישור' in r.get_json()['message']

    assert len(outbox) == 1
    msg = outbox[0]
    assert msg['To'] == 'alice@example.com'
    html = msg.get_body(preferencelist=('html',)).get_content()
    token = token_from(msg)
    assert f'https://handyhub.test/#/reset/{token}' in html

    assert client.get(f'/api/auth/reset/{token}').get_json() == {'valid': True, 'username': 'alice'}
    assert client.post('/api/auth/reset', json={'token': token, 'password': 'short'}).status_code == 400
    assert client.post('/api/auth/reset', json={'token': token, 'password': 'brand-new-pass'}).status_code == 200

    # Token is single-use, old password is gone, all sessions were logged out
    assert client.get(f'/api/auth/reset/{token}').get_json()['valid'] is False
    assert client.post('/api/auth/reset', json={'token': token, 'password': 'another-pass'}).status_code == 400
    assert alice.get('/api/auth/me').get_json()['user'] is None
    c = app.test_client()
    assert c.post('/api/auth/login', json={'login': 'alice', 'password': 'password123'}).status_code == 401
    assert c.post('/api/auth/login', json={'login': 'alice', 'password': 'brand-new-pass'}).status_code == 200


def test_unknown_email_looks_identical(make_user, client, outbox):
    make_user('alice')
    known = forgot(client, 'alice@example.com')
    unknown = forgot(client, 'nobody@example.com')
    assert known.status_code == unknown.status_code == 200
    assert known.get_json() == unknown.get_json()
    assert len(outbox) == 1


def test_invalid_input(client, outbox):
    assert forgot(client, 'not-an-email').status_code == 400
    assert client.get('/api/auth/reset/garbage').get_json() == {'valid': False, 'username': None}
    assert client.get('/api/auth/reset/' + 'x' * 201).get_json()['valid'] is False
    assert client.post('/api/auth/reset', json={'token': 'garbage', 'password': 'whatever123'}).status_code == 400
    assert client.post('/api/auth/reset', json={}).status_code == 400


def test_only_newest_link_works_and_rate_limit(make_user, client, outbox):
    make_user('alice')
    for _ in range(4):
        forgot(client, 'alice@example.com')
    assert len(outbox) == 3                                   # max 3 emails per hour
    first, last = token_from(outbox[0]), token_from(outbox[-1])
    assert client.get(f'/api/auth/reset/{first}').get_json()['valid'] is False
    assert client.get(f'/api/auth/reset/{last}').get_json()['valid'] is True


def test_expired_token(make_user, client, outbox):
    make_user('alice')
    forgot(client, 'alice@example.com')
    token = token_from(outbox[0])
    conn = connect(TEST_DB)
    conn.cursor().execute('UPDATE password_resets SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE')
    conn.commit()
    conn.close()
    assert client.get(f'/api/auth/reset/{token}').get_json()['valid'] is False


def test_banned_user_gets_no_email(make_user, set_role, client, outbox):
    make_user('alice')
    boss = make_user('boss')
    set_role('boss', 'admin')
    boss.post('/api/admin/users/alice/ban')
    assert forgot(client, 'alice@example.com').status_code == 200
    assert outbox == []


# ── Mail backends ───────────────────────────────────────────────────────────
def test_console_backend_prints(make_user, client, app, capsys):
    app.config['MAIL_BACKEND'] = 'console'
    make_user('alice')
    forgot(client, 'alice@example.com')
    out = capsys.readouterr().out
    assert 'To: alice@example.com' in out and '#/reset/' in out

    forgot(client, 'nobody@example.com')
    assert 'no active account with email nobody@example.com' in capsys.readouterr().out
    forgot(client, 'alice@example.com')
    forgot(client, 'alice@example.com')
    forgot(client, 'alice@example.com')        # 4th within the hour
    assert 'already got 3 reset emails this hour' in capsys.readouterr().out


class FakeSMTP:
    sent = []
    fail = False

    def __init__(self, host, port, timeout):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context):
        pass

    def login(self, user, password):
        if FakeSMTP.fail:
            raise smtplib.SMTPAuthenticationError(535, b'bad credentials')
        self.user = user

    def send_message(self, msg):
        FakeSMTP.sent.append((self.host, self.port, self.user, msg['To']))


@pytest.mark.parametrize('fail', [False, True])
def test_smtp_backend(make_user, client, app, monkeypatch, capsys, fail):
    import mailer
    sent_threads = []
    real_thread = mailer.threading.Thread

    def run_now(target, args, daemon):           # run the background send synchronously
        t = real_thread(target=target, args=args, daemon=daemon)
        sent_threads.append(t)
        return t

    monkeypatch.setattr(mailer.smtplib, 'SMTP', FakeSMTP)
    monkeypatch.setattr(mailer.threading, 'Thread', run_now)
    FakeSMTP.sent, FakeSMTP.fail = [], fail
    app.config.update(MAIL_BACKEND='smtp', SMTP_HOST='smtp.gmail.com', SMTP_PORT=587,
                      SMTP_USER='me@gmail.com', SMTP_PASSWORD='app-pass', MAIL_FROM='')
    make_user('alice')
    assert forgot(client, 'alice@example.com').status_code == 200     # never fails the request
    for t in sent_threads:
        t.join()
    assert FakeSMTP.sent == ([] if fail else [('smtp.gmail.com', 587, 'me@gmail.com', 'alice@example.com')])
    out = capsys.readouterr().out
    assert ('[mail] FAILED to send to alice@example.com' in out) if fail else ('[mail] sent to alice@example.com' in out)


def test_file_mail_backend(app, client, make_user, tmp_path):
    """MAIL_BACKEND=file writes the email (with the reset link) as a JSON file — the end-to-end tests read it."""
    make_user('alice')
    app.config.update(MAIL_BACKEND='file', MAIL_FILE_DIR=str(tmp_path / 'outbox'), APP_URL='https://handyhub.test')
    client.post('/api/auth/forgot', json={'email': 'alice@example.com'})
    files = list((tmp_path / 'outbox').glob('*.json'))
    assert len(files) == 1
    mail = json.loads(files[0].read_text(encoding='utf-8'))
    assert mail['to'] == 'alice@example.com' and 'https://handyhub.test/#/reset/' in mail['text']
