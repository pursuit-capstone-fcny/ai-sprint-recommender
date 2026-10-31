"""Unpaid follow-up observation. Frozen benchmark and scoring stay unchanged."""
import json
from pathlib import Path
import sys

folder = Path(sys.argv[1])
report = json.loads((folder / 'comparison/report.json').read_text())
# Existing V25 review flags, not new ideal/good labels or model inputs.
flags = {
    'programs-02': {'tAhSI5nok0s': 'Job Applications'},
    'communications-02': {
        'i22v2xwT6k4': 'AI Peer Learning Groups',
        'Xlvo2_eUBLo': 'Transforming Print to Podcast',
    },
}
observed = []
short = []
counts = []
for trial, data in enumerate(report['llm'], 1):
    for row in data['profiles']:
        ids = row['expanded']['displayedIds']
        counts.append(len(ids))
        if row['engine'] != 'llm' or not 6 <= len(ids) <= 8:
            short.append({'trial': trial, 'profileId': row['profileId'],
                          'engine': row['engine'], 'count': len(ids)})
        for rank, video in enumerate(ids, 1):
            if video in flags.get(row['profileId'], {}):
                observed.append({'trial': trial, 'profileId': row['profileId'],
                                 'rank': rank, 'youtubeId': video,
                                 'title': flags[row['profileId']][video]})
result = {
    'kind': 'unscored-expanded-followup',
    'benchmarkFingerprint': report['benchmarkFingerprint'],
    'scores': [t['passedProfiles'] for t in report['llm']],
    'sixToEightLists': 30 - len(short),
    'totalCards': sum(counts),
    'remainingShortLists': short,
    'existingReviewFlagAppearances': observed,
    'requestedSymptomsResolved': len(counts) == 30 and not short and not observed,
    'allExpandedPicksApproved': False,
    'note': 'Observes the requested short-list and existing review-flag symptoms. Does not change labels, compute new relevance labels, or replace the fixed validation audit. Removing these flags does not establish that every other pick is useful.',
}
(folder / 'state/expanded-followup.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
sys.exit(0 if result['requestedSymptomsResolved'] else 1)
