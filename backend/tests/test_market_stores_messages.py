import io

from tests.conftest import PNG_1PX


def sale(c, **extra):
    data = {'listing_type': 'sale', 'title': 'Old drill', 'price': '150', 'condition': 'used', 'category': 'power', **extra}
    return c.post('/api/listings', data=data, content_type='multipart/form-data')


def lend(c, **extra):
    data = {'listing_type': 'lend', 'title': 'Table saw', 'daily_price': '60', **extra}
    return c.post('/api/listings', data=data, content_type='multipart/form-data')


# ── Marketplace ─────────────────────────────────────────────────────────────
def test_create_and_list_listings(make_user, client):
    alice = make_user('alice')
    r = sale(alice, description='works great', image=(io.BytesIO(PNG_1PX), 'drill.png'))
    assert r.status_code == 201
    item = r.get_json()['listing']
    assert item['title'] == 'Old drill' and item['price'] == 150 and item['category'] == 'power'
    assert item['image_url'].startswith('/uploads/') and item['seller']['username'] == 'alice'

    lent = lend(alice).get_json()['listing']
    assert (lent['daily_price'], lent['weekly_price'], lent['deposit']) == (60, 300, 0)   # weekly defaults to 5×daily

    page = client.get('/api/listings').get_json()
    assert [x['title'] for x in page['items']] == ['Table saw', 'Old drill']
    assert page['counts'] == {'all': 2, 'sale': 1, 'lend': 1}
    assert [x['title'] for x in client.get('/api/listings?type=lend').get_json()['items']] == ['Table saw']
    assert client.get('/api/listings?category=hand').get_json()['items'] == []
    assert len(client.get('/api/listings?seller=alice').get_json()['items']) == 2


def test_listing_pagination(make_user, client):
    alice = make_user('alice')
    for i in range(5):
        sale(alice, title=f'tool {i}')
    first = client.get('/api/listings?limit=3').get_json()
    assert len(first['items']) == 3 and first['next_cursor']
    rest = client.get(f"/api/listings?limit=3&before={first['next_cursor']}").get_json()
    assert len(rest['items']) == 2 and rest['next_cursor'] is None


def test_listing_validation(make_user, client):
    alice = make_user('alice')
    assert sale(alice, listing_type='swap').status_code == 400
    assert sale(alice, title='').status_code == 400
    assert sale(alice, price='').status_code == 400
    assert sale(alice, price='abc').status_code == 400
    assert sale(alice, price='0').status_code == 400
    assert sale(alice, price='-5').status_code == 400
    assert lend(alice, daily_price='').status_code == 400
    assert sale(alice, image=(io.BytesIO(b'not an image'), 'x.png')).status_code == 400
    assert sale(alice, category='weird').get_json()['listing']['category'] == 'other'
    assert sale(client).status_code == 401


def test_delete_listing_and_banned_sellers_hidden(make_user, set_role, client):
    alice = make_user('alice')
    bob = make_user('bob')
    boss = make_user('boss')
    set_role('boss', 'admin')
    lid = sale(alice).get_json()['listing']['id']
    other = sale(alice, title='second').get_json()['listing']['id']
    assert bob.delete(f'/api/listings/{lid}').status_code == 403
    assert alice.delete(f'/api/listings/{lid}').status_code == 200
    assert alice.delete(f'/api/listings/{lid}').status_code == 404
    assert boss.delete(f'/api/listings/{other}').status_code == 200    # moderators can remove any listing
    sale(alice, title='third')
    boss.post('/api/admin/users/alice/ban')
    assert client.get('/api/listings').get_json()['items'] == []


# ── Store reviews ───────────────────────────────────────────────────────────
def review(c, **data):
    return c.post('/api/stores/reviews', json=data)


def test_review_creates_store_and_lists_it(make_user, client):
    alice = make_user('alice')
    bob = make_user('bob')
    r = review(alice, store_name='Wood Shop', area='Haifa', rating=4.5, body='Great',
               pros=['service', '  ', 'prices'], cons=['far'])
    assert r.status_code == 201
    sid = r.get_json()['store_id']
    assert r.get_json()['review']['pros'] == ['service', 'prices']
    # same name+area → same store
    assert review(bob, store_name='Wood Shop', area='Haifa', rating=3).get_json()['store_id'] == sid
    # a different branch is a different store
    assert review(bob, store_name='Wood Shop', area='Eilat', rating=5).get_json()['store_id'] != sid

    stores = client.get('/api/stores').get_json()['items']
    top = next(s for s in stores if s['id'] == sid)
    assert top['reviews_count'] == 2 and top['avg_rating'] == 3.75

    detail = client.get(f'/api/stores/{sid}?sort=highest').get_json()
    assert [rv['rating'] for rv in detail['reviews']] == [4.5, 3.0]
    assert [rv['rating'] for rv in client.get(f'/api/stores/{sid}?sort=lowest').get_json()['reviews']] == [3.0, 4.5]
    assert detail['distribution'] == {'1': 0, '2': 0, '3': 1, '4': 1, '5': 0}


