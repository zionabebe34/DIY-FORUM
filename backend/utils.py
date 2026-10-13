"""Shared helpers: JSON serializers, HTML sanitizing, image uploads, validation."""
import json
import os
import re
import uuid

import nh3
from flask import current_app

# ── Validation ──────────────────────────────────────────────────────────────
USERNAME_RE = re.compile(r'^[A-Za-z0-9_.]{3,30}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
COVERS = {'ph-wood', 'ph-steel', 'ph-clay', 'ph-leaf', 'ph-paper', 'ph-night'}


def iso(dt):
    """DB datetimes are naive UTC — expose them as ISO-8601 with a Z suffix."""
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None


def parse_json_list(raw, default=None):
    if raw is None or raw == '':
        return default if default is not None else []
    if isinstance(raw, list):
        return raw
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return default if default is not None else []
    return value if isinstance(value, list) else (default if default is not None else [])


# ── Rich text ───────────────────────────────────────────────────────────────
ALLOWED_TAGS = {'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'a', 'ul', 'ol', 'li'}


def sanitize_html(html):
    """Keep only the formatting the WYSIWYG editor produces; drop scripts/handlers."""
    return nh3.clean(
        html or '',
        tags=ALLOWED_TAGS,
        attributes={'a': {'href'}},
        url_schemes={'http', 'https', 'mailto'},
        link_rel='noopener noreferrer nofollow',
        set_tag_attribute_values={'a': {'target': '_blank'}},
    ).strip()


def html_to_text(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html or '')).strip()


# ── Image uploads ───────────────────────────────────────────────────────────
MAX_IMAGE_BYTES = 5 * 1024 * 1024
_SIGNATURES = {
    b'\xff\xd8\xff': 'jpg',
    b'\x89PNG\r\n\x1a\n': 'png',
    b'GIF87a': 'gif',
    b'GIF89a': 'gif',
}


def _sniff_image(head):
    for sig, ext in _SIGNATURES.items():
        if head.startswith(sig):
            return ext
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp'
    return None


class UploadError(ValueError):
    pass


def save_image(file_storage):
    """Validate an uploaded image by its magic bytes and save it. Returns its URL."""
    data = file_storage.read()
    if not data:
        raise UploadError('קובץ ריק')
    if len(data) > MAX_IMAGE_BYTES:
        raise UploadError('תמונה גדולה מ-5MB')
    ext = _sniff_image(data[:16])
    if ext is None:
        raise UploadError('ניתן להעלות רק תמונות JPG / PNG / GIF / WEBP')
    name = f'{uuid.uuid4().hex}.{ext}'
    with open(os.path.join(current_app.config['UPLOAD_DIR'], name), 'wb') as f:
        f.write(data)
    return f'/uploads/{name}'


# ── Serializers ─────────────────────────────────────────────────────────────
def public_user(row, extra=None):
    """Fields of a user that anyone may see."""
    if row is None:
        return None
    skills = row.get('skills')
    if isinstance(skills, (str, bytes)):
        skills = parse_json_list(skills)
    data = {
        'id': row['id'],
        'username': row['username'],
        'name': row['name'],
        'bio': row.get('bio') or '',
        'avatar_url': row.get('avatar_url'),
        'cover': row.get('cover') or 'ph-night',
        'location': row.get('location') or '',
        'skills': skills or [],
        'verified': bool(row.get('verified')),
        'is_agent': bool(row.get('is_agent')),
        'role': row.get('role') or 'user',
        'is_banned': bool(row.get('is_banned')),
        'created_at': iso(row.get('created_at')),
    }
    if extra:
        data.update(extra)
    return data


def private_user(row):
    """The logged-in user's own view of themselves (adds email)."""
    data = public_user(row)
    data['email'] = row['email']
    return data
