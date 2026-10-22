import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Benchmark } from './benchmark';
import { benchmarkFingerprint } from './benchmark';
import type { Diagnostics, Trials } from './report';
import {
  RecommendationResponseSchema,
  RECOMMENDATION_DEADLINE_MS,
  type RecommendationRequest,
  type RecommendationResponse,
} from '../contracts/recommendation';
import {
  LiveApprovalSchema,
  readCheckout,
  validateLiveApproval,
  assertApprovalWindow,
  type Checkout,
} from './approval';
export { LiveApprovalSchema } from './approval';
import { parsePublicCatalog } from '../contracts/publicCatalog';

interface Observation {
  response: RecommendationResponse;
  requestId: string | null;
  latencyMs: number;
}
export interface Warmup {
  trial: number;
  phase: 'catalog-load' | 'cache-check';
  status: number | null;
  attempt?: number;
  requestId: string | null;
  latencyMs: number;
  response:
    | RecommendationResponse
    | { outcome: 'catalog-loaded'; catalogVersion: string };
}

async function loadCatalog(
  endpoint: string,
  benchmark: Benchmark,
  fetcher: typeof fetch,
): Promise<Pick<Warmup, 'response' | 'requestId' | 'latencyMs' | 'status'>> {
  const started = performance.now();
  let status: number | null = null;
  let response: Warmup['response'];
  try {
    const result = await fetcher(new URL('/api/catalog', endpoint), {
      method: 'GET',
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    status = result.status;
    if (status === 200) {
      try {
        const catalog = parsePublicCatalog(await result.json());
        const { catalogVersion, ...data } = catalog;
        const actualVersion = `sha256:${createHash('sha256').update(JSON.stringify(data)).digest('hex')}`;
        if (
          actualVersion !== catalogVersion ||
          JSON.stringify(catalog) !== JSON.stringify(benchmark.catalog)
        )
          throw new Error('Catalog content differs from the frozen benchmark.');
        response = {
          outcome: 'catalog-loaded',
          catalogVersion: catalog.catalogVersion,
        };
      } catch (error) {
        if (
          (error instanceof Error || error instanceof DOMException) &&
          ['TimeoutError', 'AbortError'].includes(error.name)
        )
          throw error;
        response = { outcome: 'fallback', reason: 'invalid-response' };
      }
    } else {
      response = {
        outcome: 'fallback',
        reason: status === 504 ? 'timeout' : 'provider-error',
      };
    }
  } catch (error) {
    response = {
      outcome: 'fallback',
      reason:
        (error instanceof Error || error instanceof DOMException) &&
        ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'timeout'
          : 'provider-error',
    };
  }
  return {
    response,
    requestId: null,
    status,
    latencyMs: Math.round(performance.now() - started),
  };
}

async function requestRecommendation(
  endpoint: string,
  input: RecommendationRequest,
  fetcher: typeof fetch,
  deadlineMs = RECOMMENDATION_DEADLINE_MS,
  expectedStatus?: number,
): Promise<Observation & { status: number | null }> {
  const started = performance.now();
  let response: RecommendationResponse;
  let requestId: string | null = null;
  let status: number | null = null;
  try {
    const result = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-cache',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(deadlineMs),
    });
    status = result.status;
    const parsedId = z
      .uuid()
      .safeParse(result.headers.get('X-Recommendation-Request-Id'));
    requestId = parsedId.success ? parsedId.data : null;
    const parsed = RecommendationResponseSchema.safeParse(await result.json());
    response =
      (expectedStatus === undefined
        ? result.ok
        : result.status === expectedStatus) && parsed.success
        ? parsed.data
        : { outcome: 'fallback', reason: 'invalid-response' };
  } catch (error) {
    response = {
      outcome: 'fallback',
      reason:
        (error instanceof Error || error instanceof DOMException) &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
          ? 'timeout'
          : 'provider-error',
    };
  }
  return {
    response,
    requestId,
    status,
    latencyMs: Math.round(performance.now() - started),
  };
}

export async function warmCatalog(
  benchmark: Benchmark,
  approval: z.infer<typeof LiveApprovalSchema>,
  fetcher: typeof fetch,
  saveWarmups: (rows: Warmup[]) => Promise<void>,
  trial: number,
): Promise<Warmup[]> {
  const warmups: Warmup[] = [];
  // Catalog GET has no provider path. Retry only its timeouts, at most three attempts.
  let warmup: Warmup | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    warmup = {
      trial,
      phase: 'catalog-load',
      attempt,
      ...(await loadCatalog(approval.endpoint, benchmark, fetcher)),
    };
    warmups.push(warmup);
    await saveWarmups(warmups);
    if (
      warmup.response.outcome !== 'fallback' ||
      warmup.response.reason !== 'timeout'
    )
      break;
  }
  if (
    !warmup ||
    warmup.status !== 200 ||
    warmup.response.outcome !== 'catalog-loaded' ||
    warmup.response.catalogVersion !== benchmark.catalog.catalogVersion
  ) {
    throw new Error(
      'Catalog warmup did not confirm the approved catalog and configuration. No trial retry was attempted.',
    );
  }
  // A canonical-area rejection happens after reading the catalog and before reservation.
  // This proves the deployed cache is fast enough without spending a provider call.
  const cacheCheck: Warmup = {
    trial,
    phase: 'cache-check',
    ...(await requestRecommendation(
      approval.endpoint,
      {
        functionArea: '__evaluation_invalid_area__',
        goal: '',
        tools: [],
        catalogVersion: benchmark.catalog.catalogVersion,
      },
      fetcher,
      10_000,
      400,
    )),
  };
  warmups.push(cacheCheck);
  await saveWarmups(warmups);
  if (
    !cacheCheck.requestId ||
    cacheCheck.status !== 400 ||
    cacheCheck.latencyMs >= 1_000 ||
    cacheCheck.response.outcome !== 'fallback' ||
    cacheCheck.response.reason !== 'unavailable' ||
    cacheCheck.response.catalogVersion !== benchmark.catalog.catalogVersion ||
    cacheCheck.response.modelVersion !== approval.modelVersion ||
    cacheCheck.response.promptVersion !== approval.promptVersion
  ) {
    throw new Error(
      'Catalog cache check failed or took at least one second. No trial retry was attempted.',
    );
  }
  return warmups;
}

