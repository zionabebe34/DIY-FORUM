"""Writing assistant (part 2 c) and the daily AI budget — against the fake AI service from test_agents."""
import random

import ai
import agents
from routes.assist_routes import apply_fixes, rule_fixes
from seed import seed_agents
from tests.conftest import TEST_DB
from tests.test_agents import fake_ai, rows, run  # noqa: F401  (fixture + helpers)


def post_of(c, body='<p>מדף מאלון</p>'):
    return c.post('/api/posts', data={'body': body}, content_type='multipart/form-data').get_json()['post']['id']


# ── Auto-correct ────────────────────────────────────────────────────────────
def test_rule_fixes_and_apply():
    assert rule_fixes('תודה לכולמ, 4 סמ, צה״ל, סמל') == [('לכולמ', 'לכולם'), ('סמ', 'ס״מ')]
    html = '<p>תודה לכולמ ,והוא יצא יפה.אני <a href="https://a.co/x.y">כאנ</a> בעובי 2.5 סמ</p>'
    text = 'תודה לכולמ ,והוא יצא יפה.אני כאנ בעובי 2.5 סמ'
    fixes = [{'wrong': 'כאנ', 'right': 'כאן'},          # fine (also a rule)
             {'wrong': 'יפה', 'right': 'יפה.'},          # pure addition → rejected
             {'wrong': 'אני', 'right': 'אתה'},           # a different word → rejected
             {'wrong': 'לכול', 'right': 'כולם'},         # part of a word → rejected
             {'wrong': 'יצא יפה', 'right': 'יצא'},       # drops a word → rejected
             {'wrong': 'בעובי', 'right': '<b>x</b>'},    # HTML → rejected
             'junk']
    out, changes = apply_fixes(html, text, fixes)
    assert out == '<p>תודה לכולם, והוא יצא יפה. אני <a href="https://a.co/x.y">כאן</a> בעובי 2.5 ס״מ</p>'
    assert changes == ['כאנ ← כאן', 'לכולמ ← לכולם', 'סמ ← ס״מ', 'ריווח סביב סימני פיסוק']


def test_correct_endpoint(app, fake_ai, make_user, client):
    alice = make_user('alice')
    assert client.post('/api/ai/correct', json={'html': 'x'}).status_code == 401
    assert alice.post('/api/ai/correct', json={'html': '<p> </p>'}).status_code == 400
    assert alice.post('/api/ai/correct', json={'html': 'א' * 5001}).status_code == 400

    fake_ai.answers['proofreader'] = '{"fixes": [{"wrong": "מדפ", "right": "מדף"}, {"wrong": "שולחן", "right": "כיסא"}]}'
    r = alice.post('/api/ai/correct', json={'html': '<p>בניתי <b>מדפ</b> ושולחן</p><script>x</script>'}).get_json()
    assert r == {'html': '<p>בניתי <b>מדף</b> ושולחן</p>', 'changes': ['מדפ ← מדף'], 'changed': True, 'ai': True}

    fake_ai.answers['proofreader'] = '{"fixes": []}'
    assert alice.post('/api/ai/correct', json={'html': '<p>הכל תקין</p>'}).get_json()['changed'] is False

    # model down: the rule-based fixes still come back; with nothing to fix → 503
    fake_ai.answers['proofreader'] = ai.AIUnavailable('down')
    r = alice.post('/api/ai/correct', json={'html': '<p>תודה לכולמ</p>'})
    assert r.status_code == 200 and r.get_json()['ai'] is False and r.get_json()['changes'] == ['לכולמ ← לכולם']
    assert alice.post('/api/ai/correct', json={'html': '<p>הכל תקין</p>'}).status_code == 503
    fake_ai.answers['proofreader'] = '{"nope": 1}'
    assert alice.post('/api/ai/correct', json={'html': '<p>הכל תקין</p>'}).status_code == 503
    assert app.test_client().get('/api/ai/status').get_json() == {'enabled': True}


