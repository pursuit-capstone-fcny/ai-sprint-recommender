import assert from 'node:assert/strict';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import os from 'node:os';

export const PRIOR = 4503394;
export const CAP = 5000000;
export const RESERVATION = 6556;
export const MAX_CALLS = 40;
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
export function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600,
  });
  renameSync(path + '.tmp', path);
}
export function schedule(sealed, prompts) {
  const ids = new Set(prompts.map((p) => p.id));
  assert.equal(sealed.repeats, 1);
  assert.equal(sealed.jobs.length, 80);
  const jobs = sealed.jobs.map((j, index) => {
    assert.equal(j.repeat, 1);
    assert(ids.has(j.promptId));
    assert(['deterministic', 'llm'].includes(j.candidateId));
    return { index, promptId: j.promptId, candidate: j.candidateId };
  });
  assert.equal(
    new Set(jobs.map((j) => j.promptId + ':' + j.candidate)).size,
    80,
  );
  return jobs;
}
export function verify(root) {
  const control = read(join(root, 'control.json'));
  assert.equal(control.studyId, 'fcny-ai-pilot-40-v1');
  assert.equal(sha(readFileSync(join(root, 'bank.json'))), control.bankSha256);
  assert.equal(
    sha(readFileSync(join(root, 'catalog.json'))),
    '9d4fbd711547133e770d0d1121e04fce005b8689d930ba7377ccc0d2d2be7457',
  );
  const bank = read(join(root, 'bank.json'));
  assert.equal(bank.prompts.length, 40);
  assert.equal(new Set(bank.prompts.map((p) => p.id)).size, 40);
  assert.equal(
    new Set(
      bank.prompts.map((p) =>
        p.prompt.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(),
      ),
    ).size,
    40,
  );
  for (const p of bank.prompts) {
    assert.equal(typeof p.prompt, 'string');
    assert(
      p.prompt.length > 0 &&
        p.prompt.length <= 500 &&
        p.prompt === p.prompt.trim(),
    );
    assert.equal(p.functionArea, null);
    assert.deepEqual(p.tools, []);
    assert.equal(p.limit, 8);
  }
  for (const [candidate, path] of Object.entries(control.manifests)) {
    const bytes = readFileSync(join(root, path));
    assert.equal(sha(bytes), control.candidateHashes[candidate]);
    const manifest = JSON.parse(bytes);
    assert.equal(manifest.status, 'frozen');
    assert.equal(manifest.catalogSha256, control.catalogSha256);
    for (const [p, hash] of Object.entries(manifest.files)) {
      const file = resolve(root, p);
      assert(file.startsWith(root + '/'));
      assert.equal(sha(readFileSync(file)), hash, `Frozen file changed: ${p}`);
    }
  }
  assert.equal(control.priorMicrodollars, PRIOR);
  assert.equal(control.capMicrodollars, CAP);
  assert.equal(control.maxCalls, MAX_CALLS);
  assert.equal(control.maxAdditionalMicrodollars, RESERVATION * MAX_CALLS);
  assert.equal(
    sha(readFileSync(join(root, 'schedule.json'))),
    control.scheduleSha256,
  );
  const sealedSchedule = read(join(root, 'schedule.json'));
  assert.equal(sealedSchedule.studySha256, control.originalStudySha256);
  schedule(sealedSchedule, bank.prompts);
  assert.match(control.gradingSealSha256, /^[a-f0-9]{64}$/);
  return { control, bank };
}
export function precharge(journal, promptId) {
  assert(
    !journal.calls.some((c) => c.promptId === promptId),
    'No repeated paid prompt',
  );
  assert(journal.calls.length < MAX_CALLS, 'Dispatch cap');
  const spent = journal.calls.reduce(
    (n, c) => n + c.chargedMicrodollars,
    PRIOR,
  );
  assert(spent + RESERVATION <= CAP, 'Lifetime budget exhausted');
  const call = {
    promptId,
    dispatchedAt: new Date().toISOString(),
    chargedMicrodollars: RESERVATION,
    knownUsage: false,
  };
  journal.calls.push(call);
  return call;
}

