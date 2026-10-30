import json,sys,collections,pathlib
p=pathlib.Path(sys.argv[1]);r=json.loads((p/'comparison/report.json').read_text());t=json.loads((p/'live/trials.json').read_text())
raw=[c for trial in t['trials'] for c in trial['calls']]
selected=[c for trial in r['llm'] for c in trial['profiles']]
accepted=[c for c in selected if c['engine']=='llm']
broad=sum(6<=c['expanded']['count']<=8 for c in accepted)
audit={'benchmarkFingerprint':r['benchmarkFingerprint'],'scores':[t['passedProfiles'] for t in r['llm']],'acceptedLlmSixToEight':broad,'acceptedLlmThin':sum(c['expanded']['count']<6 for c in accepted),'fallbackCount':len(selected)-len(accepted),'rawCounts':dict(collections.Counter(len(c['response'].get('youtubeIds',[])) for c in raw)),'acceptedListsTrimmedByBrowser':sum(len(a['response'].get('youtubeIds',[]))!=b['expanded']['count'] for a,b in zip(raw,selected) if b['engine']=='llm'),'timeouts':sum(c['response'].get('reason')=='timeout' for c in raw),'maxMeasuredOutputTokens':max(c.get('outputTokens',0) or 0 for c in selected)}
print(json.dumps(audit,indent=2))
if broad < 23 or audit['timeouts'] or min(audit['scores'])<8:
 print('FAIL: breadth must recover to at least 23/30 without timeouts or a top-three threshold regression.')
 sys.exit(1)
print('PASS: sample meets the comparison targets; client review remains required.')
