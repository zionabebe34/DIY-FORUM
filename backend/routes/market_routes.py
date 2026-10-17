"""Marketplace: tools for sale or lending, posted by users."""
from flask import Blueprint, jsonify, request

from auth import current_user, is_moderator, login_required
from db import commit, execute, query
from utils import UploadError, iso, save_image, user_brief, user_brief_sql

bp = Blueprint('market', __name__, url_prefix='/api')

TYPES = ('sale', 'lend')
CATEGORIES = ('hand', 'power', 'machines', 'other')
COVERS = ('ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night')
PAGE = 12
MAX_PRICE = 1_000_000

_SELECT = f"""
    SELECT l.*, {user_brief_sql('u', 's_')}
    FROM listings l JOIN users u ON u.id = l.seller_id
"""


def serialize(r):
    """Listing row → API dict (prices, status, seller)."""
    return {
        'id': r['id'], 'listing_type': r['listing_type'], 'title': r['title'], 'description': r['description'] or '',
        'category': r['category'], 'condition': r['condition_text'], 'price': r['price'],
        'daily_price': r['daily_price'], 'weekly_price': r['weekly_price'], 'deposit': r['deposit'],
        'image_url': r['image_url'], 'cover': r['cover'], 'status': r['status'], 'created_at': iso(r['created_at']),
        'seller': user_brief(r, 's_'),
    }


def get_listing(listing_id):
    """One listing row with its seller columns, or None."""
    return query(f'{_SELECT} WHERE l.id = %s', (listing_id,), one=True)


@bp.get('/listings')
def list_listings():
    """Active listings, newest first. Filters: type, category, seller (username). Keyset paging with ?before."""
    where, params = ["l.status = 'active'", 'u.is_banned = FALSE'], []
    category = request.args.get('category')
    if category in CATEGORIES:
        where.append('l.category = %s')
        params.append(category)
    seller = request.args.get('seller')
    if seller:
        where.append('u.username = %s')
        params.append(seller)
    base_where, base_params = list(where), list(params)       # counts per type ignore the type filter

    listing_type = request.args.get('type')
    if listing_type in TYPES:
        where.append('l.listing_type = %s')
        params.append(listing_type)
    before = request.args.get('before', type=int)
    if before:
        where.append('l.id < %s')
        params.append(before)
    limit = min(max(request.args.get('limit', PAGE, type=int), 1), 50)

    rows = query(f"{_SELECT} WHERE {' AND '.join(where)} ORDER BY l.id DESC LIMIT %s", (*params, limit + 1))
    has_more = len(rows) > limit
    rows = rows[:limit]
    me, saved = current_user(), set()
    if me and rows:
        marks = ', '.join(['%s'] * len(rows))
        saved = {r['listing_id'] for r in query(
            f'SELECT listing_id FROM saved_listings WHERE user_id = %s AND listing_id IN ({marks})',
            (me['id'], *[r['id'] for r in rows]))}
    counts = query(f"""SELECT COUNT(*) AS all_count, COALESCE(SUM(l.listing_type = 'sale'), 0) AS sale,
                              COALESCE(SUM(l.listing_type = 'lend'), 0) AS lend
                       FROM listings l JOIN users u ON u.id = l.seller_id WHERE {' AND '.join(base_where)}""",
                   base_params, one=True)
    return jsonify({
        'items': [{**serialize(r), 'saved_by_me': r['id'] in saved} for r in rows],
        'next_cursor': rows[-1]['id'] if has_more else None,
        'counts': {'all': int(counts['all_count']), 'sale': int(counts['sale']), 'lend': int(counts['lend'])},
    })


def _price(form, field, required):
    """A price field from the form as a whole number (ValueError with a Hebrew message if invalid)."""
    raw = (form.get(field) or '').strip()
    if not raw:
        if required:
            raise ValueError('יש להזין מחיר')
        return None
    try:
        value = int(float(raw))
    except ValueError:
        raise ValueError('מחיר לא תקין') from None
    if value < 0 or value > MAX_PRICE or (required and value == 0):
        raise ValueError('מחיר לא תקין')
    return value


@bp.post('/listings')
@login_required
def create_listing():
    """Publish a marketplace listing (sale or rent) with an optional photo."""
    form = request.form
    listing_type = form.get('listing_type')
    if listing_type not in TYPES:
        return jsonify({'error': 'סוג מודעה לא תקין'}), 400
    title = (form.get('title') or '').strip()
    if not title or len(title) > 120:
        return jsonify({'error': 'יש להזין שם לכלי (עד 120 תווים)'}), 400
    condition = (form.get('condition') or '').strip()[:80] or 'יד שנייה'
    category = form.get('category') if form.get('category') in CATEGORIES else 'other'
    description = (form.get('description') or '').strip()[:2000] or None
    try:
        if listing_type == 'sale':
            prices = {'price': _price(form, 'price', True)}
        else:
            daily = _price(form, 'daily_price', True)
            prices = {'daily_price': daily,
                      'weekly_price': _price(form, 'weekly_price', False) or daily * 5,
                      'deposit': _price(form, 'deposit', False) or 0}
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    image_url = None
    if request.files.get('image') and request.files['image'].filename:
        try:
            image_url = save_image(request.files['image'])
        except UploadError as e:
            return jsonify({'error': str(e)}), 400

    me = current_user()
    cover = COVERS[(me['id'] + len(title)) % len(COVERS)]
    listing_id, _ = execute(
        """INSERT INTO listings (seller_id, listing_type, title, description, category, condition_text,
                                 price, daily_price, weekly_price, deposit, image_url, cover)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (me['id'], listing_type, title, description, category, condition, prices.get('price'),
         prices.get('daily_price'), prices.get('weekly_price'), prices.get('deposit'), image_url, cover))
    commit()
    return jsonify({'listing': serialize(get_listing(listing_id))}), 201


@bp.delete('/listings/<int:listing_id>')
@login_required
def delete_listing(listing_id):
    """Delete a listing (its seller or a moderator)."""
    row = query('SELECT seller_id FROM listings WHERE id = %s', (listing_id,), one=True)
    if row is None:
        return jsonify({'error': 'המודעה לא נמצאה'}), 404
    me = current_user()
    if row['seller_id'] != me['id'] and not is_moderator(me):
        return jsonify({'error': 'אפשר למחוק רק מודעות שלך'}), 403
    execute('DELETE FROM listings WHERE id = %s', (listing_id,))
    commit()
    return jsonify({'ok': True})