def test_rereview_updates_and_validation(make_user, client):
    alice = make_user('alice')
    sid = review(alice, store_name='Shop', rating=2).get_json()['store_id']
    review(alice, store_id=sid, rating=5, body='Changed my mind')
    reviews = client.get(f'/api/stores/{sid}').get_json()['reviews']
    assert len(reviews) == 1 and reviews[0]['rating'] == 5 and reviews[0]['body'] == 'Changed my mind'

    assert review(alice, store_name='Shop', rating=0).status_code == 400
    assert review(alice, store_name='Shop', rating='x').status_code == 400
    assert review(alice, store_name='', rating=4).status_code == 400
    assert review(alice, store_id=99999, rating=4).status_code == 404
    assert review(client, store_name='Shop', rating=4).status_code == 401
    assert client.get('/api/stores/99999').status_code == 404


def test_delete_review(make_user):
    alice = make_user('alice')
    bob = make_user('bob')
    rid = review(alice, store_name='Shop', rating=4).get_json()['review']['id']
    assert bob.delete(f'/api/stores/reviews/{rid}').status_code == 403
    assert alice.delete(f'/api/stores/reviews/{rid}').status_code == 200
    assert alice.delete(f'/api/stores/reviews/{rid}').status_code == 404


# ── Messages ────────────────────────────────────────────────────────────────
def test_conversation_flow(make_user):
    alice = make_user('alice')
    bob = make_user('bob')
    carol = make_user('carol')
    lid = sale(alice).get_json()['listing']['id']

    r = bob.post('/api/messages/with/alice', json={'body': 'Is the drill available?', 'listing_id': lid})
    assert r.status_code == 201 and r.get_json()['message']['listing']['title'] == 'Old drill'
    carol.post('/api/messages/with/alice', json={'body': 'Hi!'})

    # alice's inbox: two conversations, newest first, both unread
    unread = alice.get('/api/messages/unread').get_json()
    assert unread['count'] == 2 and unread['latest']['from']['username'] == 'carol'
    convos = alice.get('/api/messages/conversations').get_json()['items']
    assert [c['with']['username'] for c in convos] == ['carol', 'bob']
    assert convos[1]['unread'] == 1 and convos[1]['last']['from_me'] is False

    # every user sees only their own conversations
    assert [c['with']['username'] for c in bob.get('/api/messages/conversations').get_json()['items']] == ['alice']
    assert bob.get('/api/messages/conversations').get_json()['items'][0]['last']['from_me'] is True

    # opening the thread marks it read; replies and ?after polling
    thread = alice.get('/api/messages/with/bob').get_json()
    assert thread['with']['username'] == 'bob' and thread['items'][0]['listing']['id'] == lid
    first_id = thread['items'][0]['id']
    assert alice.get('/api/messages/unread').get_json()['count'] == 1
    alice.post('/api/messages/with/bob', json={'body': 'Yes, still here'})
    newer = bob.get(f'/api/messages/with/alice?after={first_id}').get_json()['items']
    assert [m['body'] for m in newer] == ['Yes, still here'] and newer[0]['from_me'] is False


def test_message_validation(make_user, client):
    alice = make_user('alice')
    make_user('bob')
    assert alice.post('/api/messages/with/alice', json={'body': 'me'}).status_code == 400
    assert alice.post('/api/messages/with/ghost', json={'body': 'hi'}).status_code == 404
    assert alice.post('/api/messages/with/bob', json={'body': '  '}).status_code == 400
    assert alice.post('/api/messages/with/bob', json={'body': 'x' * 2001}).status_code == 400
    assert alice.post('/api/messages/with/bob', json={'body': 'hi', 'listing_id': 99999}).status_code == 400
    assert alice.get('/api/messages/with/ghost').status_code == 404
    assert client.get('/api/messages/conversations').status_code == 401
    assert alice.get('/api/messages/unread').get_json() == {'count': 0, 'latest': None}
