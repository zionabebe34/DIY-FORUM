"""Saved items ("bookmarks"): posts and marketplace listings, private to each user."""
from flask import Blueprint, jsonify

from auth import current_user, login_required
from db import commit, execute, query
from notifications import notify, unnotify
from routes.market_routes import _SELECT as LISTING_SELECT, serialize as serialize_listing
from routes.posts_routes import _POST_SELECT, _serialize_posts

bp = Blueprint('saved', __name__, url_prefix='/api')

MAX_SAVED = 100


def _saves_count(post_id):
    """How many users saved this post."""
    return int(query('SELECT COUNT(*) AS n FROM saved_posts WHERE post_id = %s', (post_id,), one=True)['n'])


# ── Posts ───────────────────────────────────────────────────────────────────
@bp.post('/posts/<int:post_id>/save')
@login_required
def save_post(post_id):
    """Save a post (idempotent); a new save notifies its author."""
    post = query('SELECT author_id FROM posts WHERE id = %s', (post_id,), one=True)
    if post is None:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    me = current_user()['id']
    # INSERT IGNORE: saving twice is a no-op, and only a real new save notifies the author
    _, inserted = execute('INSERT IGNORE INTO saved_posts (user_id, post_id) VALUES (%s, %s)', (me, post_id))
    if inserted:
        notify(post['author_id'], me, 'save', post_id)
    commit()
    return jsonify({'saved': True, 'saves_count': _saves_count(post_id)})


@bp.delete('/posts/<int:post_id>/save')
@login_required
def unsave_post(post_id):
    """Unsave a post and remove its notification."""
    post = query('SELECT author_id FROM posts WHERE id = %s', (post_id,), one=True)
    if post is None:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    me = current_user()['id']
    execute('DELETE FROM saved_posts WHERE user_id = %s AND post_id = %s', (me, post_id))
    unnotify(post['author_id'], me, 'save', post_id)
    commit()
    return jsonify({'saved': False, 'saves_count': _saves_count(post_id)})


# ── Listings ────────────────────────────────────────────────────────────────
@bp.post('/listings/<int:listing_id>/save')
@login_required
def save_listing(listing_id):
    """Save a marketplace listing."""
    if query('SELECT id FROM listings WHERE id = %s', (listing_id,), one=True) is None:
        return jsonify({'error': 'המודעה לא נמצאה'}), 404
    execute('INSERT IGNORE INTO saved_listings (user_id, listing_id) VALUES (%s, %s)',
            (current_user()['id'], listing_id))
    commit()
    return jsonify({'saved': True})


@bp.delete('/listings/<int:listing_id>/save')
@login_required
def unsave_listing(listing_id):
    """Unsave a marketplace listing."""
    execute('DELETE FROM saved_listings WHERE user_id = %s AND listing_id = %s', (current_user()['id'], listing_id))
    commit()
    return jsonify({'saved': False})


# ── Everything I saved ──────────────────────────────────────────────────────
@bp.get('/saved')
@login_required
def saved():
    """Most recently saved first. Content by banned users and closed listings is hidden."""
    me = current_user()['id']
    posts = query(f"""{_POST_SELECT} JOIN saved_posts s ON s.post_id = p.id
                      WHERE s.user_id = %s AND u.is_banned = FALSE
                      ORDER BY s.created_at DESC, p.id DESC LIMIT %s""", (me, MAX_SAVED))
    listings = query(f"""{LISTING_SELECT} JOIN saved_listings s ON s.listing_id = l.id
                         WHERE s.user_id = %s AND u.is_banned = FALSE AND l.status = 'active'
                         ORDER BY s.created_at DESC, l.id DESC LIMIT %s""", (me, MAX_SAVED))
    return jsonify({'posts': _serialize_posts(posts),
                    'listings': [{**serialize_listing(r), 'saved_by_me': True} for r in listings]})
