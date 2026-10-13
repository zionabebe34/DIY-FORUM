import pytest


def new_post(c, body='hello'):
    return c.post('/api/posts', data={'body': body}, content_type='multipart/form-data').get_json()['post']['id']


def report(c, target_type, target_id, reason='spam', **extra):
    return c.post('/api/reports', json={'target_type': target_type, 'target_id': target_id, 'reason': reason, **extra})


@pytest.fixture
def world(make_user, set_role):
    """alice (author), bob + carol (reporters), mod (moderator), boss (admin)."""
    users = {name: make_user(name) for name in ('alice', 'bob', 'carol', 'mod', 'boss')}
    set_role('mod', 'moderator')
    set_role('boss', 'admin')
    return users


# ── Reporting ───────────────────────────────────────────────────────────────
def test_report_post_comment_and_user(world):
    alice, bob = world['alice'], world['bob']
    pid = new_post(alice, '<p>Buy cheap <b>pills</b></p>')
    cid = alice.post(f'/api/posts/{pid}/comments', json={'body': 'click my link'}).get_json()['comment']['id']
    alice_id = alice.get('/api/auth/me').get_json()['user']['id']

    assert report(bob, 'post', pid, details='obvious spam').status_code == 201
    assert report(bob, 'post', pid).status_code == 201          # duplicate open report is a no-op
    assert report(bob, 'comment', cid, 'harassment').status_code == 201
    assert report(bob, 'user', alice_id, 'other').status_code == 201

    cases = world['mod'].get('/api/admin/reports').get_json()['items']
    by_type = {c['target_type']: c for c in cases}
    assert set(by_type) == {'post', 'comment', 'user'}
    post_case = by_type['post']
    assert post_case['count'] == 1 and post_case['snapshot'] == 'Buy cheap pills'
    assert post_case['target_user']['username'] == 'alice' and post_case['target_exists'] is True
    assert post_case['reports'][0]['details'] == 'obvious spam'
    assert by_type['comment']['post_id'] == pid


def test_report_validation(world, client):
    alice, bob = world['alice'], world['bob']
    pid = new_post(alice)
    assert report(bob, 'post', pid, 'not-a-reason').status_code == 400
    assert report(bob, 'galaxy', pid).status_code == 400
    assert bob.post('/api/reports', json={'target_type': 'post', 'target_id': 'x', 'reason': 'spam'}).status_code == 400
    assert report(bob, 'post', 999999).status_code == 404
    assert report(alice, 'post', pid).status_code == 400        # can't report yourself
    assert report(client, 'post', pid).status_code == 401


def test_cases_group_multiple_reporters(world):
    pid = new_post(world['alice'])
    report(world['bob'], 'post', pid, 'spam')
    report(world['carol'], 'post', pid, 'hate')
    case = world['mod'].get('/api/admin/reports').get_json()['items'][0]
    assert case['count'] == 2 and case['reasons'] == {'spam': 1, 'hate': 1}
    stats = world['mod'].get('/api/admin/stats').get_json()
    assert stats['open_reports'] == 2 and stats['open_cases'] == 1 and stats['users'] == 5


# ── Dashboard permissions ───────────────────────────────────────────────────
def test_dashboard_requires_moderator(world, client):
    for path in ('/api/admin/reports', '/api/admin/stats', '/api/admin/users'):
        assert client.get(path).status_code == 401
        assert world['bob'].get(path).status_code == 403
        assert world['mod'].get(path).status_code == 200
    assert world['mod'].get('/api/admin/reports?status=weird').status_code == 400


# ── Resolving cases ─────────────────────────────────────────────────────────
def test_moderator_deletes_reported_post_and_comment(world):
    alice, mod = world['alice'], world['mod']
    pid = new_post(alice)
    other = new_post(alice, 'other')
    cid = alice.post(f'/api/posts/{other}/comments', json={'body': 'nasty'}).get_json()['comment']['id']
    report(world['bob'], 'post', pid)
    report(world['bob'], 'comment', cid)

    assert world['bob'].delete(f'/api/posts/{pid}').status_code == 403   # regular users still can't
    assert mod.delete(f'/api/posts/{pid}').status_code == 200
    assert mod.delete(f'/api/comments/{cid}').status_code == 200

    assert mod.get('/api/admin/reports').get_json()['items'] == []
    closed = mod.get('/api/admin/reports?status=closed').get_json()['items']
    assert {c['resolution'] for c in closed} == {'content_deleted'}
    assert all(c['resolved_by'] == 'mod' and c['target_exists'] is False for c in closed)


