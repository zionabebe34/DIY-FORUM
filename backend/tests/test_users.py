import io


def test_profile_counts_and_flags(make_user):
    alice = make_user('alice', 'Alice')
    bob = make_user('bob', 'Bob')
    alice.post('/api/posts', data={'body': '<p>hello</p>'})
    bob.post('/api/users/alice/follow')

    p = bob.get('/api/users/alice').get_json()['user']
    assert p['name'] == 'Alice'
    assert (p['followers_count'], p['following_count'], p['posts_count']) == (1, 0, 1)
    assert p['is_following'] is True and p['is_me'] is False and p['follows_you'] is False

    me = alice.get('/api/users/alice').get_json()['user']
    assert me['is_me'] is True
    assert alice.get('/api/users/bob').get_json()['user']['follows_you'] is True


def test_profile_404(client):
    assert client.get('/api/users/ghost').status_code == 404


def test_follow_unfollow_and_lists(make_user):
    alice = make_user('alice')
    bob = make_user('bob')
    make_user('carol')

    r = bob.post('/api/users/alice/follow')
    assert r.get_json() == {'is_following': True, 'followers_count': 1}
    assert bob.post('/api/users/alice/follow').get_json()['followers_count'] == 1  # idempotent
    bob.post('/api/users/carol/follow')

    followers = alice.get('/api/users/alice/followers').get_json()
    assert [u['username'] for u in followers['items']] == ['bob']
    assert followers['next_cursor'] is None
    assert followers['items'][0]['is_following'] is False  # alice doesn't follow bob back

    following = alice.get('/api/users/bob/following').get_json()['items']
    assert {u['username'] for u in following} == {'alice', 'carol'}

    r = bob.delete('/api/users/alice/follow')
    assert r.get_json() == {'is_following': False, 'followers_count': 0}
    assert alice.get('/api/users/alice/followers').get_json()['items'] == []


def test_follow_errors(make_user, client):
    alice = make_user('alice')
    assert alice.post('/api/users/alice/follow').status_code == 400
    assert alice.post('/api/users/ghost/follow').status_code == 404
    assert alice.delete('/api/users/ghost/follow').status_code == 404
    assert alice.get('/api/users/ghost/followers').status_code == 404
    assert client.post('/api/users/alice/follow').status_code == 401


def test_follow_list_pagination(make_user):
    target = make_user('star')
    for i in range(22):
        make_user(f'fan{i:02d}').post('/api/users/star/follow')
    page1 = target.get('/api/users/star/followers').get_json()
    assert len(page1['items']) == 20 and page1['next_cursor'] == 20
    page2 = target.get('/api/users/star/followers?cursor=20').get_json()
    assert len(page2['items']) == 2 and page2['next_cursor'] is None


def test_search_by_username_and_name(make_user, client):
    make_user('woodworker', 'אלון כהן')
    make_user('welder', 'Iris')
    names = lambda q: [u['username'] for u in client.get(f'/api/users/search?q={q}').get_json()['items']]
    assert names('wo') == ['woodworker']
    assert set(names('w')) == {'woodworker', 'welder'}
    assert names('@welder') == ['welder']
    assert names('אלון') == ['woodworker']
    assert names('') == []
    assert names('%') == []  # LIKE wildcards are escaped


def test_suggested_ranks_by_mutuals(make_user, client):
    me = make_user('myself')
    friend = make_user('friend')
    make_user('target')
    make_user('popular')
    me.post('/api/users/friend/follow')
    friend.post('/api/users/target/follow')

    items = me.get('/api/users/suggested').get_json()['items']
    usernames = [u['username'] for u in items]
    assert usernames[0] == 'target' and items[0]['mutuals'] == 1
    assert 'myself' not in usernames and 'friend' not in usernames  # self + already followed excluded
    assert len(client.get('/api/users/suggested').get_json()['items']) == 4  # anonymous: everyone


def test_update_profile_json(make_user):
    c = make_user('alice')
    r = c.put('/api/users/me', json={'name': 'Alice L', 'bio': 'I weld.', 'location': 'Haifa',
                                     'cover': 'ph-steel', 'skills': ['TIG', ' MIG ', '']})
    u = r.get_json()['user']
    assert (u['name'], u['bio'], u['location'], u['cover']) == ('Alice L', 'I weld.', 'Haifa', 'ph-steel')
    assert u['skills'] == ['TIG', 'MIG']


def test_update_profile_validation(make_user, client):
    c = make_user('alice')
    assert c.put('/api/users/me', json={'name': ''}).status_code == 400
    assert c.put('/api/users/me', json={'bio': 'x' * 501}).status_code == 400
    assert c.put('/api/users/me', json={'location': 'x' * 81}).status_code == 400
    assert c.put('/api/users/me', json={'cover': 'javascript:alert(1)'}).status_code == 400
    assert c.put('/api/users/me', json={'skills': [str(i) for i in range(13)]}).status_code == 400
    assert client.put('/api/users/me', json={'name': 'x'}).status_code == 401


def test_avatar_upload_and_remove(make_user, png):
    c = make_user('alice')
    r = c.put('/api/users/me', data={'avatar': png(), 'name': 'Alice'}, content_type='multipart/form-data')
    url = r.get_json()['user']['avatar_url']
    assert url.startswith('/uploads/') and url.endswith('.png')
    assert c.get(url).status_code == 200

    r = c.put('/api/users/me', data={'remove_avatar': '1'}, content_type='multipart/form-data')
    assert r.get_json()['user']['avatar_url'] is None


def test_avatar_rejects_non_images(make_user):
    c = make_user('alice')
    fake = (io.BytesIO(b'<svg onload=alert(1)>'), 'evil.png')
    r = c.put('/api/users/me', data={'avatar': fake}, content_type='multipart/form-data')
    assert r.status_code == 400
