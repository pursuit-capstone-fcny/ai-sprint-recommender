import { PublishedCatalogVersionError } from '../src/library/read';
import { z } from 'zod';
import {
  RECOMMENDATION_DEADLINE_MS,
  QUEUED_RECOMMENDATION_DEADLINE_MS,
  RECOMMENDATION_PROMPT_VERSION,
  RecommendationIdsSchema,
  RecommendationReasonsSchema,
  RecommendationRequestSchema,
  reasonsMatchIds,
  type RecommendationFallbackReason,
  type RecommendationResponse,
} from '../src/contracts/recommendation';
import {
  anthropicProvider,
  inputTokenBound,
  providerBody,
  ProviderValidationSchema,
  type Provider,
  type ProviderValidation,
} from './anthropic';
import { boundedJson } from './bounded-json';
import {
  defaultCatalogCache,
  readCatalogSnapshot,
  readSharedCatalogSnapshot,
  type CatalogCache,
} from './catalog-cache';
import { type Budget } from './budget';
import { durableBudget, type BudgetNamespace } from './budget-object';
import { callCost, readLimits, type Variables } from './config';
import {
  CATALOG_SCORING_MODEL,
  CATALOG_SCORING_PROMPT,
} from './full-catalog-scoring';
import { scoringBody, catalogScoringProvider } from './full-catalog-provider';

export interface WorkerEnv extends Variables {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  RECOMMENDATION_BUDGET?: BudgetNamespace;
  USAGE_BUFFER?: BudgetNamespace;
}
export interface Diagnostic extends Partial<ProviderValidation> {
  requestId: string;
  environment: 'test' | 'production' | 'unconfigured';
  outcome: 'success' | RecommendationFallbackReason;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costMicrodollars?: number;
  reservedMicrodollars?: number;
  catalogVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
}
interface Dependencies {
  fetch?: typeof fetch;
  provider?: Provider;
  budget?: Budget;
  catalogCache?: CatalogCache;
  waitUntil?: (task: Promise<unknown>) => void;
  diagnostic?: (entry: Diagnostic) => void;
  clientKey?: () => Promise<string>;
}
const outputSchema = z
  .strictObject({
    youtubeIds: RecommendationIdsSchema,
    reasons: RecommendationReasonsSchema.optional(),
  })
  .refine(reasonsMatchIds);
const headers = {
  'cache-control': 'no-store',
  'content-type': 'application/json',
  'x-content-type-options': 'nosniff',
};
export const SERVER_DEADLINE_MS = 4_500;
export const SCORING_SERVER_DEADLINE_MS = RECOMMENDATION_DEADLINE_MS - 500;

function testExpired(env: WorkerEnv): boolean {
  if (env.LLM_ENVIRONMENT !== 'test' || env.LLM_TEST_EXPIRES_AT === undefined)
    return false;
  const expiry = z.iso.datetime().safeParse(env.LLM_TEST_EXPIRES_AT);
  return !expiry.success || Date.parse(expiry.data) <= Date.now();
}

