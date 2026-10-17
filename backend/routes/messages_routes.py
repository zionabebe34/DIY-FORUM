"""Private 1-on-1 messages between users."""
from flask import Blueprint, jsonify, request

from auth import current_user, login_required
from db import commit, execute, query
from routes.market_routes import get_listing, serialize as serialize_listing
from utils import iso, user_brief, user_brief_sql

bp = Blueprint('messages', __name__, url_prefix='/api/messages')

MAX_CHARS = 2000


def _other(username):
    """The (not banned) user with this username, or None."""
    return query('SELECT * FROM users WHERE username = %s AND is_banned = FALSE', (username,), one=True)


def _message(r, me_id, listings):
    """Message row → API dict (from_me, read, attached listing)."""
    return {'id': r['id'], 'body': r['body'], 'created_at': iso(r['created_at']), 'from_me': r['sender_id'] == me_id,
            'read': r['read_at'] is not None, 'listing': listings.get(r['listing_id'])}


@bp.get('/conversations')
@login_required
def conversations():
    """One row per person I've exchanged messages with: last message + my unread count."""
    me = current_user()['id']
    rows = query(f"""
        SELECT m.*, {user_brief_sql('u', 'w_')}, u.bio AS w_bio,
               (SELECT COUNT(*) FROM messages x WHERE x.sender_id = u.id AND x.recipient_id = %s
                                                  AND x.read_at IS NULL) AS unread
        FROM messages m
        JOIN (SELECT IF(sender_id = %s, recipient_id, sender_id) AS other_id, MAX(id) AS last_id
              FROM messages WHERE sender_id = %s OR recipient_id = %s GROUP BY other_id) t ON t.last_id = m.id
        JOIN users u ON u.id = t.other_id
        WHERE u.is_banned = FALSE
        ORDER BY m.id DESC""", (me, me, me, me))
    return jsonify({'items': [{
        'with': {**user_brief(r, 'w_'), 'bio': r['w_bio'] or ''},
        'last': {'body': r['body'], 'created_at': iso(r['created_at']), 'from_me': r['sender_id'] == me},
        'unread': int(r['unread']),
    } for r in rows]})


@bp.get('/with/<username>')
@login_required
def thread(username):
    """The conversation with one user (oldest first). Opening it marks their messages as read.
    ?after=<id> returns only newer messages (used for polling)."""
    me = current_user()['id']
    other = _other(username)
    if other is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    after = request.args.get('after', 0, type=int)
    rows = query("""SELECT * FROM messages
                    WHERE ((sender_id = %s AND recipient_id = %s) OR (sender_id = %s AND recipient_id = %s))
                      AND id > %s
                    ORDER BY id DESC LIMIT 200""", (me, other['id'], other['id'], me, after))[::-1]
    listing_ids = {r['listing_id'] for r in rows if r['listing_id']}
    listings = {}
    for lid in listing_ids:
        row = get_listing(lid)
        if row:
            listings[lid] = serialize_listing(row)
    execute('UPDATE messages SET read_at = UTC_TIMESTAMP() WHERE sender_id = %s AND recipient_id = %s AND read_at IS NULL',
            (other['id'], me))
    commit()
    return jsonify({
        'with': {'id': other['id'], 'username': other['username'], 'name': other['name'],
                 'avatar_url': other['avatar_url'], 'verified': bool(other['verified']),
                 'is_agent': bool(other['is_agent']), 'bio': other['bio'] or '', 'location': other['location'] or ''},
        'items': [_message(r, me, listings) for r in rows],
    })


@bp.post('/with/<username>')
@login_required
def send(username):
    """Send a private message (optionally about a marketplace listing)."""
    me = current_user()
    other = _other(username)
    if other is None:
        return jsonify({'error': 'המשתמש לא נמצא'}), 404
    if other['id'] == me['id']:
        return jsonify({'error': 'אי אפשר לשלוח הודעה לעצמך'}), 400
    data = request.get_json(silent=True) or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'ההודעה ריקה'}), 400
    if len(body) > MAX_CHARS:
        return jsonify({'error': f'ההודעה ארוכה מדי (עד {MAX_CHARS} תווים)'}), 400
    listing_id = data.get('listing_id')
    listing = get_listing(listing_id) if listing_id else None
    if listing_id and listing is None:
        return jsonify({'error': 'המודעה לא נמצאה'}), 400

    message_id, _ = execute('INSERT INTO messages (sender_id, recipient_id, body, listing_id) VALUES (%s, %s, %s, %s)',
                            (me['id'], other['id'], body, listing_id or None))
    commit()
    row = query('SELECT * FROM messages WHERE id = %s', (message_id,), one=True)
    return jsonify({'message': _message(row, me['id'], {listing_id: serialize_listing(listing)} if listing else {})}), 201


@bp.get('/unread')
@login_required
def unread():
    """Polled by the browser to show "new message" alerts without a refresh."""
    me = current_user()['id']
    count = query("""SELECT COUNT(*) AS n FROM messages m JOIN users u ON u.id = m.sender_id
                     WHERE m.recipient_id = %s AND m.read_at IS NULL AND u.is_banned = FALSE""", (me,), one=True)['n']
    latest = query(f"""SELECT m.id, m.body, {user_brief_sql('u', 's_')} FROM messages m JOIN users u ON u.id = m.sender_id
                       WHERE m.recipient_id = %s AND m.read_at IS NULL AND u.is_banned = FALSE
                       ORDER BY m.id DESC LIMIT 1""", (me,), one=True)
    return jsonify({'count': int(count),
                    'latest': {'id': latest['id'], 'body': latest['body'][:140], 'from': user_brief(latest, 's_')}
                    if latest else None})
