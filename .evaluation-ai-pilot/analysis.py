"""Predeclared all-attempt analysis. No candidate, network, or payment path."""
import argparse
import collections
import hashlib
import json
import math
import pathlib
import random
import statistics


def load(path):
    return json.loads(pathlib.Path(path).read_text())


def digest(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def percentile(values, fraction):
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)] if values else None


def summarize(rows):
    supported = [r for r in rows if r['availableUseful']]
    gaps = [r for r in rows if not r['availableUseful']]
    returned = sum(len(r['grades']) for r in rows)
    useful = sum(sum(g >= 2 for g in r['grades']) for r in rows)
    costs = [r['costUsd'] for r in rows]
    latencies = [r['latencyMs'] for r in rows]
    return {
        'plannedRequests': len(rows), 'supportedRequests': len(supported), 'libraryGaps': len(gaps),
        'usefulFirst': ratio(sum(bool(r['grades']) and r['grades'][0] >= 2 for r in supported), len(supported)),
        'usefulWithin3': ratio(sum(any(g >= 2 for g in r['grades'][:3]) for r in supported), len(supported)),
        'usefulWithin8': ratio(sum(any(g >= 2 for g in r['grades'][:8]) for r in supported), len(supported)),
        'returnedCards': returned, 'usefulCards': useful, 'returnedPrecision': ratio(useful, returned),
        'macroUsefulRecall': statistics.mean(sum(g >= 2 for g in r['grades']) / r['availableUseful'] for r in supported) if supported else None,
        'microUsefulRecall': ratio(useful, sum(r['availableUseful'] for r in supported)),
        'supportedReturningNothing': sum(not r['grades'] for r in supported),
        'supportedEmpty': ratio(sum(not r['grades'] for r in supported), len(supported)),
        'supportedReturningOnlyWeakOrZero': sum(bool(r['grades']) and not any(g >= 2 for g in r['grades']) for r in supported),
        'gapsReceivingRecommendations': sum(bool(r['grades']) for r in gaps),
        'gapsWithRecommendations': ratio(sum(bool(r['grades']) for r in gaps), len(gaps)),
        'gradeCounts': dict(collections.Counter(str(g) for r in rows for g in r['grades'])),
        'positionGradeCounts': {str(i + 1): dict(collections.Counter(str(r['grades'][i]) for r in rows if len(r['grades']) > i)) for i in range(8)},
        'listLengthCounts': dict(collections.Counter(str(len(r['grades'])) for r in rows)),
        'hardConstraintViolations': sum(r['hardViolations'] for r in rows),
        'hardViolatingRequests': sum(r['hardViolations'] > 0 for r in rows),
        'softViolatingCards': sum(r['softViolatingCards'] for r in rows),
        'softConstraintViolationCardRate': ratio(sum(r['softViolatingCards'] for r in rows), returned) if returned else 0,
        'failures': dict(collections.Counter(r['failure'] for r in rows if r['failure'])),
        'reliability': ratio(sum(not r['failure'] for r in rows), len(rows)),
        'displayDeliveredRate': ratio(sum(r['validDelivery'] for r in rows), len(rows)),
        'invalidDeliveredCards': sum(r['invalidCards'] for r in rows),
        'fallbacks': sum(r['actualEngine'] not in ['llm', 'deterministic'] for r in rows),
        'actualEngines': dict(collections.Counter(r['actualEngine'] for r in rows)),
        'latencyMs': {'median': statistics.median(latencies), 'p95': percentile(latencies, .95), 'max': max(latencies)},
        'costUsd': {'totalConservative': sum(costs), 'meanConservative': statistics.mean(costs), 'p95Conservative': percentile(costs, .95)},
        'unknownCostRequests': sum(not r['costKnown'] for r in rows),
        'unknownReservedUsd': sum(r['unknownReservedUsd'] for r in rows),
    }