async function clientKey(
  request: Request,
  secret: string,
  page?: string,
): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) throw new Error('Missing client identifier');
  const minute = Math.floor(Date.now() / 60_000);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const hash = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${minute}:${ip}${page ? `:${page}` : ''}`),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function recommend(
  request: Request,
  env: WorkerEnv,
  deps: Dependencies = {},
): Promise<Response> {
  const started = Date.now();
  const fullScoring = env.LLM_MODEL === CATALOG_SCORING_MODEL;
  const queued = fullScoring && env.LLM_QUEUE_ENABLED === 'true';
  const providerDeadline = fullScoring
    ? SCORING_SERVER_DEADLINE_MS
    : SERVER_DEADLINE_MS;
  const serverDeadline = queued
    ? QUEUED_RECOMMENDATION_DEADLINE_MS - 500
    : providerDeadline;
  const deadline = started + serverDeadline;
  const promptVersion = fullScoring
    ? CATALOG_SCORING_PROMPT
    : RECOMMENDATION_PROMPT_VERSION;
  const requestId = crypto.randomUUID();
  const abort = new AbortController();
  const onDisconnect = () => abort.abort();
  request.signal.addEventListener('abort', onDisconnect, { once: true });
  if (request.signal.aborted) abort.abort();
  const diagnostic: Diagnostic = {
    requestId,
    environment:
      env.LLM_ENVIRONMENT === 'test' || env.LLM_ENVIRONMENT === 'production'
        ? env.LLM_ENVIRONMENT
        : 'unconfigured',
    outcome: 'unavailable',
    latencyMs: 0,
  };
  let status = 200;
  let catalogTrace = 'not-started';
  const fallback = (
    reason: RecommendationFallbackReason,
  ): RecommendationResponse => ({
    outcome: 'fallback',
    reason,
    ...(diagnostic.catalogVersion
      ? { catalogVersion: diagnostic.catalogVersion }
      : {}),
    ...(diagnostic.modelVersion
      ? {
          modelVersion: diagnostic.modelVersion,
          promptVersion,
        }
      : {}),
  });
  const active = () => {
    if (abort.signal.aborted || Date.now() >= deadline)
      throw new Error('Deadline');
  };
  const execute = async (): Promise<RecommendationResponse> => {
    if (env.LLM_ENABLED !== 'true' || testExpired(env))
      return fallback('disabled');
    const limits = readLimits(env);
    if (
      !limits ||
      env.LLM_APPROVALS_RECORDED !== 'true' ||
      typeof env.ANTHROPIC_API_KEY !== 'string' ||
      !env.ANTHROPIC_API_KEY ||
      typeof env.LLM_RATE_KEY !== 'string' ||
      env.LLM_RATE_KEY.length < 32 ||
      (!deps.budget && !env.RECOMMENDATION_BUDGET)
    )
      return fallback('unavailable');
    diagnostic.modelVersion = limits.LLM_MODEL;
    diagnostic.promptVersion = promptVersion;
    if (request.method !== 'POST') {
      status = 405;
      return fallback('unavailable');
    }
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) {
      status = 403;
      return fallback('unavailable');
    }
    let input;
    try {
      input = RecommendationRequestSchema.parse(
        await boundedJson(request, 8_192),
      );
    } catch {
      status = 400;
      return fallback('unavailable');
    }
    active();
    if (!input.functionArea && !input.goal && input.tools.length === 0)
      return fallback('not-requested');
    const catalogFetcher: typeof fetch =
      deps.fetch ??
      (env.LIBRARY_MODE === 'bundled' && env.ASSETS
        ? (input, init) => env.ASSETS!.fetch(new Request(input, init))
        : fetch);
    let catalog;
    try {
      catalog = await (
        queued ? readSharedCatalogSnapshot : readCatalogSnapshot
      )({
        origin: new URL(request.url).origin,
        source: `${limits.LIBRARY_ORIGIN}/catalog/current.json`,
        requestedVersion: input.catalogVersion,
        signal: abort.signal,
        fetcher: async (input, init) => {
          const resource = String(input).endsWith('/current.json')
            ? 'manifest'
            : 'snapshot';
          catalogTrace = `${resource}-fetch`;
          const response = await catalogFetcher(input, init);
          catalogTrace = `${resource}-${response.status}`;
          return response;
        },
        cache: deps.catalogCache ?? defaultCatalogCache(),
        waitUntil: deps.waitUntil,
      });
    } catch (error) {
      const known = new Map([
        ['Illegal invocation', 'illegal-invocation'],
        ['signal.throwIfAborted is not a function', 'abort-signal'],
        ['Catalog digest mismatch', 'digest'],
        ['Unexpected public catalog fields', 'fields'],
        ['Invalid published library source', 'source'],
      ]);
      const code =
        error instanceof Error ? known.get(error.message) : undefined;
      if (code) catalogTrace += `-${code}`;
      return fallback(
        error instanceof PublishedCatalogVersionError
          ? 'catalog-mismatch'
          : abort.signal.aborted || Date.now() >= deadline
            ? 'timeout'
            : 'unavailable',
      );
    }
    active();
    diagnostic.catalogVersion = catalog.catalogVersion;
    if (input.catalogVersion !== catalog.catalogVersion)
      return fallback('catalog-mismatch');
    if (
      (input.functionArea !== null &&
        !catalog.functionAreas.includes(input.functionArea)) ||
      input.tools.some((tool) => !catalog.tools.includes(tool))
    ) {
      status = 400;
      return fallback('unavailable');
    }
    if (catalog.items.length === 0) return fallback('insufficient-results');
    if (fullScoring && !input.goal) return fallback('insufficient-results');
    const buildBody = () =>
      fullScoring
        ? scoringBody(input, catalog)
        : providerBody(input, catalog, limits);
    // Bound the request before reserving money, then release this temporary
    // payload. Queued callers retain only their small intake and shared catalog.
    const validateBody = () => {
      const body = buildBody();
      if (body.request.max_tokens > limits.LLM_MAX_OUTPUT_TOKENS)
        return 'unavailable' as const;
      if (inputTokenBound(body) > limits.LLM_MAX_INPUT_TOKENS)
        return 'catalog-too-large' as const;
      return null;
    };
    const invalidBody = validateBody();
    if (invalidBody) return fallback(invalidBody);
    const budget =
      deps.budget ??
      durableBudget(env.RECOMMENDATION_BUDGET!, limits.LLM_ENVIRONMENT, queued);
    const provider =
      deps.provider ??
      (fullScoring ? catalogScoringProvider : anthropicProvider)(
        env.ANTHROPIC_API_KEY,
        deps.fetch ?? fetch,
      );
    const identifier = await (deps.clientKey?.() ??
      clientKey(
        request,
        env.LLM_RATE_KEY,
        queued ? input.clientId : undefined,
      ));
    active();
    const reserved = callCost(
      limits,
      limits.LLM_MAX_INPUT_TOKENS,
      limits.LLM_MAX_OUTPUT_TOKENS,
    );
    const cancelWaiting = () => {
      void budget.cancel?.(requestId).catch(() => undefined);
    };
    abort.signal.addEventListener('abort', cancelWaiting, { once: true });
    let permission;
    try {
      permission = await budget.reserve(
        requestId,
        identifier,
        reserved,
        queued ? deadline - providerDeadline : deadline,
      );
    } finally {
      abort.signal.removeEventListener('abort', cancelWaiting);
    }
    if (!permission.ok) return fallback(permission.reason);
    diagnostic.reservedMicrodollars = reserved;
    let actual: number | null = 0;
    try {
      active();
      // Recheck after asynchronous catalog/budget work before any paid dispatch.
      if (testExpired(env)) return fallback('disabled');
      const body = buildBody();
      actual = null; // Dispatch can be billed even when the connection fails or is aborted.
      const callAbort = new AbortController();
      const cancelCall = () => callAbort.abort();
      abort.signal.addEventListener('abort', cancelCall, { once: true });
      let callTimer: ReturnType<typeof setTimeout> | undefined;
      let result;
      try {
        const timedOut = new Promise<never>((_, reject) => {
          callTimer = setTimeout(() => {
            callAbort.abort();
            reject(new Error('Provider deadline'));
          }, providerDeadline);
        });
        result = await Promise.race([
          provider(body, callAbort.signal),
          timedOut,
        ]);
      } catch (error) {
        if (callAbort.signal.aborted) return fallback('timeout');
        throw error;
      } finally {
        clearTimeout(callTimer);
        abort.signal.removeEventListener('abort', cancelCall);
      }
      if (
        !Number.isSafeInteger(result.inputTokens) ||
        result.inputTokens < 0 ||
        !Number.isSafeInteger(result.outputTokens) ||
        result.outputTokens < 0
      )
        return fallback('invalid-response');
      const measuredCost = callCost(
        limits,
        result.inputTokens,
        result.outputTokens,
      );
      if (!Number.isSafeInteger(measuredCost))
        return fallback('invalid-response');
      actual = measuredCost;
      diagnostic.inputTokens = result.inputTokens;
      diagnostic.outputTokens = result.outputTokens;
      diagnostic.costMicrodollars = actual;
      active();
      if (
        result.inputTokens > limits.LLM_MAX_INPUT_TOKENS ||
        result.outputTokens > limits.LLM_MAX_OUTPUT_TOKENS ||
        actual > reserved
      )
        return fallback('invalid-response');
      const parsed = outputSchema.safeParse(result.value);
      const ids = new Set(catalog.items.map((item) => item.youtubeId));
      if (
        !parsed.success ||
        parsed.data.youtubeIds.some((id) => !ids.has(id))
      ) {
        if (limits.LLM_ENVIRONMENT === 'test') {
          const validation = ProviderValidationSchema.safeParse(result);
          if (validation.success) Object.assign(diagnostic, validation.data);
        }
        return fallback('invalid-response');
      }
      return {
        outcome: 'success',
        youtubeIds: parsed.data.youtubeIds,
        ...(parsed.data.reasons ? { reasons: parsed.data.reasons } : {}),
        catalogVersion: catalog.catalogVersion,
        modelVersion: limits.LLM_MODEL,
        promptVersion,
      };
    } catch (error) {
      return fallback(
        error instanceof PublishedCatalogVersionError
          ? 'catalog-mismatch'
          : abort.signal.aborted || Date.now() >= deadline
            ? 'timeout'
            : 'provider-error',
      );
    } finally {
      // If reconciliation fails, the durable maximum reservation remains charged.
      await budget.settle(requestId, actual).catch(() => undefined);
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<RecommendationResponse>((resolve) => {
    timer = setTimeout(() => {
      abort.abort();
      resolve(fallback('timeout'));
    }, serverDeadline);
  });
  const result = await Promise.race([
    execute().catch(() =>
      fallback(
        abort.signal.aborted || Date.now() >= deadline
          ? 'timeout'
          : 'unavailable',
      ),
    ),
    timeout,
  ]);
  clearTimeout(timer);
  request.signal.removeEventListener('abort', onDisconnect);
  diagnostic.outcome = result.outcome === 'success' ? 'success' : result.reason;
  diagnostic.latencyMs = Date.now() - started;
  (
    deps.diagnostic ??
    ((entry) => {
      if (env.LLM_DIAGNOSTICS_ENABLED === 'true')
        console.info(JSON.stringify(entry));
    })
  )({
    ...diagnostic,
  });
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      ...headers,
      'x-recommendation-request-id': requestId,
      'x-recommendation-catalog-status': catalogTrace,
    },
  });
}
