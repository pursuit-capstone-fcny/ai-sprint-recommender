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
const assessment = (position: number, grade = 0, extra = {}) => ({
  position,
  rationale: 'Mismatch.',
  grade,
  quote: null,
  rank: null,
  ...extra,
});
const allZero = () => rows.map((row) => assessment(row.position));
const quoted = (position: number) => rows[position].description.slice(10, 60);

describe('catalog grader request', () => {
  it('sends all 89 public rows, the goal and the noWork-first schema without IDs', () => {
    const data = JSON.parse(request.messages[0].content);
    expect(data.catalog).toHaveLength(89);
    expect(data.goal).toBe(benchmark.profiles[1].input.goal);
    for (const id of ids) expect(JSON.stringify(request)).not.toContain(id);
    const schema = request.output_config.format.schema;
    expect(Object.keys(schema.properties)).toEqual(['noWork', 'assessments']);
    expect(schema.required).toEqual(['noWork', 'assessments']);
    expect(Object.keys(schema.properties.assessments.items.properties)).toEqual(
      ['position', 'rationale', 'grade', 'quote', 'rank'],
    );
    expect(request.system).toBe(GRADER_SYSTEM_PROMPT);
    expect(request.system).toContain(
      'one assessment for EACH catalog position',
    );
    expect(request.thinking).toEqual({ type: 'disabled' });
  });
});

describe('reading grades', () => {
  it('treats noWork as an empty list and ignores any assessments sent with it', () => {
    expect(
      readGrades({ noWork: true, assessments: allZero() }, rows, ids),
    ).toEqual({ status: 'no-work', ignoredAssessments: 89, youtubeIds: [] });
  });
  it('orders grade 3 before 2, then rank, then position, at most eight', () => {
    const assessments = allZero();
    assessments[5] = assessment(5, 2, { quote: quoted(5), rank: 1 });
    assessments[9] = assessment(9, 3, { quote: quoted(9), rank: 2 });
    assessments[3] = assessment(3, 3, { quote: quoted(3), rank: 1 });
    for (const position of [20, 21, 22, 23, 24, 25, 26])
      assessments[position] = assessment(position, 2, {
        quote: quoted(position),
        rank: null,
      });
    const result = readGrades({ noWork: false, assessments }, rows, ids);
    expect(result.status).toBe('graded');
    expect(result.youtubeIds).toEqual(
      [3, 9, 5, 20, 21, 22, 23, 24].map((position) => ids[position]),
    );
  });
  it('drops a grade 2-3 pick whose quote is not in that description', () => {
    const assessments = allZero();
    assessments[4] = assessment(4, 3, { quote: quoted(5), rank: 1 });
    assessments[6] = assessment(6, 2, { quote: quoted(6), rank: 2 });
    const result = readGrades({ noWork: false, assessments }, rows, ids);
    expect(result).toMatchObject({
      status: 'graded',
      quoteFailures: 1,
      youtubeIds: [ids[6]],
    });
  });
  it('rejects a missing or repeated position instead of guessing', () => {
    const missing = allZero().slice(1);
    expect(
      readGrades({ noWork: false, assessments: missing }, rows, ids),
    ).toMatchObject({ status: 'invalid', missing: 1 });
    const repeated = [...allZero(), assessment(0)];
    expect(
      readGrades({ noWork: false, assessments: repeated }, rows, ids),
    ).toMatchObject({ status: 'invalid', repeated: 1 });
    expect(readGrades({ assessments: [] }, rows, ids)).toMatchObject({
      status: 'invalid',
      reason: 'schema',
    });
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
  it('prices measured usage at the approved Haiku rates', () => {
    expect(graderCost(18_000, 4_000)).toBe(3_800);
  });
});
