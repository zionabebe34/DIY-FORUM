"""Writing assistance (part 2 c): auto-correct a post, suggest a post, suggest comments.

A person always decides: corrections are shown before/after and applied only on "replace";
suggestions are drafts the user edits. If the model is off / fails / answers junk → 503 and the
UI just says the assistant isn't available. Generated suggestions pass the toxicity check
(fail-closed); every call is logged in `ai_calls` and counts toward a per-user hourly quota.
"""
import difflib
import re

from flask import Blueprint, current_app, jsonify, request

import ai
import toxicity
from auth import current_user, login_required
from db import query
from utils import html_to_text, parse_json_list, sanitize_html

bp = Blueprint('assist', __name__, url_prefix='/api/ai')

MAX_CORRECT_CHARS = 5000
UNAVAILABLE = 'העוזר החכם לא זמין כרגע — נסו שוב בעוד רגע.'


def _quota_error(user_id):
    """A 429 response when the user used up their writing-assistant calls for this hour, else None."""
    used = query("""SELECT COUNT(*) AS n FROM ai_calls WHERE user_id = %s AND feature LIKE 'assist_%%'
                    AND created_at >= UTC_TIMESTAMP() - INTERVAL 1 HOUR""", (user_id,), one=True)['n']
    if used >= current_app.config['AI_ASSIST_PER_HOUR']:
        return jsonify({'error': 'הגעתם למכסת העוזר החכם לשעה הקרובה. נסו שוב מאוחר יותר.'}), 429
    return None


def _unavailable():
    """A 503 response: the AI is unavailable (or the daily-quota message)."""
    return jsonify({'error': ai.quota_message() if ai.quota_exhausted() else UNAVAILABLE}), 503


def _writer(me):
    """One line about the user (name, skills) so the suggestions fit their voice."""
    skills = ', '.join(parse_json_list(me.get('skills'))) or 'general DIY'
    return f"The user is {me['name']} (@{me['username']}), a member of HandyHub. Their skills: {skills}."


def _safe(texts, user_id):
    """All generated suggestions together must pass the toxicity check (fail-closed)."""
    verdict = toxicity.check('\n'.join(texts), user_id)
    return verdict['source'] != 'none' and verdict['level'] == 'ok'


@bp.get('/status')
def status():
    """Lets the UI hide the ✨ buttons when no AI is configured."""
    return jsonify({'enabled': ai.enabled()})


# ── Auto-correct ────────────────────────────────────────────────────────────
CORRECT_INSTRUCTIONS = """You are a careful Hebrew (and English) proofreader for HandyHub, a DIY community.
Find the real mistakes in the post in <user_content>: spelling, typos, a regular letter where a Hebrew final
letter is needed at the end of a word, missing gershayim in abbreviations, wrong punctuation.
Do not list style changes, rephrasing, or changes to slang, emoji or gendered forms.
For each mistake give the exact wrong text as it appears in the post (copy it exactly, 1–4 words) and
the corrected text. If there are no mistakes, return an empty list."""

MAX_FIXES = 15
_TAG = re.compile(r'(<[^>]+>)')


def _word(w):
    """Regex for `w` as whole word(s) — never inside a longer word."""
    return re.compile(r'(?<!\w)' + re.escape(w) + r'(?!\w)')


def _good_fix(wrong, right, text):
    """A real proofreading fix: same words, each one only slightly changed (not a rewrite, not an addition)."""
    if (not wrong.strip() or not right.strip() or wrong == right or len(wrong) > 60 or len(right) > 80
            or '<' in right or '>' in right or not _word(wrong).search(text)):
        return False
    w_words, r_words = wrong.split(), right.split()
    if len(w_words) != len(r_words) or right.startswith(wrong) or right.endswith(wrong):
        return False
    return all(a == b or difflib.SequenceMatcher(None, a, b).ratio() >= 0.6 for a, b in zip(w_words, r_words))


# ── Rule-based fixes (always on, no model needed) ──
_FINAL = str.maketrans('כמנפצ', 'ךםןףץ')
_ABBREVIATIONS = {'סמ': 'ס״מ', 'ממ': 'מ״מ', 'קג': 'ק״ג', 'וכו': 'וכו׳'}
_HEB_WORD = re.compile(r'(?<![\w"״׳\'])[א-ת]+(?![\w"״׳\'])')


