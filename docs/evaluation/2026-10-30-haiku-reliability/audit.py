"""Audit saved evidence only. Makes no network or provider calls."""
import json
import pathlib
import subprocess
import sys

folder = pathlib.Path(sys.argv[1])
helpers = pathlib.Path('docs/evaluation/2026-10-30-haiku-breadth')
checks = {}
for name in ['audit-failures', 'audit-quality', 'audit-accounting', 'assess']:
    result = subprocess.run(['python3', str(helpers / (name + '.py')), str(folder)], capture_output=True, text=True)
    (folder / 'state' / (name + '-result.json')).write_text(json.dumps({
        'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr,
    }, indent=2) + '\n')
    checks[name] = result.returncode == 0

def read(path):
    return json.loads((folder / path).read_text())

accounting = read('state/accounting-audit.json')
assessment = read('state/comparison-assessment.json')
checks['fortyFinalDiagnostics'] = accounting['finalMeasuredRequests'] == accounting['submittedRequests'] == 40 and not accounting['missingRequestDiagnostics']
checks['accountingComplete'] = accounting['allRequestsHaveFinalAccounting'] and accounting['conservativeAccountingReconciled']
checks['freshCompleteEvidence'] = assessment['completeMeasuredEvidence'] and assessment['freshComparisonSaved']
checks['breadthAtLeastV18'] = assessment['acceptedLlmSixToEight'] >= 24
checks['transportClean'] = all((folder / f).exists() and read(f) == [] for f in ['live/transport-failures.json', 'live/probe-transport-failures.json'])
summary = {'checks': checks, 'passed': all(checks.values()), 'scores': assessment['scores'],
           'sixToEightLists': assessment['acceptedLlmSixToEight'], 'controls': assessment['controls'],
           'recordedCostMicrodollars': accounting['durableAdditionalMicrodollars'],
           'remainingMicrodollars': accounting['remainingAllowanceMicrodollars']}
(folder / 'state/validation.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
sys.exit(0 if summary['passed'] else 1)
