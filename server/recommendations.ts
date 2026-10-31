import { z } from 'zod';
import {
  DiagnosticSchema,
  EVALUATION_DIAGNOSTIC_HEADER,
  EVALUATION_REQUEST_HEADER,
} from '../src/contracts/evaluationDiagnostic';
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
import { lunaDeployedBody, lunaProvider } from './luna';
import { LUNA_DEPLOYED_PROMPT } from './luna-policy';
import { HAIKU_DEPLOYED_PROMPT } from './haiku-policy';
import { haikuDeployedBody } from './haiku';
import { haikuCandidates } from './haiku-candidates';
import {
  defaultCatalogCache,
  readCatalogSnapshot,
  type CatalogCache,
} from './catalog-cache';
import { type Budget } from './budget';
import { durableBudget, type BudgetNamespace } from './budget-object';
import { callCost, readLimits, budgetKey, type Variables } from './config';

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
  reasoningTokens?: number;
  serviceTier?: 'default' | 'priority' | 'fast';
  providerDispatched?: boolean;
  requestedCatalogVersion?: string;
  catalogMs?: number;
  budgetMs?: number;
  providerMs?: number;
  providerHeadersMs?: number;
  providerBodyMs?: number;
  accountingFinal?: boolean;
  phase?: 'request' | 'catalog' | 'budget' | 'provider' | 'validation';
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
const outputSchema = z.strictObject({ youtubeIds: RecommendationIdsSchema });
const headers = {
  'cache-control': 'no-store',
  'content-type': 'application/json',
  'x-content-type-options': 'nosniff',
};
// Leave time for the response to reach the browser's unchanged five-second limit.
export const SERVER_DEADLINE_MS = RECOMMENDATION_DEADLINE_MS - 500;

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
  const deadline = started + SERVER_DEADLINE_MS;
  const authenticatedDiagnostics =
    env.LLM_ENVIRONMENT === 'test' &&
    env.LLM_DIAGNOSTICS_ENABLED === 'true' &&
    typeof env.LLM_RATE_KEY === 'string' &&
    env.LLM_RATE_KEY.length >= 32 &&
    request.headers.get('Authorization') === `Bearer ${env.LLM_RATE_KEY}`;
  const suppliedId = z
    .uuid()
    .safeParse(request.headers.get(EVALUATION_REQUEST_HEADER));
  const requestId =
    authenticatedDiagnostics && suppliedId.success
      ? suppliedId.data
      : crypto.randomUUID();
  const abort = new AbortController();
  const diagnostic: Diagnostic = {
    requestId,
    environment:
      env.LLM_ENVIRONMENT === 'test' || env.LLM_ENVIRONMENT === 'production'
        ? env.LLM_ENVIRONMENT
        : 'unconfigured',
    outcome: 'unavailable',
    latencyMs: 0,
    providerDispatched: false,
    phase: 'request',
  };
  let status = 200;
  let promptVersion: string = RECOMMENDATION_PROMPT_VERSION;
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
    const providerKey =
      limits?.LLM_PROVIDER === 'openai'
        ? env.OPENAI_API_KEY
        : env.ANTHROPIC_API_KEY;
    if (
      !limits ||
      env.LLM_APPROVALS_RECORDED !== 'true' ||
      typeof providerKey !== 'string' ||
      !providerKey ||
      typeof env.LLM_RATE_KEY !== 'string' ||
      env.LLM_RATE_KEY.length < 32 ||
      (!deps.budget && !env.RECOMMENDATION_BUDGET)
    )
      return fallback('unavailable');
    diagnostic.modelVersion = limits.LLM_MODEL;
    const boundedHaiku =
      limits.LLM_PROVIDER === 'anthropic' &&
      limits.LLM_ALLOWANCE_MICRODOLLARS !== undefined;
    promptVersion =
      limits.LLM_PROVIDER === 'openai'
        ? LUNA_DEPLOYED_PROMPT
        : boundedHaiku
          ? HAIKU_DEPLOYED_PROMPT
          : RECOMMENDATION_PROMPT_VERSION;
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
    diagnostic.requestedCatalogVersion = input.catalogVersion;
    active();
    if (!input.functionArea && !input.goal && input.tools.length === 0)
      return fallback('not-requested');
    const fetcher = deps.fetch ?? fetch;
    let catalog;
    diagnostic.phase = 'catalog';
    const catalogStarted = Date.now();
    try {
      catalog = await readCatalogSnapshot({
        origin: new URL(request.url).origin,
        source: limits.LLM_CATALOG_URL,
        requestedVersion: input.catalogVersion,
        signal: abort.signal,
        fetcher,
        cache: deps.catalogCache ?? defaultCatalogCache(),
        waitUntil: deps.waitUntil,
      });
    } catch {
      return fallback(
        abort.signal.aborted || Date.now() >= deadline
          ? 'timeout'
          : 'unavailable',
      );
    } finally {
      diagnostic.catalogMs = Date.now() - catalogStarted;
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
    const originalBody = providerBody(
      input,
      boundedHaiku
        ? { ...catalog, items: haikuCandidates(catalog.items, input) }
        : catalog,
      limits,
    );
    const body = boundedHaiku ? haikuDeployedBody(originalBody) : originalBody;
    let bound: number;
    try {
      bound =
        limits.LLM_PROVIDER === 'openai'
          ? new TextEncoder().encode(JSON.stringify(lunaDeployedBody(body)))
              .length + 1_024
          : inputTokenBound(body);
    } catch {
      return fallback('catalog-too-large');
    }
    if (bound > limits.LLM_MAX_INPUT_TOKENS)
      return fallback('catalog-too-large');
    const budget =
      deps.budget ??
      durableBudget(env.RECOMMENDATION_BUDGET!, budgetKey(limits));
    const provider =
      deps.provider ??
      (limits.LLM_PROVIDER === 'openai'
        ? lunaProvider(providerKey, fetcher)
        : anthropicProvider(providerKey, fetcher));
    const identifier = await (deps.clientKey?.() ??
      clientKey(request, env.LLM_RATE_KEY));
    active();
    const reserved = callCost(
      limits,
      limits.LLM_MAX_INPUT_TOKENS,
      limits.LLM_MAX_OUTPUT_TOKENS,
    );
    diagnostic.phase = 'budget';
    const budgetStarted = Date.now();
    const permission = await budget.reserve(
      requestId,
      identifier,
      reserved,
      deadline,
    );
    diagnostic.budgetMs = Date.now() - budgetStarted;
    if (!permission.ok) return fallback(permission.reason);
    diagnostic.reservedMicrodollars = reserved;
    let actual: number | null = 0;
    try {
      active();
      // Recheck after asynchronous catalog/budget work before any paid dispatch.
      if (testExpired(env)) return fallback('disabled');
      actual = null; // Dispatch can be billed even when the connection fails or is aborted.
      diagnostic.providerDispatched = true;
      diagnostic.phase = 'provider';
      const providerStarted = Date.now();
      const result = await provider(body, abort.signal, (timing) => {
        for (const key of ['providerHeadersMs', 'providerBodyMs'] as const) {
          const ms = timing[key];
          if (
            ms !== undefined &&
            Number.isFinite(ms) &&
            ms >= 0 &&
            ms <= 600_000
          )
            diagnostic[key] = ms;
        }
      }).finally(() => {
        diagnostic.providerMs = Date.now() - providerStarted;
      });
      diagnostic.phase = 'validation';
      if (
        !Number.isSafeInteger(result.inputTokens) ||
        result.inputTokens < 0 ||
        !Number.isSafeInteger(result.outputTokens) ||
        result.outputTokens < 0
      )
        return fallback('invalid-response');
      if (limits.LLM_PROVIDER === 'openai') {
        if (!['default', 'priority', 'fast'].includes(result.serviceTier ?? ''))
          return fallback('invalid-response');
        diagnostic.serviceTier = result.serviceTier;
      }
      const measuredCost = callCost(
        limits.LLM_PROVIDER === 'openai' && result.serviceTier === 'default'
          ? {
              ...limits,
              LLM_INPUT_MICRODOLLARS_PER_MILLION: 100_000,
              LLM_OUTPUT_MICRODOLLARS_PER_MILLION: 500_000,
            }
          : limits,
        result.inputTokens,
        result.outputTokens,
      );
      if (!Number.isSafeInteger(measuredCost))
        return fallback('invalid-response');
      actual = measuredCost;
      diagnostic.inputTokens = result.inputTokens;
      diagnostic.outputTokens = result.outputTokens;
      if (
        result.reasoningTokens !== undefined &&
        Number.isSafeInteger(result.reasoningTokens) &&
        result.reasoningTokens >= 0 &&
        result.reasoningTokens <= result.outputTokens
      )
        diagnostic.reasoningTokens = result.reasoningTokens;
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
        promptVersion,
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
    }, SERVER_DEADLINE_MS);
  });
  let finished = false;
  const execution = execute()
    .catch(() =>
      fallback(
        abort.signal.aborted || Date.now() >= deadline
          ? 'timeout'
          : 'unavailable',
      ),
    )
    .finally(() => {
      finished = true;
    });
  const result = await Promise.race([execution, timeout]);
  clearTimeout(timer);
  diagnostic.outcome = result.outcome === 'success' ? 'success' : result.reason;
  diagnostic.latencyMs = Date.now() - started;
  const record =
    deps.diagnostic ??
    ((entry) => {
      if (env.LLM_DIAGNOSTICS_ENABLED === 'true')
        console.info(JSON.stringify(entry));
    });
  const snapshot = () => ({
    ...diagnostic,
    accountingFinal: finished,
    // Active() prevents any later dispatch after the response deadline.
    ...(!diagnostic.providerDispatched
      ? { inputTokens: 0, outputTokens: 0, costMicrodollars: 0 }
      : {}),
  });
  const emit = () => record(snapshot());
  emit();
  const responseHeaders = new Headers({
    ...headers,
    'x-recommendation-request-id': requestId,
  });
  if (authenticatedDiagnostics) {
    const parsed = DiagnosticSchema.safeParse(snapshot());
    if (parsed.success)
      responseHeaders.set(
        EVALUATION_DIAGNOSTIC_HEADER,
        JSON.stringify(parsed.data),
      );
  }
  // Keep abort/settlement work alive after returning the bounded browser response.
  // Late known usage updates accounting only; it never changes the displayed picks.
  if (!finished && deps.waitUntil) deps.waitUntil(execution.then(emit));
  return new Response(JSON.stringify(result), {
    status,
    headers: responseHeaders,
  });
}
