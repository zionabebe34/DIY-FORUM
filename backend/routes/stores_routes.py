"""Store reviews. A store is created by the first review that names it; each user
has one review per store (writing again updates it)."""
import json

from flask import Blueprint, jsonify, request

from auth import current_user, is_moderator, login_required
from db import commit, execute, query
from utils import iso, parse_json_list, user_brief, user_brief_sql

bp = Blueprint('stores', __name__, url_prefix='/api')

COVERS = ('ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night')
SORTS = {'recent': 'r.id DESC', 'highest': 'r.rating DESC, r.id DESC', 'lowest': 'r.rating ASC, r.id DESC'}

_STORE_SELECT = """
    SELECT s.*, COUNT(r.id) AS reviews_count, AVG(r.rating) AS avg_rating
    FROM stores s
    LEFT JOIN store_reviews r ON r.store_id = s.id
         AND r.author_id IN (SELECT id FROM users WHERE is_banned = FALSE)
"""


def _store(r):
    """Store row → API dict with its review count and average rating."""
    return {
        'id': r['id'], 'name': r['name'], 'area': r['area'], 'cover': r['cover'], 'address': r['address'],
        'phone': r['phone'], 'hours': r['hours'], 'summary': r['summary'] or '',
        'tags': parse_json_list(r['tags']) if isinstance(r['tags'], (str, bytes)) else (r['tags'] or []),
        'reviews_count': int(r['reviews_count']),
        'avg_rating': round(float(r['avg_rating']), 2) if r['avg_rating'] is not None else None,
    }


def _review(r):
    """Review row → API dict (rating, pros / cons, author)."""
    as_list = lambda v: parse_json_list(v) if isinstance(v, (str, bytes)) else (v or [])
    return {'id': r['id'], 'store_id': r['store_id'], 'rating': float(r['rating']), 'body': r['body'] or '',
            'pros': as_list(r['pros']), 'cons': as_list(r['cons']), 'created_at': iso(r['created_at']),
            'author': user_brief(r, 'a_')}


@bp.get('/stores')
def list_stores():
    """All stores, most reviewed first."""
    rows = query(f'{_STORE_SELECT} GROUP BY s.id ORDER BY reviews_count DESC, s.id DESC')
    return jsonify({'items': [_store(r) for r in rows]})


@bp.get('/stores/<int:store_id>')
def get_store(store_id):
    """One store with its reviews (?sort=recent|highest|lowest) and the star-rating histogram."""
    row = query(f'{_STORE_SELECT} WHERE s.id = %s GROUP BY s.id', (store_id,), one=True)
    if row is None:
        return jsonify({'error': 'החנות לא נמצאה'}), 404
    order = SORTS.get(request.args.get('sort'), SORTS['recent'])
    reviews = query(f"""SELECT r.*, {user_brief_sql('u', 'a_')} FROM store_reviews r
                        JOIN users u ON u.id = r.author_id
                        WHERE r.store_id = %s AND u.is_banned = FALSE ORDER BY {order}""", (store_id,))
    # rating histogram (rounded to whole stars)
    dist = {n: 0 for n in range(1, 6)}
    for r in reviews:
        dist[min(5, max(1, int(round(float(r['rating'])))))] += 1
    return jsonify({'store': _store(row), 'reviews': [_review(r) for r in reviews], 'distribution': dist})


def _clean_lines(raw):
    """Pros / cons JSON → up to 8 trimmed lines."""
    return [str(x).strip()[:80] for x in parse_json_list(raw) if str(x).strip()][:8]


@bp.post('/stores/reviews')
@login_required
def write_review():
    """Body: {store_id} for an existing store, or {store_name, area} to find-or-create one,
    plus rating (1–5, halves allowed), body, pros[], cons[]."""
    me = current_user()
    data = request.get_json(silent=True) or {}
    try:
        rating = round(float(data.get('rating')) * 2) / 2
    except (TypeError, ValueError):
        rating = 0
    if not 1 <= rating <= 5:
        return jsonify({'error': 'יש לבחור דירוג בין 1 ל-5'}), 400
    body = (data.get('body') or '').strip()[:3000]
    pros, cons = _clean_lines(data.get('pros')), _clean_lines(data.get('cons'))

    store_id = data.get('store_id')
    if store_id is not None:
        if query('SELECT id FROM stores WHERE id = %s', (store_id,), one=True) is None:
            return jsonify({'error': 'החנות לא נמצאה'}), 404
    else:
        name = (data.get('store_name') or '').strip()
        area = (data.get('area') or '').strip()[:120]
        if not name or len(name) > 120:
            return jsonify({'error': 'יש להזין את שם החנות'}), 400
        existing = query('SELECT id FROM stores WHERE name = %s AND area = %s', (name, area), one=True)
        if existing:
            store_id = existing['id']
        else:
            store_id, _ = execute('INSERT INTO stores (name, area, cover, created_by) VALUES (%s, %s, %s, %s)',
                                  (name, area, COVERS[len(name) % len(COVERS)], me['id']))

    execute("""INSERT INTO store_reviews (store_id, author_id, rating, body, pros, cons)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE rating = VALUES(rating), body = VALUES(body), pros = VALUES(pros),
                                       cons = VALUES(cons), created_at = UTC_TIMESTAMP()""",
            (store_id, me['id'], rating, body or None,
             json.dumps(pros, ensure_ascii=False), json.dumps(cons, ensure_ascii=False)))
    commit()
    row = query(f"""SELECT r.*, {user_brief_sql('u', 'a_')} FROM store_reviews r JOIN users u ON u.id = r.author_id
                    WHERE r.store_id = %s AND r.author_id = %s""", (store_id, me['id']), one=True)
    return jsonify({'store_id': store_id, 'review': _review(row)}), 201


@bp.delete('/stores/reviews/<int:review_id>')
@login_required
def delete_review(review_id):
    """Delete a store review (its author or a moderator)."""
    row = query('SELECT author_id FROM store_reviews WHERE id = %s', (review_id,), one=True)
    if row is None:
        return jsonify({'error': 'הביקורת לא נמצאה'}), 404
    me = current_user()
    if row['author_id'] != me['id'] and not is_moderator(me):
        return jsonify({'error': 'אין הרשאה'}), 403
    execute('DELETE FROM store_reviews WHERE id = %s', (review_id,))
    commit()
    return jsonify({'ok': True})
