import io
import json

from utils import MAX_IMAGE_BYTES


def create(c, **data):
    return c.post('/api/posts', data=data, content_type='multipart/form-data')


def test_create_project_with_rich_text_and_image(make_user, png):
    c = make_user('alice')
    r = create(c, body='<p><strong>Bold</strong> <em>it</em> <a href="https://x.com">link</a> #נגרות</p>',
               tags=json.dumps(['#עץ', 'עץ', 'two words']), location='Haifa', images=[png('a.png'), png('b.png')])
    assert r.status_code == 201
    post = r.get_json()['post']
    assert '<strong>Bold</strong>' in post['body_html'] and '<em>it</em>' in post['body_html']
    assert 'href="https://x.com"' in post['body_html'] and 'target="_blank"' in post['body_html']
    assert sorted(post['tags']) == sorted(['#עץ', '#two_words', '#נגרות'])
    assert len(post['images']) == 2 and post['location'] == 'Haifa'
    assert post['author']['username'] == 'alice'
    assert post['created_at'].endswith('Z')


def test_html_is_sanitized(make_user):
    c = make_user('alice')
    body = ('<p onclick="x()">hi<script>alert(1)</script><img src=x onerror=alert(1)>'
            '<a href="javascript:alert(1)">bad</a></p>')
    html = create(c, body=body).get_json()['post']['body_html']
    for bad in ('script', 'onclick', 'onerror', '<img', 'javascript:'):
        assert bad not in html
    assert 'hi' in html


def test_create_tutorial(make_user):
    c = make_user('alice')
    steps = [{'title': 'Cut', 'note': 'carefully', 'thumb': 'ph-wood'}, {'title': ''}, {'title': 'Glue', 'thumb': 'bad'}]
    r = create(c, kind='tutorial', title='Make a box', body='<p>summary</p>', steps=json.dumps(steps))
    post = r.get_json()['post']
    assert post['kind'] == 'tutorial' and post['title'] == 'Make a box'
    assert [s['title'] for s in post['steps']] == ['Cut', 'Glue']
    assert post['steps'][1]['thumb'] != 'bad'


def test_create_validation(make_user, client, png):
    c = make_user('alice')
    assert create(c, body='').status_code == 400                                  # empty project
    assert create(c, body='<p>   </p>').status_code == 400
    assert create(c, kind='poll', body='x').status_code == 400
    assert create(c, kind='tutorial', title='', steps='[]').status_code == 400
    assert create(c, kind='tutorial', title='T', steps='[{"title": ""}]').status_code == 400
    assert create(c, body='x' * 5001).status_code == 400
    assert create(c, body='hi', images=[png(f'{i}.png') for i in range(7)]).status_code == 400
    assert create(c, body='hi', images=[(io.BytesIO(b'not an image'), 'x.png')]).status_code == 400
    assert create(c, body='hi', images=[(io.BytesIO(b''), 'x.png')]).status_code == 400
    big = b'\x89PNG\r\n\x1a\n' + b'0' * MAX_IMAGE_BYTES
    assert create(c, body='hi', images=[(io.BytesIO(big), 'x.png')]).status_code == 400
    assert create(client, body='hi').status_code == 401


def test_image_only_post_is_allowed(make_user, png):
    c = make_user('alice')
    assert create(c, images=[png()]).status_code == 201


def test_other_image_formats(make_user):
    c = make_user('alice')
    for head in (b'\xff\xd8\xff\xe0', b'GIF89a', b'RIFF\x00\x00\x00\x00WEBPVP8 '):
        r = create(c, body='x', images=[(io.BytesIO(head + b'\x00' * 32), 'img')])
        assert r.status_code == 201


def test_global_feed_pagination(make_user, client):
    c = make_user('alice')
    ids = [create(c, body=f'post {i}').get_json()['post']['id'] for i in range(25)]
    page = client.get('/api/feed?limit=10').get_json()
    assert [p['id'] for p in page['items']] == ids[::-1][:10]
    seen = [p['id'] for p in page['items']]
    while page['next_cursor']:
        page = client.get(f"/api/feed?limit=10&before={page['next_cursor']}").get_json()
        seen += [p['id'] for p in page['items']]
    assert seen == ids[::-1]
    assert len(client.get('/api/feed?limit=1000').get_json()['items']) == 25  # capped at 30