def rule_fixes(text):
    """Deterministic Hebrew fixes → [(wrong, right)]: a regular letter where a final letter belongs
    (כולמ → כולם), common abbreviations without gershayim (סמ → ס״מ)."""
    pairs = []
    for word in dict.fromkeys(_HEB_WORD.findall(text)):
        if word in _ABBREVIATIONS:
            right = _ABBREVIATIONS[word]
        elif len(word) >= 2 and word[-1] in 'כמנפצ':
            right = word[:-1] + word[-1].translate(_FINAL)
        else:
            continue
        if right != word:
            pairs.append((word, right))
    return pairs


_SPACING = [   # (pattern, replacement) — applied to the text between tags
    (re.compile(r'[ \t]+([,.!?:;])'), r'\1'),                    # "שולחן ," → "שולחן,"
    (re.compile(r'([,!?:;]|(?<!\d)\.)(?=[א-תA-Za-z])'), r'\1 '),  # "יפה.אני" → "יפה. אני" (not 4.5)
    (re.compile(r'[ \t]{2,}'), ' '),
]


def apply_fixes(html, text, fixes):
    """Apply proofreading fixes to the text between the HTML tags only (the formatting can't break).
    The model's list is untrusted: a fix is used only if `_good_fix` accepts it."""
    good = []
    for f in fixes[:MAX_FIXES]:
        if isinstance(f, dict):
            wrong, right = str(f.get('wrong') or ''), str(f.get('right') or '')
            if _good_fix(wrong, right, text) and (wrong, right) not in good:
                good.append((wrong, right))
    for pair in rule_fixes(text):
        if pair not in good and not any(pair[0] in w for w, _ in good):
            good.append(pair)
    spacing = False
    parts = _TAG.split(html)
    for i, part in enumerate(parts):
        if part and not part.startswith('<'):
            for wrong, right in good:
                part = _word(wrong).sub(right, part)
            for pattern, repl in _SPACING:
                new = pattern.sub(repl, part)
                spacing = spacing or new != part
                part = new
            parts[i] = part
    changes = [f'{w} ← {r}' for w, r in good] + (['ריווח סביב סימני פיסוק'] if spacing else [])
    return ''.join(parts), changes


@bp.post('/correct')
@login_required
def correct():
    """Proofread a post's HTML: rule-based Hebrew fixes + the model's fixes, formatting kept."""
    me = current_user()
    html = sanitize_html((request.get_json(silent=True) or {}).get('html', ''))
    text = html_to_text(html)
    if not text:
        return jsonify({'error': 'אין טקסט לתקן'}), 400
    if len(text) > MAX_CORRECT_CHARS:
        return jsonify({'error': f'הטקסט ארוך מדי לתיקון אוטומטי (עד {MAX_CORRECT_CHARS} תווים)'}), 400
    limited = _quota_error(me['id'])
    if limited:
        return limited

    def validate(obj):
        fixes = obj.get('fixes')
        return {'fixes': fixes} if isinstance(fixes, list) else None

    result = ai.generate_json('assist_correct', CORRECT_INSTRUCTIONS, {'the post': text},
                              '{"fixes": [{"wrong": "exact text from the post", "right": "corrected text"}]}',
                              validate, timeout=20.0, user_id=me['id'], retries=1)
    # The rule-based fixes work even when the model doesn't; the model's fixes come on top when available
    fixed, changes = apply_fixes(html, text, result['fixes'] if result else [])
    if result is None and not changes:
        return _unavailable()
    return jsonify({'html': sanitize_html(fixed), 'changes': changes, 'changed': bool(changes), 'ai': result is not None})


# ── Suggested posts ─────────────────────────────────────────────────────────
POST_INSTRUCTIONS = """You help a member of HandyHub, a Hebrew-speaking DIY / makers community, start a new post.
Write 3 different short drafts (2–4 sentences each) in natural, everyday Hebrew, in the first person:
one about a project they made, one question to the community, one practical tip.
You know nothing about what they actually built — NEVER invent specific materials, sizes, tools, places or
results. Put every such detail in a short placeholder in square brackets for them to fill in.
Example of a good draft: "סיימתי סוף סוף [שם הפרויקט] מ[סוג העץ]! הכי מאתגר היה [החלק הקשה]. יש למישהו טיפ
איך [שאלה]?" Every project / tip draft must have at least two placeholders. Keep it realistic — only things a
hobbyist would really say. Add 1–3 short Hebrew tags to each draft (no '#')."""


