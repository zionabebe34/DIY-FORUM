def new_post(c, body='hello', **extra):
    data = {'body': body, **extra}
    return c.post('/api/posts', data=data, content_type='multipart/form-data').get_json()['post']['id']


def new_listing(c, title='Old drill'):
    data = {'listing_type': 'sale', 'title': title, 'price': '150'}
    return c.post('/api/listings', data=data, content_type='multipart/form-data').get_json()['listing']['id']


def notes(c, **params):
    return c.get('/api/notifications', query_string=params).get_json()


def kinds(c, **params):
    return [n['kind'] for n in notes(c, **params)['items']]


# ── Notifications ───────────────────────────────────────────────────────────
def test_signup_welcome_and_read_flow(make_user, client):
    alice = make_user('alice')
    assert client.get('/api/notifications').status_code == 401
    data = notes(alice)
    assert data['unread'] == 1 and data['next_cursor'] is None
    welcome = data['items'][0]
    assert welcome['kind'] == 'system' and welcome['actor'] is None and 'HandyHub' in welcome['text']

    assert alice.get('/api/notifications/unread').get_json() == {'count': 1}
    assert alice.post('/api/notifications/read').get_json() == {'unread': 0}
    assert notes(alice)['items'][0]['read'] is True
    assert kinds(alice, filter='unread') == []


def test_like_follow_save_notify_and_undo(make_user):
    alice = make_user('alice')
    bob = make_user('bob')
    alice.post('/api/notifications/read')
    pid = new_post(alice, '<p>My <b>bench</b></p>')

    bob.post(f'/api/posts/{pid}/like')
    bob.post(f'/api/posts/{pid}/like')            # idempotent → still one notification
    bob.post('/api/users/alice/follow')
    bob.post(f'/api/posts/{pid}/save')
    bob.post(f'/api/posts/{pid}/save')
    alice.post(f'/api/posts/{pid}/like')           # own actions never notify
    assert kinds(alice) == ['save', 'follow', 'like', 'system']
    like = notes(alice)['items'][2]
    assert like['actor']['username'] == 'bob' and like['post'] == {'id': pid, 'kind': 'project', 'title': 'My bench'}
    assert alice.get('/api/notifications/unread').get_json()['count'] == 3

    bob.delete(f'/api/posts/{pid}/like')
    bob.delete('/api/users/alice/follow')
    bob.delete(f'/api/posts/{pid}/save')
    assert kinds(alice) == ['system']


def test_comments_replies_and_mentions(make_user):
    alice = make_user('alice')
    bob = make_user('bob')
    carol = make_user('carol')
    pid = new_post(alice)

    top = bob.post(f'/api/posts/{pid}/comments', json={'body': 'Nice! @carol look'}).get_json()['comment']
    assert kinds(alice, filter='mentions') == ['comment']
    assert kinds(carol, filter='mentions') == ['mention']
    assert notes(carol)['items'][0]['text'] == 'Nice! @carol look'

    # Carol replies to Bob: Bob gets a reply, Alice (post author) a comment
    carol.post(f'/api/posts/{pid}/comments', json={'body': 'agreed', 'parent_id': top['id']})
    assert kinds(bob, filter='mentions') == ['reply']
    assert kinds(alice, filter='mentions') == ['comment', 'comment']
    # Alice replies on her own post: only Bob hears about it (once, as a reply, even if @mentioned)
    alice.post(f'/api/posts/{pid}/comments', json={'body': 'thanks @bob @alice', 'parent_id': top['id']})
    assert kinds(bob, filter='mentions') == ['reply', 'reply']
    assert kinds(alice, filter='mentions') == ['comment', 'comment']

    # Deleting the comment removes notifications about it
    bob.delete(f"/api/comments/{top['id']}")
    assert kinds(carol, filter='mentions') == []


def test_mentions_in_posts_and_banned_actors_hidden(make_user, set_role):
    alice = make_user('alice')
    bob = make_user('bob')
    boss = make_user('boss')
    set_role('boss', 'admin')
    new_post(bob, 'look @alice and @nobody_here and email x@alice.com')
    data = notes(alice)
    assert [n['kind'] for n in data['items']] == ['mention', 'system']
    tid = data['items'][0]['id']

    boss.post('/api/admin/users/bob/ban')
    assert kinds(alice) == ['system']
    assert alice.get('/api/notifications/unread').get_json()['count'] == 1
    boss.post('/api/admin/users/bob/unban')
    assert alice.post('/api/notifications/read', json={'ids': [tid]}).get_json() == {'unread': 1}


