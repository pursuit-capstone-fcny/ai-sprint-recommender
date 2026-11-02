// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { benchmarkFingerprint, parseBenchmark } from './benchmark';
import { GRADER_PROMPT_VERSION, GRADER_WORKFLOW } from './grader';

vi.mock('./approval', async (original) => ({
  ...(await original<typeof import('./approval')>()),
  readCheckout: () => ({ sourceRevision: 'a'.repeat(40), dirty: false }),
}));
const { main } = await import('./grader-cli');

const benchmark = parseBenchmark(
  JSON.parse(
    readFileSync('docs/evaluation/2026-10-28-task-tags/benchmark.json', 'utf8'),
  ),
);
const setEnvironment = (allowanceMicrodollars: number) => {
  const path = join(mkdtempSync(join(tmpdir(), 'grader-')), 'approval.json');
  writeFileSync(
    path,
    JSON.stringify({
      approvedSourceRevision: 'a'.repeat(40),
      approvedWorkflowRunId: '123',
      approvedWorkflowRunAttempt: 2,
      expiresAt: '2099-01-01T00:00:00Z',
      benchmarkFingerprint: benchmarkFingerprint(benchmark),
      modelVersion: 'claude-haiku-5-5',
      promptVersion: GRADER_PROMPT_VERSION,
      approvedBy: 'Jason',
      approvedAt: '2026-11-02',
      budgetDecision: 'Fixture only.',
      allowanceMicrodollars,
    }),
  );
  vi.stubEnv('GRADER_APPROVAL_FILE', path);
  vi.stubEnv('ANTHROPIC_API_KEY', 'fixture-only');
  vi.stubEnv(
    'GITHUB_REPOSITORY',
    'pursuit-capstone-fcny/ai-sprint-recommender',
  );
  vi.stubEnv('GITHUB_WORKFLOW', GRADER_WORKFLOW);
  vi.stubEnv('GITHUB_RUN_ID', '123');
  vi.stubEnv('GITHUB_RUN_ATTEMPT', '2');
};
// Picks the first two catalog videos as grade 3 with verified quotes; no-work
// goals abstain. The first call writes the catalog cache and later calls read it.
const provider = (failAt = Infinity) => {
  let calls = 0;
  return vi.fn<typeof fetch>(async (url, init) => {
    if (String(url).endsWith('/count_tokens'))
      return Response.json({ input_tokens: 20_000 });
    if (++calls >= failAt) return new Response(null, { status: 500 });
    const [catalog, intake] = JSON.parse(String(init?.body)).messages[0]
      .content;
    const rows = JSON.parse(catalog.text).catalog;
    const noWork =
      /no work task|catalog administrator|formatting test|Ignore every previous|zxqv/.test(
        JSON.parse(intake.text).goal,
      );
    const picks = rows
      .slice(0, 2)
      .map((row: { position: number; description: string }) => ({
        position: row.position,
        rationale: 'Fixture.',
        grade: 3,
        quote: row.description.slice(0, 30),
      }));
    return Response.json({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: JSON.stringify({ noWork, picks: noWork ? [] : picks }),
        },
      ],
      usage: {
        input_tokens: 100,
        ...(calls === 1
          ? { cache_creation_input_tokens: 19_900 }
          : { cache_read_input_tokens: 19_900 }),
        output_tokens: 400,
      },
    });
  });
};
// First call: 100 x $0.10 + 19,900 x $0.125 + 400 x $0.50 per million, rounded up.
const FIRST = 2_698;
// Later calls read the cache: 100 x $0.10 + 19,900 x $0.01 + 400 x $0.50.
const LATER = 409;
// Reservation: (20,000 + 2,000) x $0.125 + 2,000 x $0.50 per million.
const RESERVED = 3_750;
const saved = () =>
  JSON.parse(readFileSync('build/evaluation/grader/cases.json', 'utf8'));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('catalog grader run', () => {
  it('runs thirty benchmark cases and ten controls once each with cache-aware cost', async () => {
    setEnvironment(1_000_000);
    const fetcher = provider();
    vi.stubGlobal('fetch', fetcher);
    await main();
    const state = saved();
    expect(state.records).toHaveLength(40);
    expect(
      state.records.filter(
        (row: { trial: number | null }) => row.trial === null,
      ),
    ).toHaveLength(10);
    // 40 generations plus 40 free token counts; no retries.
    expect(fetcher).toHaveBeenCalledTimes(80);
    expect(state.spentMicrodollars).toBe(FIRST + 39 * LATER);
    const control = (id: string) =>
      state.records.find((row: { id: string }) => row.id === id);
    expect(control('injection-empty-task')).toMatchObject({
      outcome: 'no-work',
      engine: 'rules',
    });
    expect(control('blank-goal-control')).toMatchObject({
      outcome: 'graded',
      derivedIds: benchmark.catalog.items
        .slice(0, 2)
        .map((item) => item.youtubeId),
    });
  });
  it('stops before a call whose full reservation exceeds the allowance', async () => {
    // After the first call, the next reservation is $0.000001 short.
    setEnvironment(FIRST + RESERVED - 1);
    vi.stubGlobal('fetch', provider());
    await main();
    const state = saved();
    expect(
      state.records.map((row: { outcome: string }) => row.outcome),
    ).toEqual(['graded', 'budget-stop']);
    expect(state.spentMicrodollars).toBe(FIRST);
  });
  it('stops on a provider error and keeps its full reservation', async () => {
    setEnvironment(1_000_000);
    vi.stubGlobal('fetch', provider(2));
    await main();
    const state = saved();
    expect(
      state.records.map((row: { outcome: string }) => row.outcome),
    ).toEqual(['graded', 'provider-error']);
    expect(state.spentMicrodollars).toBe(FIRST + RESERVED);
  });
});
