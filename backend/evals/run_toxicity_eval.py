"""Measure the toxicity check on a fixed, labeled set (evals/toxicity_cases.json).

    cd backend && .venv/bin/python evals/run_toxicity_eval.py

Calls the real AI service once per case (~20 calls). Prints each case and the numbers that matter,
and saves the run to evals/results/ so a prompt change can be compared before / after:
  - accuracy:        the exact level (ok / warn / block) matched the label
  - harmful caught:  of the cases labeled warn/block, how many were flagged (not "ok")   ← recall
  - false alarms:    of the cases labeled ok, how many were flagged                      ← false-positive rate
  - unavailable:     the model could not answer (counted as "ok": the check fails open)
"""
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
import toxicity  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    """Run the toxicity check on every labeled case; print the accuracy and save a JSON report in results/."""
    with open(os.path.join(HERE, 'toxicity_cases.json'), encoding='utf-8') as f:
        cases = json.load(f)
    app = create_app()
    results = []
    with app.app_context():
        if app.config['AI_PROVIDER'] == 'off':
            sys.exit('AI is off (AI_PROVIDER=off) — nothing to measure.')
        toxicity._cache.clear()
        for case in cases:
            v = toxicity.check(case['text'])
            ok = v['level'] == case['expected']
            results.append({**case, 'got': v['level'], 'category': v['category'], 'source': v['source'],
                            'reason': v['reason'], 'correct': ok})
            mark = '✓' if ok else '✗'
            print(f"{mark} {case['id']:<18} expected {case['expected']:<5} got {v['level']:<5} "
                  f"[{v['source']}] {v['reason'][:60]}")

    harmful = [r for r in results if r['expected'] != 'ok']
    clean = [r for r in results if r['expected'] == 'ok']
    summary = {
        'cases': len(results),
        'accuracy': round(sum(r['correct'] for r in results) / len(results), 3),
        'harmful_caught': round(sum(r['got'] != 'ok' for r in harmful) / len(harmful), 3),
        'false_alarms': round(sum(r['got'] != 'ok' for r in clean) / len(clean), 3),
        'unavailable': sum(r['source'] == 'none' for r in results),
    }
    print('\n' + '  '.join(f'{k}: {v}' for k, v in summary.items()))

    os.makedirs(os.path.join(HERE, 'results'), exist_ok=True)
    out = os.path.join(HERE, 'results', f"toxicity-{datetime.now():%Y%m%d-%H%M%S}.json")
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'summary': summary, 'results': results}, f, ensure_ascii=False, indent=2)
    print(f'saved → {os.path.relpath(out)}')


if __name__ == '__main__':
    main()
