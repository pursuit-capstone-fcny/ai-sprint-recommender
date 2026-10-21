import { z } from 'zod';
import {
  RECOMMENDATION_DEADLINE_MS,
  RECOMMENDATION_PROMPT_VERSION,
  RecommendationIdsSchema,
  RecommendationRequestSchema,
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
  type CatalogCache,
} from './catalog-cache';
import { type Budget } from './budget';
import { durableBudget, type BudgetNamespace } from './budget-object';
import { callCost, readLimits, type Variables } from './config';

export interface WorkerEnv extends Variables {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  RECOMMENDATION_BUDGET?: BudgetNamespace;
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
  diagnostic?: (entry: Diagnostic) => void;
  clientKey?: () => Promise<string>;
}
const outputSchema = z.strictObject({ youtubeIds: RecommendationIdsSchema });
const headers = {
  'cache-control': 'no-store',
  'content-type': 'application/json',
  'x-content-type-options': 'nosniff',
};

function testExpired(env: WorkerEnv): boolean {
  if (env.LLM_ENVIRONMENT !== 'test' || env.LLM_TEST_EXPIRES_AT === undefined)
    return false;
  const expiry = z.iso.datetime().safeParse(env.LLM_TEST_EXPIRES_AT);
  return !expiry.success || Date.parse(expiry.data) <= Date.now();
}

async function clientKey(request: Request, secret: string): Promise<string> {
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
    new TextEncoder().encode(`${minute}:${ip}`),
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
  const deadline = started + RECOMMENDATION_DEADLINE_MS;
  const requestId = crypto.randomUUID();
  const abort = new AbortController();
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
          promptVersion: RECOMMENDATION_PROMPT_VERSION,
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
    diagnostic.promptVersion = RECOMMENDATION_PROMPT_VERSION;
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
    const fetcher = deps.fetch ?? fetch;
    let catalog;
    try {
      catalog = await readCatalogSnapshot({
        origin: new URL(request.url).origin,
        source: limits.LLM_CATALOG_URL,
        requestedVersion: input.catalogVersion,
        signal: abort.signal,
        fetcher,
        cache: deps.catalogCache ?? defaultCatalogCache(),
      });
    } catch {
      return fallback(
        abort.signal.aborted || Date.now() >= deadline
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
    const body = providerBody(input, catalog, limits);
    if (inputTokenBound(body) > limits.LLM_MAX_INPUT_TOKENS)
      return fallback('catalog-too-large');
    const budget =
      deps.budget ??
      durableBudget(env.RECOMMENDATION_BUDGET!, limits.LLM_ENVIRONMENT);
    const provider =
      deps.provider ?? anthropicProvider(env.ANTHROPIC_API_KEY, fetcher);
    const identifier = await (deps.clientKey?.() ??
      clientKey(request, env.LLM_RATE_KEY));
    active();
    const reserved = callCost(
      limits,
      limits.LLM_MAX_INPUT_TOKENS,
      limits.LLM_MAX_OUTPUT_TOKENS,
    );
    const permission = await budget.reserve(
      requestId,
      identifier,
      reserved,
      deadline,
    );
    if (!permission.ok) return fallback(permission.reason);
    diagnostic.reservedMicrodollars = reserved;
    let actual: number | null = 0;
    try {
      active();
      // Recheck after asynchronous catalog/budget work before any paid dispatch.
      if (testExpired(env)) return fallback('disabled');
      actual = null; // Dispatch can be billed even when the connection fails or is aborted.
      const result = await provider(body, abort.signal);
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
        catalogVersion: catalog.catalogVersion,
        modelVersion: limits.LLM_MODEL,
        promptVersion: RECOMMENDATION_PROMPT_VERSION,
      };
    } catch {
      return fallback(
        abort.signal.aborted || Date.now() >= deadline
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
    }, RECOMMENDATION_DEADLINE_MS);
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
    headers: { ...headers, 'x-recommendation-request-id': requestId },
  });
}