def gates(metrics, bars):
    result = {}
    for name, threshold in bars['quality'].items():
        direction = 'Min' if name.endswith('Min') else 'Max'
        value = metrics[name[:-3]]
        result[name] = value is not None and (value >= threshold if direction == 'Min' else value <= threshold)
    op = bars['operations']
    result.update({
        'hardConstraintViolationsMax': metrics['hardConstraintViolations'] <= op['hardConstraintViolationsMax'],
        'softConstraintViolationCardRateMax': metrics['softConstraintViolationCardRate'] <= op['softConstraintViolationCardRateMax'],
        'reliabilityMin': metrics['reliability'] >= op['reliabilityMin'],
        'invalidDeliveredCardsMax': metrics['invalidDeliveredCards'] <= op['invalidDeliveredCardsMax'],
        'commonBoundaryP95LatencyMsMax': metrics['latencyMs']['p95'] <= op['commonBoundaryP95LatencyMsMax'],
        'hardDeadlineMs': metrics['latencyMs']['max'] <= op['hardDeadlineMs'],
        'meanCostUsdMax': metrics['costUsd']['meanConservative'] <= op['meanCostUsdMax'],
        'p95CostUsdMax': metrics['costUsd']['p95Conservative'] <= op['p95CostUsdMax'],
        'usageAccountingKnown': metrics['unknownCostRequests'] == 0,
    })
    return result


def compare(a, b, bars):
    ma, mb = summarize(a), summarize(b)
    margin = bars['meaningfulMargin']
    first = mb['usefulFirst'] - ma['usefulFirst']
    precision = mb['returnedPrecision'] - ma['returnedPrecision'] if mb['returnedPrecision'] is not None and ma['returnedPrecision'] is not None else None
    recall = mb['macroUsefulRecall'] - ma['macroUsefulRecall']
    meaningful = ((first >= margin['usefulFirstPointsMin'] and recall >= -margin['recallNoninferiorityPoints']) or
                  (first == 0 and recall >= margin['ifUsefulFirstEqualMacroRecallPointsMin'])) and precision is not None and precision >= -margin['precisionNoninferiorityPoints']
    rng = random.Random(bars['uncertainty']['seed'])
    draws = collections.defaultdict(list)
    for _ in range(bars['uncertainty']['pairedBootstrapReplicates']):
        indices = rng.choices(range(len(a)), k=len(a))
        x, y = summarize([a[i] for i in indices]), summarize([b[i] for i in indices])
        for metric in ['usefulFirst', 'returnedPrecision', 'macroUsefulRecall']:
            if x[metric] is not None and y[metric] is not None:
                draws[metric].append(y[metric] - x[metric])
    wins = collections.Counter()
    for x, y in zip(a, b):
        if not x['availableUseful']:
            continue
        sx = (bool(x['grades']) and x['grades'][0] >= 2, sum(g >= 2 for g in x['grades']))
        sy = (bool(y['grades']) and y['grades'][0] >= 2, sum(g >= 2 for g in y['grades']))
        wins['llm' if sy > sx else 'deterministic' if sx > sy else 'tie'] += 1
    return {'direction':'llm minus deterministic', 'usefulFirstDifference':first, 'returnedPrecisionDifference':precision, 'macroRecallDifference':recall,
            'llmMeaningfulMargin':meaningful, 'supportedPromptWinsLexicographicFirstThenUsefulCount':dict(wins),
            'pairedBootstrap95Intervals':{key:[percentile(values,.025),percentile(values,.975)] for key,values in draws.items()}}