@bp.post('/suggest-post')
@login_required
def suggest_post():
    """3 AI draft posts (project / question / tip) with [placeholders] and tags."""
    me = current_user()
    topic = str((request.get_json(silent=True) or {}).get('topic') or '').strip()[:120]
    limited = _quota_error(me['id'])
    if limited:
        return limited
    recent = [html_to_text(r['body_html'])[:150] for r in query(
        'SELECT body_html FROM posts WHERE author_id = %s ORDER BY id DESC LIMIT 5', (me['id'],))]

    def validate(obj):
        out = []
        for s in (obj.get('suggestions') or [])[:3]:
            if not isinstance(s, dict):
                continue
            body = str(s.get('body') or '').strip()
            if not 30 <= len(body) <= 700:
                continue
            tags = [str(t).strip().lstrip('#').replace(' ', '_')[:30] for t in (s.get('tags') or []) if str(t).strip()][:3]
            out.append({'body': body, 'tags': tags})
        return out or None

    data = {'what they want to write about (may be empty)': topic,
            'their recent posts (suggest something different)': '\n'.join(f'- {t}' for t in recent)}
    result = ai.generate_json('assist_post', f'{POST_INSTRUCTIONS}\n\n{_writer(me)}', data,
                              '{"suggestions": [{"body": "draft in Hebrew", "tags": ["tag"]}, ...3 items]}',
                              validate, timeout=20.0, user_id=me['id'], retries=1)
    if result is None or not _safe([s['body'] for s in result], me['id']):
        return _unavailable()
    return jsonify({'suggestions': result})


# ── Suggested comments ──────────────────────────────────────────────────────
COMMENT_INSTRUCTIONS = """You help a member of HandyHub, a Hebrew-speaking DIY / makers community, reply in a discussion.
Suggest 3 different short comments (one sentence each, up to ~25 words) in natural everyday Hebrew that
THIS person would write, addressed to the author of the post (or to the person they are replying to) —
never to themselves:
1. a specific question about the work, 2. a specific compliment, 3. a helpful tip or their own experience.
Base them on what was actually written — no generic "nice!". Be kind; never invent facts.
Return only the comment text itself — don't start with a name or "Name:"."""


@bp.post('/suggest-comments')
@login_required
def suggest_comments():
    """3 AI comment suggestions for a post or a reply, based on the thread."""
    me = current_user()
    data = request.get_json(silent=True) or {}
    post = query("""SELECT p.id, p.title, p.body_html, u.name FROM posts p JOIN users u ON u.id = p.author_id
                    WHERE p.id = %s AND u.is_banned = FALSE""", (data.get('post_id'),), one=True)
    if post is None:
        return jsonify({'error': 'הפוסט לא נמצא'}), 404
    limited = _quota_error(me['id'])
    if limited:
        return limited
    thread_where, params = 'c.post_id = %s', [post['id']]
    reply_to = ''
    if data.get('parent_id'):
        parent = query("""SELECT c.id, c.parent_id, c.body, u.name FROM comments c JOIN users u ON u.id = c.author_id
                          WHERE c.id = %s AND c.post_id = %s""", (data['parent_id'], post['id']), one=True)
        if parent is not None:
            top = parent['parent_id'] or parent['id']
            thread_where, params = 'c.post_id = %s AND (c.id = %s OR c.parent_id = %s)', [post['id'], top, top]
            reply_to = f"{parent['name']}: {parent['body'][:300]}"
    rows = query(f"""SELECT c.body, u.name FROM comments c JOIN users u ON u.id = c.author_id
                     WHERE {thread_where} AND u.is_banned = FALSE ORDER BY c.id DESC LIMIT 6""", params)

    # the model sometimes starts with the user's own name ("Name: …") — drop exactly that, nothing else
    own_name = re.compile(r'^(?:' + re.escape(me['name']) + '|@?' + re.escape(me['username']) + r')\s*:\s*')

    def validate(obj):
        out = [own_name.sub('', s.strip()) for s in (obj.get('suggestions') or []) if isinstance(s, str)]
        out = [s for s in out if 3 <= len(s) <= 220][:3]
        return out or None

    blocks = {'the post': f"{post['name']} wrote: " + ' — '.join(t for t in (post['title'], html_to_text(post['body_html'])) if t)[:1500],
              'comments so far (oldest first)': '\n'.join(f"{r['name']}: {r['body'][:300]}" for r in rows[::-1]),
              'they are replying to': reply_to}
    result = ai.generate_json('assist_comments', f'{COMMENT_INSTRUCTIONS}\n\n{_writer(me)}', blocks,
                              '{"suggestions": ["comment 1", "comment 2", "comment 3"]}', validate,
                              timeout=15.0, user_id=me['id'], retries=1)
    if result is None or not _safe(result, me['id']):
        return _unavailable()
    return jsonify({'suggestions': result})
