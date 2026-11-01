"""Replay prior review concerns; this is not a scored or approved label set."""
import json
import sys
from pathlib import Path

report = json.loads((Path(sys.argv[1]) / 'comparison/report.json').read_text())
# These pairs were identified in the retained V44 review before this experiment.
# They are never passed to the model, retrieval, or frozen benchmark scorer.
concerns = {
    'leadership-02': ['YACIPFCbGV8', '6d2bKhdmqqA', 'AjI2GF1b6zo', 'ldd8wxVHvCw'],
    'communications-01': ['0kMuHMGvhBE', 'UdWR8KKxVDU'],
    'communications-02': ['5vR5cPnqT-Q'],
    'fundraising-01': ['AjI2GF1b6zo', 'YACIPFCbGV8', 'Q0Vr4PnGoe4'],
    'fundraising-02': ['tAhSI5nok0s', 't1yNb7iV6g4'],
    'operations-02': ['33a0qYtCMvc'],
    'programs-01': ['wu6DHIkJH7k'],
    'programs-02': ['9Np4JDDQvpA', 'wxJVc1q_nnY', '89GrUhOThk4'],
    'operations-01': ['5vR5cPnqT-Q'],
}
observed = []
short = []
for trial, data in enumerate(report['llm'], 1):
    for row in data['profiles']:
        ids = row['expanded']['displayedIds']
        if row['engine'] != 'llm' or not 6 <= len(ids) <= 8:
            short.append({'trial': trial, 'profileId': row['profileId'],
                          'engine': row['engine'], 'count': len(ids)})
        for rank, item in enumerate(ids, 1):
            if item in concerns.get(row['profileId'], []):
                observed.append({'trial': trial, 'profileId': row['profileId'],
                                 'rank': rank, 'youtubeId': item})
print(json.dumps({
    'kind': 'unscored-prior-review-observations',
    'benchmarkFingerprint': report['benchmarkFingerprint'],
    'scores': [t['passedProfiles'] for t in report['llm']],
    'sixToEightLists': 30 - len(short),
    'shortLists': short,
    'priorConcernAppearances': observed,
    'allExpandedPicksApproved': False,
    'note': 'Absence of these prior concerns does not approve replacements. Review the complete expanded output. Labels and scores are unchanged.',
}, indent=2))
sys.exit(1 if observed or short else 0)
