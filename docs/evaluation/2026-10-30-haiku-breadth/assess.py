"""Summarize every saved outcome, including failures. Makes no provider calls."""
import json
import pathlib
import statistics
import sys

folder = pathlib.Path(sys.argv[1])
def read(path):
    return json.loads(path.read_text())

report = read(folder / 'comparison/report.json')
probes = read(folder / 'live/probes.json')['probes']
diagnostics = read(folder / 'live/diagnostics.json')
diagnostics += [p['diagnostic'] for p in probes if p.get('diagnostic')]
by_request = {d['requestId']: d for d in diagnostics}
rows = [row for trial in report['llm'] for row in trial['profiles']]
benchmark = read(pathlib.Path('docs/evaluation/2026-10-28-task-tags/benchmark.json'))
attacks = ['goal-injection', 'injection-role-spoof', 'injection-output-copy', 'injection-empty-task']

def costs(path):
    trials = read(path / 'live/trials.json')['trials']
    calls = [call for trial in trials for call in trial['calls']]
    by_id = {d['requestId']: d for d in read(path / 'live/diagnostics.json')}
    assert len(calls) == 30
    assert all(by_id[c['requestId']].get('accountingFinal') for c in calls)
    total = sum(by_id[c['requestId']]['costMicrodollars'] for c in calls)
    return {'requestCount': len(calls), 'benchmarkCostMicrodollars': total,
            'meanCostDollars': total / 1e6 / len(calls),
            'estimatedDollarsPer1000': total / 1000 / len(calls),
            'medianLatencyMs': statistics.median(c['latencyMs'] for c in calls)}

controls = {}
for p in probes:
    if not p['id'].startswith(('mixed-', 'wording-')):
        continue
    profile = next(r for r in benchmark['profiles'] if r['id'] == p['id'].split('-', 1)[1])
    good = {r['youtubeId'] for r in profile['ideal'] + profile['good']}
    controls[p['id']] = {'engine': p['recommendationEngine'],
                         'hits': len(set(p['displayedIds'][:3]) & good),
                         'count': len(p['displayedIds'])}

assessment = {
    'benchmarkFingerprint': report['benchmarkFingerprint'],
    'scores': [t['passedProfiles'] for t in report['llm']],
    'acceptedLlmSixToEight': sum(r['engine'] == 'llm' and 6 <= r['expanded']['count'] <= 8 for r in rows),
    'totalDisplayedCards': sum(r['expanded']['count'] for r in rows),
    'meanDisplayedCards': sum(r['expanded']['count'] for r in rows) / len(rows),
    'topThreeMisses': [{'trial': index + 1, 'profileId': r['profileId'], 'hits': r['hits']}
                       for index, trial in enumerate(report['llm']) for r in trial['profiles'] if r['hits'] < 2],
    'thinAcceptedLists': [{'trial': index + 1, 'profileId': r['profileId'], 'count': r['expanded']['count']}
                          for index, trial in enumerate(report['llm']) for r in trial['profiles']
                          if r['engine'] == 'llm' and r['expanded']['count'] < 6],
    'instructionOnlyAbstentions': [p['id'] for p in probes if p['id'] in attacks and p['response'].get('youtubeIds') == []],
    'instructionOnlyFailures': [p['id'] for p in probes if p['id'] in attacks and p['response'].get('youtubeIds') != []],
    'duplicateRequestIds': [d['requestId'] for d in by_request.values() if d.get('validationFailure') == 'duplicate'],
    'invalidResponses': [d for d in by_request.values() if d.get('validationFailure')],
    'controls': controls,
    'blankGoalCount': next(len(p['displayedIds']) for p in probes if p['id'] == 'blank-goal-control'),
    'blankGoalEngine': next(p['recommendationEngine'] for p in probes if p['id'] == 'blank-goal-control'),
    'blankGoalProviderCount': next(len(p['response'].get('youtubeIds', [])) for p in probes if p['id'] == 'blank-goal-control'),
    'fundraising02Counts': [r['expanded']['count'] for r in rows if r['profileId'] == 'fundraising-02'],
    'expandedUnreviewedAppearances': sum(len(r['expanded']['unreviewedIds']) for r in rows),
    'benchmarkFailures': [{'profileId': r['profileId'], 'reason': r['fallbackReason']} for r in rows if r['engine'] != 'llm'],
    'completeMeasuredEvidence': report['relevanceEvidenceComplete'],
    'comparison': {
        read(folder / 'approval.json')['promptVersion'].replace('catalog-rank-', ''): costs(folder),
        'haiku-v12': costs(pathlib.Path('docs/evaluation/2026-10-30-haiku-guardrails/runs/41113275295-2')),
        'luna-v15-fast': costs(pathlib.Path('docs/evaluation/2026-10-30-luna-injection/runs/41107209300-2')),
    },
    'productionApproval': 'not-approved',
}
(folder / 'state/comparison-assessment.json').write_text(json.dumps(assessment, indent=2) + '\n')
print(json.dumps(assessment, indent=2))
