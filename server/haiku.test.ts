// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../wrangler.evaluation.json';
import { parseBenchmark } from '../src/evaluation/benchmark';
import { injectionProbes } from '../src/evaluation/injection-probes';
import { providerBody, inputTokenBound } from './anthropic';
import { readLimits, callCost } from './config';
import { haikuDeployedBody } from './haiku';
import { lunaDeployedBody } from './luna';
import { HAIKU_DEPLOYED_RESERVATION } from './haiku-policy';

describe('optimized Haiku low request', () => {
  it('preserves the frozen catalog and Luna ranking policy with only the required-slot protocol changed', () => {
    const benchmark = parseBenchmark(
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-28-task-tags/benchmark.json',
          'utf8',
        ),
      ),
    );
    const limits = readLimits(config.vars)!;
    expect(limits).not.toBeNull();
    expect(
      callCost(
        limits,
        limits.LLM_MAX_INPUT_TOKENS,
        limits.LLM_MAX_OUTPUT_TOKENS,
      ),
    ).toBe(HAIKU_DEPLOYED_RESERVATION);
    for (const profile of [
      ...benchmark.profiles,
      ...injectionProbes(benchmark),
    ]) {
      const original = providerBody(
        { ...profile.input, catalogVersion: benchmark.catalog.catalogVersion },
        benchmark.catalog,
        limits,
      );
      const haiku = haikuDeployedBody(original);
      const luna = lunaDeployedBody(original);
      expect(haiku.request.messages[0].content).toBe(luna.input[1].content);
      const data = JSON.parse(haiku.request.messages[0].content);
      expect(data.catalog).toHaveLength(89);
      expect(
        data.catalog.map((row: unknown[]) =>
          Object.fromEntries(
            data.catalogFields.map((field: string, i: number) => [
              field,
              row[i],
            ]),
          ),
        ),
      ).toEqual(original.data.catalog);
      expect(data.goal).toBe(profile.input.goal);
      expect(haiku.catalogIds).toEqual(original.catalogIds);
      expect(haiku.request.output_config).toEqual(
        original.request.output_config,
      );
      expect(haiku.request.max_tokens).toBe(512);
      expect(haiku.request.thinking).toEqual({ type: 'disabled' });
      expect(haiku.request.output_config.effort).toBe('low');
      expect(inputTokenBound(haiku)).toBeLessThanOrEqual(
        limits.LLM_MAX_INPUT_TOKENS,
      );
      expect(inputTokenBound(haiku)).toBeLessThan(inputTokenBound(original));
      const normalized = haiku.request.system
        .replace(
          'use null in all eight ranks',
          'return an empty positions array',
        )
        .replace(
          'Return exactly the eight named fields rank1 through rank8, best match first. Put a distinct catalog position in each useful rank and null in every unused rank. Select six to eight useful videos when available.',
          'Return one positions array containing six to eight useful, distinct catalog positions when available, best match first.',
        )
        .replace('all nulls when none fit', 'an empty array when none fit');
      expect(normalized).toBe(luna.input[0].content);
      expect(haiku.request.system).not.toContain('positions array');
    }
  });
});