def test_notification_paging(make_user):
    alice = make_user('alice')
    pid = new_post(alice)
    for i in range(32):
        make_user(f'fan{i:02d}').post(f'/api/posts/{pid}/like')
    first = notes(alice)
    assert len(first['items']) == 30 and first['next_cursor'] and first['unread'] == 33
    rest = notes(alice, before=first['next_cursor'])
    assert len(rest['items']) == 3 and rest['next_cursor'] is None


# ── Saved ───────────────────────────────────────────────────────────────────
def test_save_posts_and_listings(make_user, client):
    alice = make_user('alice')
    bob = make_user('bob')
    p1, p2 = new_post(alice, 'one'), new_post(alice, 'two')
    lid = new_listing(alice)

    assert client.post(f'/api/posts/{p1}/save').status_code == 401
    assert client.get('/api/saved').status_code == 401
    assert bob.post('/api/posts/9999/save').status_code == 404
    assert bob.delete('/api/posts/9999/save').status_code == 404
    assert bob.post('/api/listings/9999/save').status_code == 404

    assert bob.post(f'/api/posts/{p1}/save').get_json() == {'saved': True, 'saves_count': 1}
    bob.post(f'/api/posts/{p2}/save')
    assert bob.post(f'/api/listings/{lid}/save').get_json() == {'saved': True}

    post = bob.get(f'/api/posts/{p1}').get_json()['post']
    assert post['saved_by_me'] is True and post['saves_count'] == 1
    assert alice.get(f'/api/posts/{p1}').get_json()['post']['saved_by_me'] is False
    assert bob.get('/api/listings').get_json()['items'][0]['saved_by_me'] is True
    assert client.get('/api/listings').get_json()['items'][0]['saved_by_me'] is False

    saved = bob.get('/api/saved').get_json()
    assert sorted(p['id'] for p in saved['posts']) == [p1, p2]
    assert [l['id'] for l in saved['listings']] == [lid] and saved['listings'][0]['saved_by_me'] is True
    assert alice.get('/api/saved').get_json() == {'posts': [], 'listings': []}   # private per user

    assert bob.delete(f'/api/posts/{p1}/save').get_json() == {'saved': False, 'saves_count': 0}
    assert bob.delete(f'/api/listings/{lid}/save').get_json() == {'saved': False}
    saved = bob.get('/api/saved').get_json()
    assert [p['id'] for p in saved['posts']] == [p2] and saved['listings'] == []

    # Deleting the post removes it from everyone's saved list
    alice.delete(f'/api/posts/{p2}')
    assert bob.get('/api/saved').get_json()['posts'] == []


# ── Sharing ─────────────────────────────────────────────────────────────────
def test_share_post_embeds_original_and_notifies(make_user, set_role):
    alice = make_user('alice')
    bob = make_user('bob')
    carol = make_user('carol')
    boss = make_user('boss')
    set_role('boss', 'admin')
    pid = new_post(alice, '<p>My bench</p>')

    r = bob.post('/api/posts', data={'body': '', 'shared_post_id': str(pid)}, content_type='multipart/form-data')
    assert r.status_code == 201
    share = r.get_json()['post']
    assert share['shared_post_id'] == pid and share['shared_post']['body_html'] == '<p>My bench</p>'
    assert share['shared_post']['shared_post'] is None
    note = notes(alice)['items'][0]
    assert note['kind'] == 'share' and note['actor']['username'] == 'bob' and note['post']['id'] == share['id']

    # Sharing a share quotes the original; sharing your own post doesn't notify yourself
    again = carol.post('/api/posts', data={'body': '<p>wow</p>', 'shared_post_id': str(share['id'])},
                       content_type='multipart/form-data').get_json()['post']
    assert again['shared_post_id'] == pid
    assert kinds(alice)[:2] == ['share', 'share']
    alice.post('/api/posts', data={'shared_post_id': str(pid)}, content_type='multipart/form-data')
    assert kinds(alice)[:2] == ['share', 'share']

    # Errors
    bad = bob.post('/api/posts', data={'shared_post_id': '99999'}, content_type='multipart/form-data')
    assert bad.status_code == 400
    tut = bob.post('/api/posts', data={'kind': 'tutorial', 'title': 't', 'steps': '[{"title": "a"}]',
                                       'shared_post_id': str(pid)}, content_type='multipart/form-data')
    assert tut.status_code == 400

    # Original removed (or its author banned) → the share stays, without a preview
    boss.post('/api/admin/users/alice/ban')
    assert bob.get(f"/api/posts/{share['id']}").get_json()['post']['shared_post'] is None
    boss.post('/api/admin/users/alice/unban')
    boss.delete(f'/api/posts/{pid}')   # (the ban logged alice out)
    post = bob.get(f"/api/posts/{share['id']}").get_json()['post']
    assert post['shared_post'] is None and post['shared_post_id'] == pid   # the UI shows "original removed"