def test_following_feed(make_user, client):
    alice = make_user('alice')
    bob = make_user('bob')
    carol = make_user('carol')
    create(bob, body='from bob')
    create(carol, body='from carol')
    create(alice, body='from alice')
    alice.post('/api/users/bob/follow')

    authors = [p['author']['username'] for p in alice.get('/api/feed?scope=following').get_json()['items']]
    assert authors == ['alice', 'bob']
    assert client.get('/api/feed?scope=following').status_code == 401


def test_tag_filter_and_trending(make_user, client):
    c = make_user('alice')
    create(c, body='one #wood')
    create(c, body='two', tags=json.dumps(['wood', 'metal']))
    create(c, body='three', tags=json.dumps(['metal']))
    create(c, body='four', tags=json.dumps(['wood']))

    assert len(client.get('/api/feed?tag=%23wood').get_json()['items']) == 3
    assert len(client.get('/api/feed?tag=metal').get_json()['items']) == 2
    trending = client.get('/api/tags/trending').get_json()['items']
    assert trending[:2] == [{'tag': '#wood', 'posts': 3, 'recent': 3}, {'tag': '#metal', 'posts': 2, 'recent': 2}]


def test_trending_counts_every_post_but_ranks_by_this_week(make_user, set_role, client):
    alice = make_user('alice')
    bob = make_user('bob')
    boss = make_user('boss')
    set_role('boss', 'admin')
    old_ids = [create(alice, body=f'old {i} #wood').get_json()['post']['id'] for i in range(4)]
    create(alice, body='new #metal')
    create(alice, body='new #metal')
    create(bob, body='hidden soon #metal #wood')
    # the #wood posts are a month old: they still count, but #metal is the one active this week
    from tests.conftest import TEST_DB
    from seed import connect
    conn = connect(TEST_DB)
    marks = ', '.join(['%s'] * len(old_ids))
    conn.cursor().execute(f'UPDATE posts SET created_at = UTC_TIMESTAMP() - INTERVAL 30 DAY WHERE id IN ({marks})', old_ids)
    conn.commit()
    conn.close()

    items = client.get('/api/tags/trending').get_json()['items']
    assert items == [{'tag': '#metal', 'posts': 3, 'recent': 3}, {'tag': '#wood', 'posts': 5, 'recent': 1}]
    assert client.get('/api/search?q=wood').get_json()['tags'] == [{'tag': 'wood', 'posts': 5}]

    # a banned author's posts no longer count; a deleted post neither
    boss.post('/api/admin/users/bob/ban')
    alice.delete(f'/api/posts/{old_ids[0]}')
    items = client.get('/api/tags/trending').get_json()['items']
    assert items == [{'tag': '#metal', 'posts': 2, 'recent': 2}, {'tag': '#wood', 'posts': 3, 'recent': 0}]
    assert client.get('/api/search?q=wood').get_json()['tags'] == [{'tag': 'wood', 'posts': 3}]


def test_user_posts_and_single_post(make_user, client):
    alice = make_user('alice')
    bob = make_user('bob')
    pid = create(alice, body='mine').get_json()['post']['id']
    create(bob, body='theirs')

    items = client.get('/api/users/alice/posts').get_json()['items']
    assert [p['id'] for p in items] == [pid]
    assert client.get('/api/users/ghost/posts').status_code == 404
    assert client.get(f'/api/posts/{pid}').get_json()['post']['body_html'] == 'mine'
    assert client.get('/api/posts/999999').status_code == 404


def test_delete_post(make_user):
    alice = make_user('alice')
    bob = make_user('bob')
    pid = create(alice, body='mine').get_json()['post']['id']
    assert bob.delete(f'/api/posts/{pid}').status_code == 403
    assert alice.delete(f'/api/posts/{pid}').status_code == 200
    assert alice.delete(f'/api/posts/{pid}').status_code == 404


def test_search(make_user, client):
    c = make_user('woodfan', 'Wood Fan')
    create(c, body='building a wooden bench', tags=json.dumps(['woodwork']))
    r = client.get('/api/search?q=wood').get_json()
    assert [u['username'] for u in r['people']] == ['woodfan']
    assert len(r['posts']) == 1
    assert r['tags'] == [{'tag': 'woodwork', 'posts': 1}]
    assert client.get('/api/search?q=').get_json() == {'people': [], 'posts': [], 'tags': []}


def test_request_too_large(app, make_user):
    c = make_user('alice')
    app.config['MAX_CONTENT_LENGTH'] = 100
    r = create(c, body='x' * 500)
    assert r.status_code == 413 and 'error' in r.get_json()
