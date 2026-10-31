"""Additional accounting check only; never changes relevance scores or labels."""
import json
from pathlib import Path
import sys

folder = Path(sys.argv[1])
def read(name):
    return json.loads((folder / name).read_text())
trials = read('live/trials.json')
probes = read('live/probes.json')['probes']
calls = [row for trial in trials['trials'] for row in trial['calls']] + probes
by = {row['requestId']: row for row in read('live/diagnostics.json')}
for row in probes:
    if row.get('diagnostic'):
        by[row['requestId']] = row['diagnostic']
errors = []
stages = []
for call in calls:
    row = by.get(call['requestId'], {})
    review_limit = 26 if row.get('promptVersion') == 'catalog-rank-haiku-v41' else 18
    count = row.get('providerCallCount')
    known = all(key in row for key in ('inputTokens', 'outputTokens', 'costMicrodollars'))
    if count not in (1, 2) or not known or not row.get('accountingFinal'):
        errors.append({'requestId': call['requestId'], 'reason': 'missing final stage accounting'})
        continue
    inputs = row.get('draftInputTokens', -1) + row.get('reviewInputTokens', 0)
    outputs = row.get('draftOutputTokens', -1) + row.get('reviewOutputTokens', 0)
    valid = inputs == row['inputTokens'] and outputs == row['outputTokens']
    valid &= inputs <= 65000 and outputs <= 512
    valid &= row['costMicrodollars'] == (inputs * 100000 + outputs * 500000 + 999999) // 1000000
    if count == 2:
        valid &= all(key in row for key in ('reviewInputTokens', 'reviewOutputTokens', 'reviewCandidateCount'))
        valid &= row.get('draftOutputTokens', 999) <= 256 and row.get('reviewOutputTokens', 999) <= 256
        valid &= row.get('reviewCandidateCount', 999) <= review_limit
        valid &= row.get('reviewDecision') == 'reviewed'
    else:
        valid &= 'reviewInputTokens' not in row and 'reviewOutputTokens' not in row
    if not valid:
        errors.append({'requestId': call['requestId'], 'reason': 'stage usage or limits disagree'})
    stages.append(count)
result = {
    'kind': 'unscored-provider-stage-accounting',
    'clientRequests': len(calls),
    'providerCalls': sum(stages),
    'twoStageRequests': stages.count(2),
    'singleStageRequests': stages.count(1),
    'errors': errors,
    'passed': len(calls) == len(stages) == 40 and not errors,
    'note': 'Does not change the fixed quality audit, labels or diversity gate. Two planned stages are not retries.',
}
(folder / 'state/stage-accounting.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
sys.exit(0 if result['passed'] else 1)
