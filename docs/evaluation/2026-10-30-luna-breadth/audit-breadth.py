"""Compare saved trial breadth without provider calls or new relevance labels."""
import collections
import json
import pathlib
import sys

folder = pathlib.Path(sys.argv[1])
report = json.loads((folder / 'comparison/report.json').read_text())
trials = json.loads((folder / 'live/trials.json').read_text())
raw = [call for trial in trials['trials'] for call in trial['calls']]
selected = [profile for trial in report['llm'] for profile in trial['profiles']]
assert len(raw) == len(selected) == 30
assert all(a['profileId'] == b['profileId'] for a, b in zip(raw, selected))
accepted = [profile for profile in selected if profile['engine'] == 'llm']
broad = sum(6 <= profile['expanded']['count'] <= 8 for profile in accepted)
audit = {
    'benchmarkFingerprint': report['benchmarkFingerprint'],
    'scores': [trial['passedProfiles'] for trial in report['llm']],
    'acceptedLlmSixToEight': broad,
    'acceptedLlmThin': sum(profile['expanded']['count'] < 6 for profile in accepted),
    'fallbackCount': len(selected) - len(accepted),
    'rawCounts': dict(collections.Counter(
        len(call['response'].get('youtubeIds', [])) for call in raw
    )),
    'acceptedListsTrimmedByBrowser': sum(
        len(call['response'].get('youtubeIds', [])) != profile['expanded']['count']
        for call, profile in zip(raw, selected) if profile['engine'] == 'llm'
    ),
    'timeouts': sum(call['response'].get('reason') == 'timeout' for call in raw),
    'maxMeasuredOutputTokens': max(profile.get('outputTokens', 0) or 0 for profile in selected),
}
print(json.dumps(audit, indent=2))
if broad < 23 or audit['timeouts'] or min(audit['scores']) < 8:
    print('FAIL: breadth must recover to at least 23/30 without timeouts or a top-three threshold regression.')
    sys.exit(1)
print('PASS: sample meets the comparison targets; client review remains required.')
