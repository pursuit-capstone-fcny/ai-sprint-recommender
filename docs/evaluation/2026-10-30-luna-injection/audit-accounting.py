import json,sys,math,statistics
from pathlib import Path
p=Path(sys.argv[1])
historical_unknown=int(sys.argv[2]) if len(sys.argv)>2 else 225000
def load(n):return json.loads((p/n).read_text())
approval=load('approval.json')
budget_path='state/comparison-budget.json' if approval['modelVersion']=='claude-haiku-5-5' else 'state/luna-budget.json'
b=load(budget_path);t=load('live/trials.json');d=load('live/diagnostics.json');probes=load('live/probes.json')['probes']
by={r['requestId']:r for r in d}
for row in probes:
 if row.get('diagnostic'):by[row['requestId']]=row['diagnostic']
calls=[row for trial in t['trials'] for row in trial['calls']]+probes
assert len(calls)==len({r['requestId'] for r in calls})==40
final=[by[row['requestId']] for row in calls if row['requestId'] in by and by[row['requestId']].get('accountingFinal') is True and 'costMicrodollars' in by[row['requestId']]]
for row in final:
 assert row.get('serviceTier') in ('fast','priority','default')
 multiplier=2 if row['serviceTier'] in ('fast','priority') else 1
 assert row['costMicrodollars']==((row['inputTokens']*100000+row['outputTokens']*500000)*multiplier+999999)//1000000
 assert row['modelVersion']==approval['modelVersion'] and row['promptVersion']==approval['promptVersion']
known=sum(row['costMicrodollars'] for row in final)
assert known<=b['additionalMicrodollars']
lat=sorted(row['latencyMs'] for row in calls)
report=load('comparison/report.json' if (p/'comparison/report.json').exists() else 'live/report.json')
rows=[row for trial in report['llm'] for row in trial['profiles']]
assert len(rows)==30 and all(row['expanded']['count']<=8 for row in rows)
frozen=json.loads(Path('docs/evaluation/2026-10-28-task-tags/benchmark.json').read_text())
active={row['youtubeId'] for row in frozen['catalog']['items'] if row['status']=='active'}
for row in rows:
 ids=row['expanded']['displayedIds'];assert set(ids)<=active and len(ids)==len(set(ids))
 assert row['displayedIds']==ids[:3]
wording={}
for row in probes[:2]:
 profile=next(x for x in frozen['profiles'] if x['id']==row['id'].removeprefix('wording-'))
 good={x['youtubeId'] for x in profile['ideal']+profile['good']}
 wording[row['id']]={'topThreeHits':len(set(row['displayedIds'][:3])&good),'expandedHits':len(set(row['displayedIds'])&good),'count':len(row['displayedIds'])}