async function child(root, out, job) {
  const { control, bank } = verify(root);
  const p = bank.prompts.find((p) => p.id === job.promptId);
  assert(p);
  // This is the complete shared input. No provenance, labels, constraints or intent.
  const input = { prompt: p.prompt, functionArea: null, tools: [], limit: 8 };
  const result = {
    job,
    studyId: control.studyId,
    candidateManifestSha256: control.candidateHashes[job.candidate],
    catalogSha256: control.catalogSha256,
    startedAt: new Date().toISOString(),
    status: 'ok',
    failure: null,
  };
  if (job.candidate === 'deterministic') {
    const { recommendVideos, parsePublicCatalog } = await import(
      pathToFileURL(join(root, 'candidates/deterministic/candidate.mjs'))
    );
    const catalog = parsePublicCatalog(read(join(root, 'catalog.json')));
    const before = JSON.stringify({ catalog, input });
    const start = performance.now();
    const ranked = recommendVideos(catalog, input);
    result.coreLatencyMs = performance.now() - start;
    assert.equal(JSON.stringify({ catalog, input }), before);
    Object.assign(result, {
      cards: ranked.recommendations.map((x) => ({
        youtubeId: x.item.youtubeId,
        reason: x.reason,
      })),
      actualEngine: 'deterministic',
      modelOnlyCards: [],
      upstreamCards: [],
      costMicrodollars: 0,
      usage: { providerCalls: 0, inputTokens: 0, outputTokens: 0 },
      warnings: ranked.warnings,
    });
    process.stdout.write(
      JSON.stringify({
        kind: 'display',
        selection: {
          cards: result.cards,
          modelOnlyCards: result.modelOnlyCards,
          actualEngine: result.actualEngine,
          upstreamCards: result.upstreamCards,
        },
      }) + '\n',
    );
  } else {
    assert(process.env.ANTHROPIC_API_KEY, 'Missing provider secret');
    const { buildRequest, displayResponse, disabledConfig } = await import(
      pathToFileURL(join(root, 'candidates/llm-study/adapter.mjs'))
    );
    const { worker, RecommendationBudget, TestStorage } = await import(
      pathToFileURL(join(root, 'candidates/llm-study/runtime/study-core.mjs'))
    );
    const built = buildRequest(input);
    assert.equal(JSON.parse(built.wire.messages[0].content).catalog.length, 89);
    const env = {
      ...disabledConfig.vars,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      LLM_RATE_KEY: 'isolated-ai-pilot-accounting-key-0001',
      LLM_ENABLED: 'true',
      LLM_TEST_EXPIRES_AT: control.executionExpiresAt,
      // Preserve the later reconciled lifetime ceiling, never the older source floor.
      LLM_PRIOR_MICRODOLLARS: String(PRIOR),
    };
    assert.equal(env.LLM_PRIOR_MICRODOLLARS, String(PRIOR));
    assert(
      Date.parse(env.LLM_TEST_EXPIRES_AT) > Date.now(),
      'Expired execution lease',
    );
    const ledgerPath = join(out, 'worker-storage.json');
    class DiskStorage extends TestStorage {
      constructor() {
        super();
        if (existsSync(ledgerPath))
          this.values = new Map(Object.entries(read(ledgerPath)));
      }
      async put(key, value) {
        await super.put(key, value);
        save(ledgerPath, Object.fromEntries(this.values));
      }
    }
    const storage = new DiskStorage();
    const budget = new RecommendationBudget({ storage }, env);
    env.RECOMMENDATION_BUDGET = { idFromName: (x) => x, get: () => budget };
    const pending = [],
      diagnostics = [],
      raws = [];
    const nativeFetch = globalThis.fetch;
    const nativeInfo = console.info;
    let dispatched = 0;
    console.info = (x) => {
      try {
        diagnostics.push(JSON.parse(x));
      } catch {
        throw Error('Unexpected diagnostic');
      }
    };
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'https://api.anthropic.com/v1/messages');
      assert.equal(init.method, 'POST');
      assert.deepEqual(
        JSON.parse(init.body),
        built.wire,
        'Frozen wire request mismatch',
      );
      assert.equal(++dispatched, 1, 'No retries');
      const journalPath = join(out, 'dispatch-journal.json');
      const journal = read(journalPath);
      precharge(journal, p.id);
      save(journalPath, journal);
      raws.push({
        request: built.wire,
        inputTokenBound: built.bound,
        dispatchedAt: new Date().toISOString(),
      });
      const response = await nativeFetch(url, init);
      const raw = raws.at(-1);
      raw.httpStatus = response.status;
      pending.push(
        response
          .clone()
          .text()
          .then(
            (text) => {
              raw.responseText = text;
            },
            () => {
              raw.responseReadFailure = true;
            },
          ),
      );
      return response;
    };
    const started = performance.now();
    let timer;
    try {
      const request = new Request('https://test.invalid/api/recommendations', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '192.0.2.1',
          Authorization: `Bearer ${env.LLM_RATE_KEY}`,
          'x-evaluation-request-id': randomUUID(),
        },
        body: JSON.stringify(built.request),
      });
      const fallback = { outcome: 'fallback', reason: 'timeout' };
      const workerTask = worker
        .fetch(request, env, { waitUntil: (task) => pending.push(task) })
        .then(async (r) => {
          result.httpStatus = r.status;
          return JSON.parse(await r.text());
        });
      const response = await Promise.race([
        workerTask,
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(fallback), 5000);
        }),
      ]);
      clearTimeout(timer);
      Object.assign(result, displayResponse(input, response));
      result.coreLatencyMs = performance.now() - started;
      result.workerResponse = response;
      process.stdout.write(
        JSON.stringify({
          kind: 'display',
          selection: {
            cards: result.cards,
            modelOnlyCards: result.modelOnlyCards,
            actualEngine: result.actualEngine,
            upstreamCards: result.upstreamCards,
            fallbackReason: result.fallbackReason,
          },
        }) + '\n',
      );
      // Keep transport interception and pessimistic accounting active even if
      // the outer browser deadline wins. The parent kills the child at 15s,
      // retaining displayed cards and a full unknown-usage reservation.
      await Promise.allSettled([workerTask]);
      let drained = 0;
      while (drained < pending.length) {
        const tasks = pending.slice(drained);
        drained = pending.length;
        await Promise.allSettled(tasks);
      }
      const diagnostic = diagnostics.at(-1) ?? null;
      result.diagnostics = diagnostics;
      result.usage = {
        providerCalls: dispatched,
        inputTokens: diagnostic?.inputTokens ?? null,
        outputTokens: diagnostic?.outputTokens ?? null,
      };
      const known =
        dispatched === 0 ||
        (Number.isSafeInteger(diagnostic?.costMicrodollars) &&
          diagnostic.accountingFinal === true);
      result.costMicrodollars = known
        ? (diagnostic?.costMicrodollars ?? 0)
        : RESERVATION;
      result.costKnown = known;
      result.unknownReservedMicrodollars = known ? 0 : RESERVATION;
      const failed = [
        'timeout',
        'provider-error',
        'invalid-response',
        'unavailable',
        'rate-limited',
        'budget-exhausted',
        'catalog-too-large',
      ].includes(response.reason);
      if (failed) {
        result.status = 'failed';
        result.failure = response.reason;
      }
      if (dispatched) {
        const journalPath = join(out, 'dispatch-journal.json');
        const journal = read(journalPath);
        const call = journal.calls.find((c) => c.promptId === p.id);
        assert(call && result.costMicrodollars <= RESERVATION);
        call.chargedMicrodollars = result.costMicrodollars;
        call.knownUsage = known;
        save(journalPath, journal);
      }
    } finally {
      clearTimeout(timer);
      globalThis.fetch = nativeFetch;
      console.info = nativeInfo;
      save(join(out, 'raw', `${job.index}.json`), {
        diagnostics,
        provider: raws,
      });
    }
  }
  assert(result.cards.length <= 8);
  assert.equal(
    new Set(result.cards.map((x) => x.youtubeId)).size,
    result.cards.length,
  );
  process.stdout.write(JSON.stringify({ kind: 'accounted', result }) + '\n');
}

