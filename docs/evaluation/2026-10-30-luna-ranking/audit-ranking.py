"""Audit saved output only. Never call a provider or change labels."""
import json
import pathlib
import sys

folder = pathlib.Path(sys.argv[1])
report = json.loads((folder / 'comparison/report.json').read_text())
trials = json.loads((folder / 'live/trials.json').read_text())
rows = [p for t in report['llm'] for p in t['profiles']]
target = [p for p in rows if p['profileId'] == 'fundraising-02']
calls = [p for t in trials['trials'] for p in t['calls']]
assert len(rows) == len(calls) == 30 and len(target) == 3
audit = {
    'benchmarkFingerprint': report['benchmarkFingerprint'],
    'scores': [t['passedProfiles'] for t in report['llm']],
    'fundraising02TopThreeHits': [p['hits'] for p in target],
    'fundraising02Counts': [p['expanded']['count'] for p in target],
    'acceptedLlmSixToEight': sum(
        p['engine'] == 'llm' and 6 <= p['expanded']['count'] <= 8 for p in rows
    ),
    'timeouts': sum(p['response'].get('reason') == 'timeout' for p in calls),
    'invalidResponses': sum(p['response'].get('reason') == 'invalid-response' for p in calls),
    'completeEvidence': report['relevanceEvidenceComplete'],
}
print(json.dumps(audit, indent=2))
passed = (
    audit['benchmarkFingerprint'] == '298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09'
    and all(p['passed'] and p['engine'] == 'llm' for p in target)
    and all(6 <= n <= 8 for n in audit['fundraising02Counts'])
    and audit['acceptedLlmSixToEight'] >= 27
    and min(audit['scores']) >= 9
    and audit['timeouts'] == audit['invalidResponses'] == 0
    and audit['completeEvidence']
)
if not passed:
    print('FAIL: Fundraising-02 must pass all trials with six to eight picks; retain 27/30 breadth, at least 9/10 per trial and complete evidence without timeouts or invalid output.')
    sys.exit(1)
print('PASS: saved sample meets the ranking and breadth targets; client review remains pending.')