def test_dismiss_case(world):
    pid = new_post(world['alice'])
    report(world['bob'], 'post', pid)
    report(world['carol'], 'post', pid)
    mod = world['mod']
    assert mod.post('/api/admin/cases/dismiss', json={'target_type': 'post', 'target_id': 'x'}).status_code == 400
    assert mod.post('/api/admin/cases/dismiss', json={'target_type': 'post', 'target_id': pid}).status_code == 200
    assert mod.get('/api/admin/reports').get_json()['items'] == []
    closed = mod.get('/api/admin/reports?status=closed').get_json()['items'][0]
    assert closed['status'] == 'dismissed' and closed['count'] == 2


# ── Bans ────────────────────────────────────────────────────────────────────
def test_ban_hides_content_logs_out_and_blocks_login(world, app):
    alice, mod, bob = world['alice'], world['mod'], world['bob']
    pid = new_post(alice, 'my post')
    bob_post = new_post(bob)
    alice.post(f'/api/posts/{bob_post}/comments', json={'body': 'hi from alice'})
    report(bob, 'post', pid)

    r = mod.post('/api/admin/users/alice/ban', json={'reason': 'spam account'})
    assert r.get_json() == {'ok': True, 'is_banned': True}

    assert alice.get('/api/auth/me').get_json()['user'] is None                 # session killed
    r = app.test_client().post('/api/auth/login', json={'login': 'alice', 'password': 'password123'})
    assert r.status_code == 403
    assert bob.get('/api/feed').get_json()['items'][0]['id'] == bob_post        # alice's post hidden
    assert bob.get(f'/api/posts/{pid}').status_code == 404
    assert bob.get(f'/api/posts/{bob_post}/comments').get_json()['items'] == []
    assert bob.get('/api/users/search?q=alice').get_json()['items'] == []
    assert bob.get('/api/users/alice').get_json()['user']['is_banned'] is True
    assert mod.get('/api/admin/reports').get_json()['items'] == []              # reports about alice closed

    banned = mod.get('/api/admin/users?filter=banned').get_json()['items']
    assert [u['username'] for u in banned] == ['alice'] and banned[0]['ban_reason'] == 'spam account'

    assert mod.post('/api/admin/users/alice/unban').get_json()['is_banned'] is False
    r = app.test_client().post('/api/auth/login', json={'login': 'alice', 'password': 'password123'})
    assert r.status_code == 200
    assert bob.get(f'/api/posts/{pid}').status_code == 200


def test_ban_with_content_deletion(world):
    alice, mod = world['alice'], world['mod']
    pid = new_post(alice)
    mod.post('/api/admin/users/alice/ban', json={'delete_content': True})
    mod.post('/api/admin/users/alice/unban')
    assert mod.get(f'/api/posts/{pid}').status_code == 404


def test_ban_permissions(world):
    mod, boss, bob = world['mod'], world['boss'], world['bob']
    assert bob.post('/api/admin/users/alice/ban').status_code == 403
    assert mod.post('/api/admin/users/ghost/ban').status_code == 404
    assert mod.post('/api/admin/users/ghost/unban').status_code == 404
    assert mod.post('/api/admin/users/mod/ban').status_code == 403      # not yourself
    assert mod.post('/api/admin/users/boss/ban').status_code == 403     # not a higher role
    assert mod.post('/api/admin/users/boss/unban').status_code == 403
    assert boss.post('/api/admin/users/mod/ban').status_code == 200     # admin can ban a moderator


def test_roles(world):
    mod, boss = world['mod'], world['boss']
    assert mod.put('/api/admin/users/alice/role', json={'role': 'moderator'}).status_code == 403
    assert boss.put('/api/admin/users/ghost/role', json={'role': 'moderator'}).status_code == 404
    assert boss.put('/api/admin/users/boss/role', json={'role': 'user'}).status_code == 400
    assert boss.put('/api/admin/users/alice/role', json={'role': 'king'}).status_code == 400
    assert boss.put('/api/admin/users/alice/role', json={'role': 'moderator'}).get_json()['role'] == 'moderator'
    assert world['alice'].get('/api/admin/stats').status_code == 200
    assert world['alice'].get('/api/auth/me').get_json()['user']['role'] == 'moderator'

    staff = boss.get('/api/admin/users?filter=staff').get_json()['items']
    assert {u['username'] for u in staff} == {'alice', 'mod', 'boss'}
    assert [u['username'] for u in boss.get('/api/admin/users?q=car').get_json()['items']] == ['carol']