def test_hourly_quota(app, fake_ai, make_user):
    alice = make_user('alice')
    app.config['AI_ASSIST_PER_HOUR'] = 1
    fake_ai.answers['proofreader'] = '{"fixes": []}'
    assert alice.post('/api/ai/correct', json={'html': '<p>שלום</p>'}).status_code == 200
    r = alice.post('/api/ai/correct', json={'html': '<p>שלום</p>'})
    assert r.status_code == 429 and 'מכסת' in r.get_json()['error']


# ── Suggested posts / comments ──────────────────────────────────────────────
def test_suggest_post(app, fake_ai, make_user):
    alice = make_user('alice')
    post_of(alice, '<p>הפוסט הקודם שלי על מדפים</p>')
    fake_ai.answers['start a new post'] = ('{"suggestions": [{"body": "סיימתי [שם הפרויקט] מ[סוג העץ]! מה דעתכם על הגימור?", '
                                          '"tags": ["#נגרות", "גינה ביתית"]}, {"body": "קצר"}, "x", '
                                          '{"body": "שאלה לקהילה: איך מתחילים לעבוד עם [החומר] בלי ניסיון?", "tags": []}]}')
    r = alice.post('/api/ai/suggest-post', json={'topic': 'שולחן לגינה'}).get_json()
    assert r['suggestions'][0] == {'body': 'סיימתי [שם הפרויקט] מ[סוג העץ]! מה דעתכם על הגימור?', 'tags': ['נגרות', 'גינה_ביתית']}
    assert len(r['suggestions']) == 1      # only the first 3 items are read; the short / malformed ones are dropped
    prompt = fake_ai.prompts[-2]
    assert 'שולחן לגינה' in prompt and 'הפוסט הקודם שלי' in prompt

    fake_ai.answers['content moderator'] = '{"level": "warn", "category": "harassment", "reason": "x"}'
    import toxicity
    toxicity._cache.clear()
    assert alice.post('/api/ai/suggest-post', json={}).status_code == 503        # suggestions must pass toxicity
    fake_ai.answers['start a new post'] = 'no'
    assert alice.post('/api/ai/suggest-post', json={}).status_code == 503


def test_suggest_comments(app, fake_ai, make_user):
    alice = make_user('alice')
    bob = make_user('bob')
    pid = post_of(alice)
    top = bob.post(f'/api/posts/{pid}/comments', json={'body': 'איזה עץ זה?'}).get_json()['comment']
    assert bob.post('/api/ai/suggest-comments', json={'post_id': 9999}).status_code == 404

    fake_ai.answers['reply in a discussion'] = ('{"suggestions": ["Test User: איזה גימור השתמשת?", "נראה יציב מאוד!", '
                                               '"x", "טיפ: כדאי לשייף לפני השמן"]}')
    r = alice.post('/api/ai/suggest-comments', json={'post_id': pid, 'parent_id': top['id']}).get_json()
    assert r == {'suggestions': ['איזה גימור השתמשת?', 'נראה יציב מאוד!', 'טיפ: כדאי לשייף לפני השמן']}
    prompt = fake_ai.prompts[-2]
    assert 'איזה עץ זה?' in prompt and 'they are replying to' in prompt and 'מדף מאלון' in prompt

    fake_ai.answers['reply in a discussion'] = ai.AIUnavailable('HTTP 500')
    assert alice.post('/api/ai/suggest-comments', json={'post_id': pid}).status_code == 503


def test_retry_after_a_bad_answer(app, fake_ai, make_user, monkeypatch):
    alice = make_user('alice')
    pid = post_of(alice)
    answers = iter(['{"suggestions": ["broken', ai.AIUnavailable('HTTP 429'), '{"suggestions": ["סבבה, איך זה מחזיק?"]}'])

    def flaky(prompt, timeout):
        if 'content moderator' in prompt:
            return '{"level": "ok", "category": "none", "reason": ""}'
        a = next(answers)
        if isinstance(a, Exception):
            raise a
        return a
    monkeypatch.setattr(ai, '_post', flaky)
    monkeypatch.setattr(ai, 'RATE_LIMIT_PAUSE', 0)
    # first call: broken JSON, then a 429 → two attempts used up → 503
    assert alice.post('/api/ai/suggest-comments', json={'post_id': pid}).status_code == 503
    assert alice.post('/api/ai/suggest-comments', json={'post_id': pid}).get_json() == {'suggestions': ['סבבה, איך זה מחזיק?']}


