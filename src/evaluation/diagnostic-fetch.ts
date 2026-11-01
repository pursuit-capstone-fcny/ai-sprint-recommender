import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  DiagnosticSchema,
  EVALUATION_DIAGNOSTIC_HEADER,
  EVALUATION_REQUEST_HEADER,
  type EvaluationDiagnostic,
} from '../contracts/evaluationDiagnostic';

export function mergeDiagnostic(
  records: Map<string, EvaluationDiagnostic>,
  entry: EvaluationDiagnostic,
) {
  const previous = records.get(entry.requestId);
  if (previous?.accountingFinal && !entry.accountingFinal) return;
  if (
    previous?.costMicrodollars !== undefined &&
    entry.costMicrodollars === undefined
  )
    return;
  records.set(entry.requestId, entry);
}

export interface TransportFailure {
  requestId: string;
  phase: 'transport' | 'diagnostic';
  kind:
    | 'network'
    | 'timeout'
    | 'missing-header'
    | 'invalid-header'
    | 'request-mismatch';
  code?: string;
  status: number | null;
  latencyMs: number;
}

export class EvaluationRequestError extends Error {
  readonly requestId: string;
  constructor(readonly diagnostic: TransportFailure) {
    super(`Evaluation request failed: ${diagnostic.kind}`);
    this.name =
      diagnostic.kind === 'timeout' ? 'TimeoutError' : 'EvaluationRequestError';
    this.requestId = diagnostic.requestId;
  }
}

const networkCodes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);
function networkCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return;
  const source =
    'cause' in error && error.cause && typeof error.cause === 'object'
      ? error.cause
      : error;
  if (
    'code' in source &&
    typeof source.code === 'string' &&
    networkCodes.has(source.code)
  )
    return source.code;
}

// Only the exact approved endpoint gets credentials, fresh POST connections and
// correlation IDs. Never replay a POST or save raw errors, headers or bodies.
export function evaluationFetch(
  endpoint: string,
  key: string,
  record: (entry: EvaluationDiagnostic) => void,
  fetcher: typeof fetch = fetch,
  recordFailure: (entry: TransportFailure) => void = () => {},
): typeof fetch {
  if (!/^[a-f0-9]{64}$/.test(key))
    throw new Error('Invalid evaluation credential');
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== endpoint || init?.method !== 'POST')
      return fetcher(input, init);
    const started = performance.now();
    let requestId: string = randomUUID();
    let status: number | null = null;
    const fail = (
      phase: TransportFailure['phase'],
      kind: TransportFailure['kind'],
      code?: string,
    ): never => {
      const diagnostic: TransportFailure = {
        requestId,
        phase,
        kind,
        ...(code ? { code } : {}),
        status,
        latencyMs: Math.round(performance.now() - started),
      };
      recordFailure(diagnostic);
      throw new EvaluationRequestError(diagnostic);
    };
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${key}`);
    headers.set(EVALUATION_REQUEST_HEADER, requestId);
    headers.set('Connection', 'close');
    let response: Response;
    try {
      response = await fetcher(input, { ...init, headers, redirect: 'error' });
    } catch (error) {
      const timeout =
        error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name);
      return fail(
        'transport',
        timeout ? 'timeout' : 'network',
        networkCode(error),
      );
    }
    status = response.status;
    const responseId = z
      .uuid()
      .safeParse(response.headers.get('x-recommendation-request-id'));
    if (responseId.success) requestId = responseId.data;
    const value = response.headers.get(EVALUATION_DIAGNOSTIC_HEADER);
    if (!value) return fail('diagnostic', 'missing-header');
    let parsed: EvaluationDiagnostic;
    try {
      if (value.length > 4096) return fail('diagnostic', 'invalid-header');
      parsed = DiagnosticSchema.parse(JSON.parse(value));
    } catch (error) {
      if (error instanceof EvaluationRequestError) throw error;
      return fail('diagnostic', 'invalid-header');
    }
    if (!responseId.success || parsed.requestId !== responseId.data)
      return fail('diagnostic', 'request-mismatch');
    record(parsed);
    return response;
  };
}

// Save the failed case first; a rejected request/configuration must not be sent
// again for the next independent profile. No raw provider error is exposed.
export function assertProviderAcceptedRequest(
  diagnostic?: EvaluationDiagnostic,
) {
  if (diagnostic?.validationFailure === 'schema')
    throw new Error(
      'Provider response schema was rejected; stop before further paid calls.',
    );
  if ([400, 401, 403, 404, 422].includes(diagnostic?.providerHttpStatus ?? 0))
    throw new Error(
      'Provider rejected the request configuration; stop before further paid calls.',
    );
}

// Only this fixed all-blank intake can wait for deployment propagation. It
// returns before catalog reads, budget reservation and provider dispatch.
export async function fetchReadinessProbe(
  endpoint: string,
  catalogVersion: string,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<Response | null> {
  try {
    return await fetcher(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      body: JSON.stringify({
        functionArea: null,
        goal: '',
        tools: [],
        catalogVersion,
      }),
      signal,
    });
  } catch (error) {
    if (
      error instanceof EvaluationRequestError &&
      error.diagnostic.kind === 'missing-header' &&
      error.diagnostic.status === 200
    )
      return null;
    throw error;
  }
}