export function launch(args, env) {
  return new Promise((resolveResult) => {
    const started = performance.now();
    let display;
    let buffer = '',
      bytes = 0,
      record,
      latencyMs,
      overflow = false;
    const childProcess = spawn(process.execPath, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => childProcess.kill('SIGKILL'), 15000);
    childProcess.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) {
        overflow = true;
        childProcess.kill('SIGKILL');
        return;
      }
      buffer += chunk;
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n'),
          line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        try {
          const message = JSON.parse(line);
          if (message.kind === 'display' && latencyMs === undefined) {
            latencyMs = performance.now() - started;
            display = message.selection;
          }
          if (message.kind === 'accounted') record = message.result;
        } catch {
          overflow = true;
        }
      }
    });
    // Child errors may include provider metadata. Preserve failure category only.
    childProcess.stderr.resume();
    childProcess.once('error', () => {
      overflow = true;
    });
    childProcess.once('close', (code, signal) => {
      clearTimeout(timer);
      resolveResult({
        record: code === 0 && !overflow ? record : undefined,
        display,
        latencyMs: latencyMs ?? performance.now() - started,
        error: signal ?? 'driver-or-child-error',
      });
    });
  });
}

async function execute(root, out) {
  const { control, bank } = verify(root);
  assert(
    process.env.ANTHROPIC_API_KEY,
    'Missing provider secret; no run authorized',
  );
  assert.equal(process.version, 'v24.22.1');
  const approval = JSON.parse(process.env.AI_PILOT_APPROVAL ?? '{}');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(process.env.GITHUB_RUN_NUMBER, '1');
  assert.equal(String(approval.runNumber), process.env.GITHUB_RUN_NUMBER);
  assert.equal(approval.sourceSha, process.env.GITHUB_SHA);
  assert.equal(
    approval.controlSha256,
    sha(readFileSync(join(root, 'control.json'))),
  );
  assert.equal(approval.maxCalls, 40);
  assert.equal(approval.maxAdditionalMicrodollars, 262240);
  assert(Date.parse(control.executionExpiresAt) > Date.now());
  assert(
    !existsSync(out),
    'Run directory already exists; never resume or rerun',
  );
  mkdirSync(out, { recursive: true });
  save(join(out, 'dispatch-journal.json'), {
    priorMicrodollars: PRIOR,
    capMicrodollars: CAP,
    maxAdditionalMicrodollars: 262240,
    calls: [],
  });
  const environment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    os: os.release(),
    cpu: os.cpus()[0]?.model,
    memoryBytes: os.totalmem(),
    runId: process.env.GITHUB_RUN_ID,
    sourceSha: process.env.GITHUB_SHA,
    boundary: 'evaluator-client-request-to-final-cards/v1',
    execution:
      'same-host Node Worker simulation; disk test storage; live Anthropic HTTP',
    uiRendering: false,
    hostingCostMeasured: false,
  };
  save(join(out, 'environment.json'), environment);
  const environmentSha256 = sha(Buffer.from(JSON.stringify(environment)));
  const jobs = schedule(read(join(root, 'schedule.json')), bank.prompts);
  save(join(out, 'schedule.json'), jobs);
  for (const job of jobs) {
    const childEnv = { ...process.env };
    delete childEnv.AI_PILOT_APPROVAL;
    delete childEnv.AI_PILOT_PAYLOAD_KEY;
    if (job.candidate === 'deterministic') delete childEnv.ANTHROPIC_API_KEY;
    const processResult = await launch(
      [
        fileURLToPath(import.meta.url),
        '--child',
        root,
        out,
        JSON.stringify(job),
      ],
      childEnv,
    );
    const latencyMs = processResult.latencyMs;
    let record;
    try {
      assert(processResult.record);
      record = processResult.record;
    } catch {
      record = {
        job,
        status: 'failed',
        failure: processResult.error,
        cards: [],
        modelOnlyCards: [],
        upstreamCards: [],
        actualEngine: 'none',
        ...processResult.display,
        costMicrodollars: job.candidate === 'llm' ? RESERVATION : 0,
        costKnown: job.candidate !== 'llm',
        unknownReservedMicrodollars: job.candidate === 'llm' ? RESERVATION : 0,
      };
    }
    record.latencyMs = latencyMs;
    record.environmentSha256 = environmentSha256;
    record.candidateManifestSha256 = control.candidateHashes[job.candidate];
    record.catalogSha256 = control.catalogSha256;
    save(join(out, 'attempts', `${job.index}.json`), record);
    // No prompt text or recommendation result in the public workflow log.
    console.log(`Completed scheduled attempt ${job.index + 1}/80`);
  }
  const journal = read(join(out, 'dispatch-journal.json'));
  const llmRecords = jobs
    .filter((j) => j.candidate === 'llm')
    .map((j) => read(join(out, 'attempts', `${j.index}.json`)));
  const ceiling = llmRecords.reduce((n, r) => n + r.costMicrodollars, 0);
  save(join(out, 'accounting.json'), {
    priorMicrodollars: PRIOR,
    capMicrodollars: CAP,
    dispatchedCalls: journal.calls.length,
    additionalCeilingMicrodollars: ceiling,
    totalCeilingMicrodollars: PRIOR + ceiling,
    preservedHistoricalUnknownMicrodollars: 386544,
    paidRetries: 0,
    productionTouched: false,
    testDeploymentTouched: false,
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, rootArg, outArg, jobArg] = process.argv.slice(2);
  const root = resolve(rootArg ?? '.');
  if (mode === '--verify') {
    verify(root);
    console.log('Verified frozen payload. No candidate calls.');
  } else if (mode === '--execute') await execute(root, resolve(outArg));
  else if (mode === '--child')
    await child(root, resolve(outArg), JSON.parse(jobArg));
  else throw Error('Explicit mode required');
}