export function hasCompleteWarmupEvidence(
  warmups: Warmup[],
  diagnostics: ReadonlyMap<string, Diagnostics[number]>,
  catalogVersion: string,
  approval: z.infer<typeof LiveApprovalSchema>,
  trialCount: number,
): boolean {
  if (
    warmups.length < trialCount * 2 ||
    warmups.length > trialCount * 4 ||
    warmups.some((row) => row.trial < 1 || row.trial > trialCount)
  )
    return false;
  const cacheIds = new Set<string>();
  for (let trial = 1; trial <= trialCount; trial++) {
    const rows = warmups.filter((row) => row.trial === trial);
    const check = rows.at(-1);
    const loads = rows.slice(0, -1);
    if (
      loads.length < 1 ||
      loads.length > 3 ||
      loads.some(
        (row, index) =>
          row.phase !== 'catalog-load' ||
          row.requestId !== null ||
          row.attempt !== index + 1 ||
          (index === loads.length - 1
            ? row.status !== 200 ||
              row.response.outcome !== 'catalog-loaded' ||
              row.response.catalogVersion !== catalogVersion
            : row.response.outcome !== 'fallback' ||
              row.response.reason !== 'timeout'),
      ) ||
      !check ||
      check.phase !== 'cache-check' ||
      !check.requestId ||
      cacheIds.has(check.requestId) ||
      check.status !== 400 ||
      check.latencyMs >= 1_000 ||
      check.response.outcome !== 'fallback' ||
      check.response.reason !== 'unavailable' ||
      check.response.catalogVersion !== catalogVersion ||
      check.response.modelVersion !== approval.modelVersion ||
      check.response.promptVersion !== approval.promptVersion
    )
      return false;
    cacheIds.add(check.requestId);
    const diagnostic = diagnostics.get(check.requestId);
    if (
      diagnostic?.requestId !== check.requestId ||
      diagnostic.environment !== 'test' ||
      diagnostic.outcome !== 'unavailable' ||
      diagnostic.catalogVersion !== catalogVersion ||
      diagnostic.modelVersion !== approval.modelVersion ||
      diagnostic.promptVersion !== approval.promptVersion
    )
      return false;
  }
  return true;
}

// No provider credentials: this exercises only the approved preview endpoint.
// Server limits remain authoritative. Reserve room for all thirty requests first.
export async function runLiveTrials(
  benchmark: Benchmark,
  approvalValue: unknown,
  allowPaid: boolean,
  fetcher: typeof fetch = fetch,
  saveProgress: (progress: Trials) => Promise<void> = async () => {},
  saveWarmups: (warmups: Warmup[]) => Promise<void> = async () => {},
  checkout: Checkout = readCheckout(),
): Promise<Trials> {
  if (!allowPaid || benchmark.approval.status !== 'approved')
    throw new Error(
      'Live calls require explicit opt-in and approved profiles.',
    );
  const approval = validateLiveApproval(benchmark, approvalValue, checkout);
  const fingerprint = benchmarkFingerprint(benchmark);
  if (approval.benchmarkFingerprint !== fingerprint)
    throw new Error('Live approval does not match this benchmark.');
  const trials: Trials['trials'] = [];
  const warmups: Warmup[] = [];
  for (let index = 0; index < 3; index += 1) {
    assertApprovalWindow(approval);
    const loaded = await warmCatalog(
      benchmark,
      approval,
      fetcher,
      async (rows) => saveWarmups([...warmups, ...rows]),
      index + 1,
    );
    warmups.push(...loaded);
    const trial: Trials['trials'][number] = {
      startedAt: new Date().toISOString(),
      calls: [],
    };
    trials.push(trial);
    for (const profile of benchmark.profiles) {
      assertApprovalWindow(approval, Date.now(), RECOMMENDATION_DEADLINE_MS);
      const observation = await requestRecommendation(
        approval.endpoint,
        { ...profile.input, catalogVersion: benchmark.catalog.catalogVersion },
        fetcher,
      );
      const { response } = observation;
      trial.calls.push({
        profileId: profile.id,
        response,
        requestId: observation.requestId,
        latencyMs: observation.latencyMs,
      });
      await saveProgress({
        kind: 'live',
        benchmarkFingerprint: fingerprint,
        modelVersion: approval.modelVersion,
        promptVersion: approval.promptVersion,
        trials,
      });
      // A version mismatch would spend the remaining allowance on the wrong candidate.
      if (
        response.modelVersion &&
        (response.modelVersion !== approval.modelVersion ||
          response.promptVersion !== approval.promptVersion)
      ) {
        throw new Error(
          'Preview configuration differs from the approved candidate. Stop and inspect server diagnostics.',
        );
      }
    }
  }
  return {
    kind: 'live',
    benchmarkFingerprint: fingerprint,
    modelVersion: approval.modelVersion,
    promptVersion: approval.promptVersion,
    trials,
  };
}
