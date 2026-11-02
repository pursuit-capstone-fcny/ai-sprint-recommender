// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBenchmark, benchmarkFingerprint } from './benchmark';
import {
  GRADER_PROMPT_VERSION,
  GRADER_SYSTEM_PROMPT,
  GRADER_WORKFLOW,
  graderCost,
  graderRequest,
  readGrades,
  validateGraderApproval,
} from './grader';

const benchmark = parseBenchmark(
  JSON.parse(
    readFileSync('docs/evaluation/2026-10-28-task-tags/benchmark.json', 'utf8'),
  ),
);
const ids = benchmark.catalog.items.map((item) => item.youtubeId);
const { rows, request } = graderRequest(
  benchmark.profiles[1].input,
  benchmark.catalog,
);
const quoted = (position: number) => rows[position].description.slice(10, 60);
const pick = (position: number, grade: 2 | 3, quote = quoted(position)) => ({
  position,
  rationale: 'Fixture.',
  grade,
  quote,
});

describe('catalog grader request', () => {
  it('caches the catalog, sends the request last and asks only for useful picks', () => {
    const [catalog, intake] = request.messages[0].content;
    expect(catalog.cache_control).toEqual({ type: 'ephemeral' });
    expect(JSON.parse(catalog.text).catalog).toHaveLength(89);
    expect(JSON.parse(intake.text)).toEqual(benchmark.profiles[1].input);
    expect('cache_control' in intake).toBe(false);
    for (const id of ids) expect(JSON.stringify(request)).not.toContain(id);
    const schema = request.output_config.format.schema;
    expect(Object.keys(schema.properties)).toEqual(['noWork', 'picks']);
    expect(schema.properties.picks.items.properties.grade.enum).toEqual([2, 3]);
    expect(request.max_tokens).toBe(2_000);
    expect(request.system).toBe(GRADER_SYSTEM_PROMPT);
    expect(request.system).toContain('A blank goal is not no-work');
    expect(request.system).not.toContain('EACH catalog position');
  });
});

describe('reading grades', () => {
  it('treats noWork as an empty list', () => {
    expect(
      readGrades({ noWork: true, picks: [pick(1, 3)] }, rows, ids),
    ).toEqual({ status: 'no-work', ignoredPicks: 1, youtubeIds: [] });
  });
  it('orders grade 3 before 2, then emitted order, and keeps at most eight', () => {
    const picks = [
      pick(5, 2),
      pick(9, 3),
      pick(3, 3),
      ...[20, 21, 22, 23, 24, 25].map((position) => pick(position, 2)),
    ];
    const result = readGrades({ noWork: false, picks }, rows, ids);
    expect(result.youtubeIds).toEqual(
      [9, 3, 5, 20, 21, 22, 23, 24].map((position) => ids[position]),
    );
  });
  it('drops a pick whose quote is not in that description and a repeated pick', () => {
    const result = readGrades(
      {
        noWork: false,
        picks: [pick(4, 3, quoted(5)), pick(6, 2), pick(6, 3)],
      },
      rows,
      ids,
    );
    expect(result).toMatchObject({
      status: 'graded',
      quoteFailures: 1,
      repeated: 1,
      youtubeIds: [ids[6]],
    });
  });
  it('rejects malformed output and out-of-range positions', () => {
    expect(readGrades({ picks: [] }, rows, ids)).toMatchObject({
      status: 'invalid',
      reason: 'schema',
    });
    expect(
      readGrades(
        { noWork: false, picks: [pick(0, 3), { ...pick(0, 3), position: 89 }] },
        rows,
        ids,
      ),
    ).toMatchObject({ status: 'invalid', reason: 'out-of-range' });
  });
});

describe('grader approval and cost', () => {
  const approval = {
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
    allowanceMicrodollars: 300_000,
  };
  const environment = {
    GITHUB_REPOSITORY: 'pursuit-capstone-fcny/ai-sprint-recommender',
    GITHUB_WORKFLOW: GRADER_WORKFLOW,
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '2',
  };
  const checkout = { sourceRevision: 'a'.repeat(40), dirty: false };
  it('binds approval to the clean source and exact workflow attempt', () => {
    expect(
      validateGraderApproval(benchmark, approval, checkout, environment),
    ).toMatchObject({ allowanceMicrodollars: 300_000 });
    for (const [changedCheckout, changedEnvironment] of [
      [{ ...checkout, dirty: true }, environment],
      [checkout, { ...environment, GITHUB_RUN_ATTEMPT: '1' }],
      [checkout, { ...environment, GITHUB_WORKFLOW: 'Other' }],
    ] as const)
      expect(() =>
        validateGraderApproval(
          benchmark,
          approval,
          changedCheckout,
          changedEnvironment,
        ),
      ).toThrow();
  });
  it('prices cache writes at 1.25x and cache reads at 0.1x input', () => {
    expect(graderCost({ input_tokens: 18_000, output_tokens: 4_000 })).toBe(
      3_800,
    );
    expect(
      graderCost({
        input_tokens: 100,
        cache_creation_input_tokens: 16_000,
        output_tokens: 500,
      }),
    ).toBe(10 + 2_000 + 250);
    expect(
      graderCost({
        input_tokens: 100,
        cache_read_input_tokens: 16_000,
        output_tokens: 500,
      }),
    ).toBe(10 + 160 + 250);
  });
});