def run(args):
    study, grades, seal, blind = map(load, [args.study, args.grades, args.seal, args.blind])
    assert digest(args.study) == seal['studySha256']
    assert digest(args.grades) == seal['gradesSha256']
    assert blind['candidateIdentitiesConcealedUntilReviewsSealed'] is True
    assert blind['all40PanelsReviewedByTwoRoles'] is True
    assert blind['disputedConstraintsAdjudicatedWhileBlinded'] is True
    assert len({r['promptId'] for r in blind['panels']}) == 40
    matrix = {(r['promptId'], r['youtubeId']): r for r in grades['judgments']}
    assert len(matrix) == 3560
    assert all(isinstance(r['grade'],int) and 0 <= r['grade'] <= 3 for r in matrix.values())
    prompts = {p['id']:p for p in study['prompts']}
    assert len(prompts) == 40
    records = [load(p) for p in sorted(pathlib.Path(args.evidence, 'attempts').glob('*.json'))]
    assert len(records) == 80
    assert len({(r['job']['candidate'],r['job']['promptId']) for r in records}) == 80
    constraint_audit = {(p['promptId'], c['candidate'], c['youtubeId']):c['violations'] for p in blind['panels'] for c in p['cards']}
    all_rows = {'deterministic':[], 'llm':[], 'llm-model-only':[]}
    upstream_audit=[]
    for candidate in ['deterministic', 'llm']:
        for pid in prompts:
            r = next(r for r in records if r['job']['candidate'] == candidate and r['job']['promptId'] == pid)
            available = sum(row['grade'] >= 2 for (p,_),row in matrix.items() if p == pid)
            for view in [candidate] + (['llm-model-only'] if candidate == 'llm' else []):
                cards = r['modelOnlyCards'] if view == 'llm-model-only' else r['cards']
                ids = [c['youtubeId'] for c in cards]
                invalid = len(ids) - len(set(ids)) + sum((pid,i) not in matrix for i in ids) + max(0,len(ids)-8)
                card_grades=[]; violations=[]; card_soft=0
                for identity in ids:
                    pair=matrix.get((pid,identity), {'grade':0,'violations':[]})
                    card_grades.append(pair['grade'])
                    audit=constraint_audit.get((pid,candidate,identity))
                    assert audit is not None, 'Every returned card requires explicit blinded constraint review'
                    union={v['constraintId']:v for v in pair.get('violations',[]) + audit}
                    violations.extend(union.values())
                    card_soft += any(v['severity']=='soft' for v in union.values())
                row={'promptId':pid,'grades':card_grades,'youtubeIds':ids,'availableUseful':available,'hardViolations':sum(v['severity']=='hard' for v in violations),'softViolatingCards':card_soft,
                     'failure':r.get('failure'),'validDelivery':invalid==0 and r.get('actualEngine')!='none','invalidCards':invalid,'actualEngine':r['actualEngine'],
                     'latencyMs':r['latencyMs'],'costUsd':r['costMicrodollars']/1e6,'costKnown':r.get('costKnown',candidate=='deterministic'), 'unknownReservedUsd':r.get('unknownReservedMicrodollars',0)/1e6}
                all_rows[view].append(row)
            for card in r.get('upstreamCards',[]):
                upstream_audit.append({'candidate':candidate,'promptId':pid,'youtubeId':card['youtubeId'],'grade':matrix.get((pid,card['youtubeId']),{'grade':0})['grade']})
    bars=load(args.bars)
    metrics={k:summarize(v) for k,v in all_rows.items()}
    checks={k:gates(v,bars) for k,v in metrics.items()}
    comparison=compare(all_rows['deterministic'],all_rows['llm'],bars)
    result={'studyId':'fcny-ai-pilot-40-v1','evidenceType':'synthetic AI-authored AI-reviewed proxy; no FCNY approval','metrics':metrics,'provisionalGates':checks,'pairedComparison':comparison,'perPrompt':all_rows,'upstreamGradedCards':upstream_audit,
            'primaryGradingSealSha256':digest(args.seal),'blindedReviewSha256':digest(args.blind),'barsSha256':digest(args.bars),'stoppingRule':'No tuning, retries or variants on these prompts. Neither passing means stop for scope/catalog/separate-round decision.'}
    pathlib.Path(args.out).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'saved':args.out,'studyId':result['studyId']}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    for name in ['study','grades','seal','blind','evidence','bars','out']:
        parser.add_argument('--'+name,required=True)
    run(parser.parse_args())
