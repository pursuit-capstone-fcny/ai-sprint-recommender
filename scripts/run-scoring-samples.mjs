import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const write = async (name, value) =>
  writeFile(
    `build/scoring-samples/${name}.json`,
    JSON.stringify(value, null, 2) + '\n',
    { mode: 0o600 },
  );
const amount = (value) => Number.isSafeInteger(value) && value >= 0;
const cost = (input, output) => Math.ceil(input / 10 + output / 2);

export async function runSamples({
  approval,
  encoded,
  environment,
  fetcher = fetch,
  record = write,
}) {
  assert.equal(
    environment.GITHUB_REPOSITORY,
    'pursuit-capstone-fcny/ai-sprint-recommender',
  );
  assert.equal(String(approval.runId), environment.GITHUB_RUN_ID);
  assert.equal(String(approval.runAttempt), environment.GITHUB_RUN_ATTEMPT);
  assert.equal(approval.runAttempt, 2);
  assert.equal(approval.sourceRevision, environment.SOURCE_REVISION);
  assert(Date.now() < Date.parse(approval.expiresAt));
  assert.equal(sha(encoded), approval.payloadSha256);
  const { plan, catalog } = JSON.parse(
    gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'),
  );
  assert.equal(plan.version, 'full-catalog-scoring-samples-v1');
  assert.equal(plan.scorerRevision, '8874839477f71c5e157acec95b3b6da636104f86');
  assert.equal(
    sha(await readFile('server/full-catalog-scoring.ts')),
    approval.scorerFileSha256,
  );
  assert.equal(plan.model, 'claude-haiku-5-5');
  assert.equal(plan.promptVersion, 'catalog-score-evidence-v1');
  assert.equal(plan.priorCeilingMicrodollars, 4_737_905);
  assert.equal(plan.capMicrodollars, 5_000_000);
  assert.equal(plan.maximumNewReservationMicrodollars, 144_920);
  assert.equal(plan.extraDollarActivated, false);
  assert.equal(plan.researchTransportTimeoutMs, 90_000);
  assert.equal(plan.existingServerDeadlineMs, 4_500);
  assert.equal(plan.prompts.length, 10);
  assert.equal(new Set(plan.prompts.map((p) => p.id)).size, 10);
  assert.deepEqual(
    Object.keys(catalog.items[0]).sort(),
    [
      'youtubeId',
      'title',
      'description',
      'functionAreas',
      'tasks',
      'tools',
      'addedAt',
      'lengthSeconds',
      'status',
      'startHere',
    ].sort(),
  );
  const compiled = await build({
    entryPoints: ['server/full-catalog-scoring.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const { prepareCatalogScoring } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
  );
  const prepared = plan.prompts.map((sample) => ({
    sample,
    prepared: prepareCatalogScoring(sample.input, catalog),
  }));
  for (const { prepared: p } of prepared) {
    const sent = JSON.parse(p.request.messages[0].content);
    assert.deepEqual(sent.catalog, catalog.items);
    assert.equal(sent.catalog.length, 89);
    assert.equal(p.request.model, plan.model);
    assert.equal(p.promptVersion, plan.promptVersion);
    assert.equal(p.request.output_config.effort, 'low');
    assert.deepEqual(p.request.thinking, { type: 'disabled' });
    assert(p.inputTokenBound <= 63_000);
    assert.equal(p.request.max_tokens, 16_384);
  }
  const perCallReservation = cost(63_000, 16_384);
  assert.equal(
    perCallReservation * prepared.length,
    plan.maximumNewReservationMicrodollars,
  );
  assert(
    plan.priorCeilingMicrodollars + perCallReservation * prepared.length <=
      plan.capMicrodollars,
  );
  const ledger = {
    priorCeilingMicrodollars: plan.priorCeilingMicrodollars,
    capMicrodollars: plan.capMicrodollars,
    maximumNewReservationMicrodollars: plan.maximumNewReservationMicrodollars,
    dispatchedCalls: 0,
    additionalCeilingMicrodollars: 0,
    knownSpendMicrodollars: 0,
    unknownReservedMicrodollars: 0,
    paidRetries: 0,
    extraDollarActivated: false,
    requests: [],
  };
  const summary = [];
  await record('plan', plan);
  await record('budget', ledger);
  if (environment.SCORING_CHECK_ONLY === 'true')
    return { checkOnly: true, calls: 0, perCallReservation };
  assert(environment.ANTHROPIC_API_KEY);
  for (const { sample, prepared: p } of prepared) {
    assert(Date.now() < Date.parse(approval.expiresAt));
    assert(
      ledger.additionalCeilingMicrodollars + perCallReservation <=
        plan.maximumNewReservationMicrodollars,
    );
    const entry = {
      id: sample.id,
      reservedMicrodollars: perCallReservation,
      chargedMicrodollars: perCallReservation,
      measuredMicrodollars: null,
      outcome: 'pending',
      inputTokens: null,
      outputTokens: null,
    };
    ledger.requests.push(entry);
    ledger.dispatchedCalls++;
    ledger.additionalCeilingMicrodollars += perCallReservation;
    ledger.unknownReservedMicrodollars += perCallReservation;
    await record('budget', ledger); // Persist reservation BEFORE dispatch; never retry.
    await record(`${sample.id}-request`, p.request);
    const started = performance.now();
    let evidence;
    try {
      const response = await fetcher('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': environment.ANTHROPIC_API_KEY,
        },
        body: JSON.stringify(p.request),
        signal: AbortSignal.timeout(plan.researchTransportTimeoutMs),
        redirect: 'error',
      });
      const raw = await response.text();
      const latencyMs = Math.round(performance.now() - started);
      await record(`${sample.id}-provider`, { status: response.status, raw });
      const body = JSON.parse(raw);
      const usage = body.usage;
      if (
        response.ok &&
        usage &&
        amount(usage.input_tokens) &&
        amount(usage.output_tokens) &&
        usage.input_tokens <= p.inputTokenBound &&
        usage.output_tokens <= 16_384 &&
        !(usage.cache_creation_input_tokens ?? 0) &&
        !(usage.cache_read_input_tokens ?? 0)
      ) {
        const measured = cost(usage.input_tokens, usage.output_tokens);
        assert(measured <= perCallReservation);
        entry.measuredMicrodollars = measured;
        entry.chargedMicrodollars = measured;
        entry.inputTokens = usage.input_tokens;
        entry.outputTokens = usage.output_tokens;
        ledger.knownSpendMicrodollars += measured;
        ledger.additionalCeilingMicrodollars -= perCallReservation - measured;
        ledger.unknownReservedMicrodollars -= perCallReservation;
      }
      const text = Array.isArray(body.content)
        ? body.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('')
        : '';
      let decoded = null;
      try {
        decoded = JSON.parse(text);
      } catch {
        /* Preserve malformed output. */
      }
      const transportValid =
        response.ok &&
        body.stop_reason === 'end_turn' &&
        entry.measuredMicrodollars !== null;
      const decision = transportValid ? p.complete(decoded) : null;
      entry.outcome = !response.ok
        ? 'provider-error'
        : body.stop_reason !== 'end_turn'
          ? 'incomplete-response'
          : entry.measuredMicrodollars === null
            ? 'usage-unverified'
            : decision.state.status;
      evidence = {
        id: sample.id,
        httpStatus: response.status,
        latencyMs,
        meetsExistingDeadline: latencyMs <= plan.existingServerDeadlineMs,
        stopReason: body.stop_reason ?? null,
        decoded,
        decision,
        outcome: entry.outcome,
        usage:
          entry.inputTokens === null
            ? null
            : {
                inputTokens: entry.inputTokens,
                outputTokens: entry.outputTokens,
              },
        chargedMicrodollars: entry.chargedMicrodollars,
      };
    } catch {
      entry.outcome = 'transport-error';
      evidence = {
        id: sample.id,
        outcome: entry.outcome,
        latencyMs: Math.round(performance.now() - started),
        meetsExistingDeadline: false,
        chargedMicrodollars: entry.chargedMicrodollars,
      };
    }
    summary.push({
      id: sample.id,
      outcome: evidence.outcome,
      latencyMs: evidence.latencyMs,
      meetsExistingDeadline: evidence.meetsExistingDeadline,
      validationFailure: evidence.decision?.validationFailure ?? null,
      selectedIds:
        evidence.decision?.response?.outcome === 'success'
          ? evidence.decision.response.youtubeIds
          : [],
      chargedMicrodollars: entry.chargedMicrodollars,
    });
    await record(`${sample.id}-evidence`, evidence);
    ledger.totalCeilingMicrodollars =
      ledger.priorCeilingMicrodollars + ledger.additionalCeilingMicrodollars;
    ledger.remainingMicrodollars =
      ledger.capMicrodollars - ledger.totalCeilingMicrodollars;
    await record('budget', ledger);
    await record('summary', summary);
    console.log(`${sample.id}: ${entry.outcome}; ${evidence.latencyMs} ms`);
    // Authentication/schema/provider errors are not a reason to spend on the
    // remaining samples. Validation failures from completed model output remain
    // evidence; continue the fixed sample set without changing or retrying it.
    if (evidence.httpStatus !== undefined && evidence.httpStatus !== 200) break;
  }
  return { ledger, summary };
}

if (
  process.argv[1]?.endsWith('/run-scoring-samples.mjs') ||
  process.argv[1] === 'scripts/run-scoring-samples.mjs'
) {
  try {
    await mkdir('build/scoring-samples', { recursive: true });
    await runSamples({
      approval: JSON.parse(process.env.FULL_CATALOG_SCORING_APPROVAL),
      encoded: process.env.FULL_CATALOG_SCORING_PAYLOAD,
      environment: process.env,
    });
  } catch {
    console.error(
      'Scoring sample run stopped. Approval, input or execution check failed. Inspect saved evidence; do not rerun automatically.',
    );
    process.exitCode = 1;
  }
}