audit=dict(kind='deployed-model-accounting-audit',modelVersion=approval['modelVersion'],promptVersion=approval['promptVersion'],reasoningEffort='low',runId=approval['approvedWorkflowRunId'],runAttempt=approval['approvedWorkflowRunAttempt'],submittedRequests=len(calls),finalMeasuredRequests=len(final),totalMeasuredMicrodollars=known,durableAdditionalMicrodollars=b['additionalMicrodollars'],unreconciledMicrodollars=b['additionalMicrodollars']-known,reconciled=known==b['additionalMicrodollars'],historicalUnknownReservationsMicrodollars=historical_unknown,cumulativeCeilingMicrodollars=b['spentMicrodollars'],remainingAllowanceMicrodollars=b['remainingMicrodollars'],inputTokens=sum(r['inputTokens'] for r in final),outputTokens=sum(r['outputTokens'] for r in final),medianClientLatencyMs=statistics.median(lat),p95ClientLatencyMs=lat[math.ceil(len(lat)*.95)-1],maxClientLatencyMs=max(lat),topThreeScores=[t['passedProfiles'] for t in report['llm']],fallbacks=sum(t['fallbackCount'] for t in report['llm']),sixToEightCount=sum(6<=r['expanded']['count']<=8 for r in rows),acceptedLlmSixToEightCount=sum(r['engine']=='llm' and 6<=r['expanded']['count']<=8 for r in rows),acceptedLlmThinCount=sum(r['engine']=='llm' and r['expanded']['count']<6 for r in rows),expandedCounts=[r['expanded']['count'] for r in rows],reusedWording=wording,missingUnpaidWarmupDiagnostics=[r['requestId'] for r in load('live/warmups.json') if r['phase']=='cache-check' and not r.get('diagnostic')],freshComparisonSaved=(p/'comparison/report.json').exists(),topThreeRelevanceEvidenceComplete=report['relevanceEvidenceComplete'],expandedSetQualityApproval='pending-client-review')
unknown=[r for r in by.values() if r.get('providerDispatched') and 'costMicrodollars' not in r]
unknown_reserved=sum(r.get('reservedMicrodollars',0) for r in unknown)
audit.update(finalMeasuredPaidRequests=sum(r.get('providerDispatched') is True for r in final), zeroCostDiagnosticRequests=sum(r.get('providerDispatched') is False for r in final), missingRequestDiagnostics=[r['requestId'] for r in calls if r['requestId'] not in by], newUnknownReservationRequests=[r['requestId'] for r in unknown],newUnknownReservationsMicrodollars=unknown_reserved,cumulativeUnknownReservationsMicrodollars=historical_unknown+unknown_reserved,conservativeAccountingReconciled=known+unknown_reserved==b['additionalMicrodollars'],timedOutBenchmarkRequests=sum(r['response'].get('reason')=='timeout' for tr in t['trials'] for r in tr['calls']), rateLimitedBenchmarkRequests=sum(r['response'].get('reason')=='rate-limited' for tr in t['trials'] for r in tr['calls']), probes=[dict(id=r['id'],engine=r['recommendationEngine'],fallbackReason=r['fallbackReason']) for r in probes])
header_rows=[]
for name in ['live/response-diagnostics.json','live/direct-response-diagnostics.json']:
 if (p/name).exists():header_rows.extend(load(name))
header_ids={row['requestId'] for row in header_rows}
warmup_ids={row['requestId'] for row in load('live/warmups.json') if row['phase']=='cache-check'}
audit.update(responseHeaderRequestCount=sum(row['requestId'] in header_ids for row in calls),responseHeaderWarmupCount=len(warmup_ids & header_ids),cooldowns=load('live/cooldowns.json') if (p/'live/cooldowns.json').exists() else [],probeCooldowns=load('live/probe-cooldowns.json') if (p/'live/probe-cooldowns.json').exists() else [])
for name in ['providerHeadersMs','providerBodyMs']:
 values=[r[name] for r in final if name in r and r.get('providerDispatched')]
 if values:audit[name]={'count':len(values),'median':statistics.median(values),'max':max(values)}
recovery=[]
for name in ['live/recovery-warmups.json','live/probe-recovery-warmups.json']:
 if (p/name).exists():recovery.extend(load(name))
recovery_checks=[r for r in recovery if r['phase']=='cache-check']
audit.update(recoveryCacheChecks=len(recovery_checks),missingRecoveryDiagnostics=[r['requestId'] for r in recovery_checks if r['requestId'] not in header_ids],timeoutDetails=[dict(profileId=r['profileId'],diagnostic=by.get(r['requestId'])) for tr in t['trials'] for r in tr['calls'] if r['response'].get('reason')=='timeout'])
audit['actualServiceTiers']={tier:sum(r.get('serviceTier')==tier for r in final if r.get('providerDispatched')) for tier in ['fast','priority','default']}
audit['requestedServiceTier']=approval.get('serviceTier')
(p/'state/accounting-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps(audit,indent=2))
print('Profiles:',[(r['profileId'],r['hits'],r['engine'],r['expanded']['count'],len(r['expanded']['knownGoodIds'])) for r in rows])
