def new_post(c, body='hello'):
    return c.post('/api/posts', data={'body': body}, content_type='multipart/form-data').get_json()['post']['id']


def test_like_unlike_and_counts(make_user, client):
    alice = make_user('alice')
    bob = make_user('bob')
    pid = new_post(alice)

    assert bob.post(f'/api/posts/{pid}/like').get_json() == {'liked': True, 'likes_count': 1}
    assert bob.post(f'/api/posts/{pid}/like').get_json()['likes_count'] == 1   # idempotent
    assert alice.post(f'/api/posts/{pid}/like').get_json()['likes_count'] == 2

    post = bob.get(f'/api/posts/{pid}').get_json()['post']
    assert post['likes_count'] == 2 and post['liked_by_me'] is True
    assert client.get(f'/api/posts/{pid}').get_json()['post']['liked_by_me'] is False  # anonymous

    assert bob.delete(f'/api/posts/{pid}/like').get_json() == {'liked': False, 'likes_count': 1}
    feed_post = bob.get('/api/feed').get_json()['items'][0]
    assert feed_post['likes_count'] == 1 and feed_post['liked_by_me'] is False


def test_like_errors(make_user, client):
    alice = make_user('alice')
    pid = new_post(alice)
    assert client.post(f'/api/posts/{pid}/like').status_code == 401
    assert alice.post('/api/posts/999999/like').status_code == 404
    assert alice.delete('/api/posts/999999/like').status_code == 404


def test_comments_thread_and_nesting(make_user, client):
    alice = make_user('alice')
    bob = make_user('bob')
    pid = new_post(alice)

    r = bob.post(f'/api/posts/{pid}/comments', json={'body': '  Nice work!  '})
    assert r.status_code == 201
    top = r.get_json()['comment']
    assert top['body'] == 'Nice work!' and top['parent_id'] is None and top['author']['username'] == 'bob'

    reply = alice.post(f'/api/posts/{pid}/comments', json={'body': 'Thanks', 'parent_id': top['id']}).get_json()['comment']
    assert reply['parent_id'] == top['id']
    # A reply to a reply is attached to the same top-level comment (one level of nesting)
    deep = bob.post(f'/api/posts/{pid}/comments', json={'body': ':)', 'parent_id': reply['id']}).get_json()['comment']
    assert deep['parent_id'] == top['id']

    items = client.get(f'/api/posts/{pid}/comments').get_json()['items']
    assert [c['body'] for c in items] == ['Nice work!', 'Thanks', ':)']
    assert client.get(f'/api/posts/{pid}').get_json()['post']['comments_count'] == 3


def test_comment_validation(make_user, client):
    alice = make_user('alice')
    pid = new_post(alice)
    other = new_post(alice, 'other post')
    foreign = alice.post(f'/api/posts/{other}/comments', json={'body': 'x'}).get_json()['comment']['id']

    assert alice.post(f'/api/posts/{pid}/comments', json={'body': '   '}).status_code == 400
    assert alice.post(f'/api/posts/{pid}/comments', json={'body': 'x' * 1001}).status_code == 400
    assert alice.post(f'/api/posts/{pid}/comments', json={'body': 'x', 'parent_id': foreign}).status_code == 400
    assert alice.post(f'/api/posts/{pid}/comments', json={'body': 'x', 'parent_id': 999999}).status_code == 400
    assert alice.post('/api/posts/999999/comments', json={'body': 'x'}).status_code == 404
    assert client.get('/api/posts/999999/comments').status_code == 404
    assert client.post(f'/api/posts/{pid}/comments', json={'body': 'x'}).status_code == 401


def test_comment_body_is_plain_text(make_user, client):
    alice = make_user('alice')
    pid = new_post(alice)
    alice.post(f'/api/posts/{pid}/comments', json={'body': '<script>alert(1)</script>'})
    # Stored verbatim as text; the frontend renders it as text (never as HTML)
    assert client.get(f'/api/posts/{pid}/comments').get_json()['items'][0]['body'] == '<script>alert(1)</script>'


def test_delete_comment_permissions(make_user):
    alice = make_user('alice')    # post author
    bob = make_user('bob')        # comment author
    carol = make_user('carol')    # stranger
    pid = new_post(alice)
    c1 = bob.post(f'/api/posts/{pid}/comments', json={'body': 'one'}).get_json()['comment']['id']
    bob.post(f'/api/posts/{pid}/comments', json={'body': 'reply', 'parent_id': c1})
    c2 = bob.post(f'/api/posts/{pid}/comments', json={'body': 'two'}).get_json()['comment']['id']

    assert carol.delete(f'/api/comments/{c1}').status_code == 403
    assert bob.delete(f'/api/comments/{c1}').status_code == 200      # own comment (+ its reply)
    assert alice.delete(f'/api/comments/{c2}').status_code == 200    # comment on own post
    assert alice.delete(f'/api/comments/{c2}').status_code == 404
    assert alice.get(f'/api/posts/{pid}/comments').get_json()['items'] == []
