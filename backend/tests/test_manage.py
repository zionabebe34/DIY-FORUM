import manage
from tests.conftest import TEST_DB


def test_set_role_and_unban(make_user, set_role, monkeypatch, capsys):
    monkeypatch.setenv('DB_NAME', TEST_DB)
    alice = make_user('alice')

    assert manage.main(['set-role', 'alice', 'admin']) == 0
    assert 'alice is now admin' in capsys.readouterr().out
    assert alice.get('/api/auth/me').get_json()['user']['role'] == 'admin'
    assert manage.main(['set-role', 'alice', 'admin']) == 0          # unchanged row still counts as found

    make_user('bob')
    set_role('alice', 'admin')
    alice.post('/api/admin/users/bob/ban')
    assert manage.main(['unban', 'bob']) == 0
    assert alice.get('/api/users/bob').get_json()['user']['is_banned'] is False


def test_unknown_user(monkeypatch, capsys, app):
    monkeypatch.setenv('DB_NAME', TEST_DB)
    assert manage.main(['set-role', 'ghost', 'moderator']) == 1
    assert "No user named 'ghost'" in capsys.readouterr().out
