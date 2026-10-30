import {
  DiagnosticSchema,
  EVALUATION_DIAGNOSTIC_HEADER,
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

// This credential is scoped to the approved endpoint. Never send it to the Sheet,
// another origin, a redirect, or a provider. Only the fixed diagnostic schema is saved.
export function evaluationFetch(
  endpoint: string,
  key: string,
  record: (entry: EvaluationDiagnostic) => void,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  if (!/^[a-f0-9]{64}$/.test(key))
    throw new Error('Invalid evaluation credential');
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== endpoint || init?.method !== 'POST')
      return fetcher(input, init);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${key}`);
    const response = await fetcher(input, {
      ...init,
      headers,
      redirect: 'error',
    });
    const value = response.headers.get(EVALUATION_DIAGNOSTIC_HEADER);
    if (!value || value.length > 4096)
      throw new Error('Missing bounded evaluation diagnostic');
    const parsed = DiagnosticSchema.parse(JSON.parse(value));
    if (
      parsed.requestId !== response.headers.get('x-recommendation-request-id')
    )
      throw new Error('Evaluation diagnostic request mismatch');
    record(parsed);
    return response;
  };
}
