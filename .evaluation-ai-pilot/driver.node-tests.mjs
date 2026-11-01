import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  schedule,
  precharge,
  launch,
  PRIOR,
  CAP,
  RESERVATION,
} from './driver.mjs';

test('one presealed reproducible attempt per candidate and prompt', () => {
  const prompts = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}` }));
  const sealed = {
    repeats: 1,
    jobs: prompts.flatMap((p) =>
      ['deterministic', 'llm'].map((candidateId) => ({
        promptId: p.id,
        candidateId,
        repeat: 1,
      })),
    ),
  };
  const jobs = schedule(sealed, prompts);
  assert.deepEqual(jobs, schedule(sealed, prompts));
  assert.equal(jobs.length, 80);
  assert.equal(
    new Set(jobs.map((j) => j.candidate + ':' + j.promptId)).size,
    80,
  );
  assert.equal(jobs.filter((j) => j.candidate === 'llm').length, 40);
  const corrupted = structuredClone(sealed);
  corrupted.jobs[1] = corrupted.jobs[0];
  assert.throws(() => schedule(corrupted, prompts));
});
test('all forty maximum reservations fit the existing allowance without historical refunds', () => {
  const journal = { calls: [] };
  for (let i = 0; i < 40; i++) precharge(journal, `p${i}`);
  assert.equal(
    journal.calls.reduce((n, c) => n + c.chargedMicrodollars, PRIOR),
    4765634,
  );
  assert(
    journal.calls.reduce((n, c) => n + c.chargedMicrodollars, PRIOR) <= CAP,
  );
  assert.throws(() => precharge(journal, 'extra'));
  assert.throws(() => precharge(journal, 'p0'));
  assert(
    journal.calls.every(
      (c) => !c.knownUsage && c.chargedMicrodollars === RESERVATION,
    ),
  );
});
test('budget check fails before dispatch if accumulated accounting is unsafe', () => {
  const journal = {
    calls: [{ promptId: 'already', chargedMicrodollars: CAP - PRIOR }],
  };
  assert.throws(() => precharge(journal, 'next'));
  assert.equal(journal.calls.length, 1);
});
test('display parse latency excludes later accounting and raw archival', async () => {
  const start = performance.now();
  const result = await launch(
    [
      '--input-type=module',
      '-e',
      `console.log(JSON.stringify({kind:'display',cards:[]})); await new Promise(r=>setTimeout(r,250)); console.log(JSON.stringify({kind:'accounted',result:{cards:[]}}));`,
    ],
    process.env,
  );
  assert.deepEqual(result.record, { cards: [] });
  assert(performance.now() - start - result.latencyMs >= 200);
});
test('an accounting failure preserves already displayed cards and its failure', async () => {
  const result = await launch(
    [
      '--input-type=module',
      '-e',
      `console.log(JSON.stringify({kind:'display',selection:{cards:[{youtubeId:'abcdefghijk'}],actualEngine:'llm'}})); process.exit(2);`,
    ],
    process.env,
  );
  assert.equal(result.record, undefined);
  assert.deepEqual(result.display.cards, [{ youtubeId: 'abcdefghijk' }]);
  assert(Number.isFinite(result.latencyMs));
});