# ── Daily budget ────────────────────────────────────────────────────────────
def test_daily_budget_keeps_a_reserve_for_people(app, fake_ai, make_user):
    seed_agents(TEST_DB)
    alice = make_user('alice')
    post_of(alice)
    app.config.update(AI_DAILY_BUDGET=4, AI_AGENT_SHARE=0.5)
    with app.app_context():
        by = {a['username']: a for a in agents.active_agents()}
    assert 'post: done' in run(app, agents.write_post, by['noa_newbie'], random.Random(0))      # 2 agent calls
    assert run(app, lambda a_: agents.tick(a_, force=True)) == \
        ["today's AI budget for agents is used up — they rest until midnight UTC"]
    fake_ai.answers['proofreader'] = '{"fixes": []}'
    assert alice.post('/api/ai/correct', json={'html': '<p>שלום</p>'}).status_code == 200       # 3rd call: a person
    assert alice.post('/api/ai/correct', json={'html': '<p>שלום</p>'}).status_code == 200       # 4th
    assert alice.post('/api/ai/correct', json={'html': '<p>שלום</p>'}).status_code == 503       # budget reached
    with app.app_context():
        assert ai.calls_today() == 4 and ai.calls_today(agents_only=True) == 2
    assert [r['feature'] for r in rows(app, 'SELECT feature FROM ai_calls ORDER BY id')] == \
        ['agent_post', 'agent_toxicity', 'assist_correct', 'assist_correct']


def test_exhausted_daily_quota_is_remembered(app, make_user, monkeypatch):
    """The course service says "Limit Exceeded" → no more calls until midnight UTC, and a clear message."""
    import io
    import urllib.error
    app.config.update(AI_PROVIDER='course_api', AI_API_URL='https://ai.example.test/suggest', AI_API_KEY='k')
    monkeypatch.setattr(ai, '_quota_reset_at', None)
    calls = []

    def urlopen(req, timeout, context):
        calls.append(1)
        raise urllib.error.HTTPError('u', 429, 'Too Many', {}, io.BytesIO(b'{"message":"Limit Exceeded"}'))
    monkeypatch.setattr(ai.urllib.request, 'urlopen', urlopen)

    alice = make_user('alice')
    pid = post_of(alice)
    r = alice.post('/api/ai/suggest-comments', json={'post_id': pid})
    assert r.status_code == 503 and 'המכסה היומית' in r.get_json()['error'] and '(שעון ישראל)' in r.get_json()['error']
    assert len(calls) == 1                     # no retry once the quota is known to be gone
    alice.post('/api/ai/suggest-comments', json={'post_id': pid})
    assert len(calls) == 1                     # remembered: the service isn't called again today
    with app.app_context():
        assert ai.quota_exhausted() and ai.calls_today() == 0
    # the rule-based corrections still work
    assert alice.post('/api/ai/correct', json={'html': '<p>תודה לכולמ</p>'}).get_json()['changes'] == ['לכולמ ← לכולם']
    seed_agents(TEST_DB)
    assert run(app, lambda a_: agents.tick(a_, force=True)) == \
        ['the AI service quota is used up for today — the agents rest until it resets']

    # a plain 429 (a short rate limit) isn't mistaken for the daily quota
    monkeypatch.setattr(ai, '_quota_reset_at', None)
    monkeypatch.setattr(ai, 'RATE_LIMIT_PAUSE', 0)
    monkeypatch.setattr(ai.urllib.request, 'urlopen', lambda *a, **k: (_ for _ in ()).throw(
        urllib.error.HTTPError('u', 429, 'Too Many', {}, io.BytesIO(b'{"message":"Too Many Requests"}'))))
    assert alice.post('/api/ai/suggest-comments', json={'post_id': pid}).get_json()['error'].startswith('העוזר החכם')
    with app.app_context():
        assert not ai.quota_exhausted()
