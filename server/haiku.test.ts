// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import v11 from '../docs/evaluation/2026-10-30-haiku-guardrails/v11-request-hashes.json';
import v18 from '../docs/evaluation/2026-10-30-haiku-reliability/v18-request-hashes.json';
import v12 from '../docs/evaluation/2026-10-30-haiku-breadth/v12-request-hashes.json';
import { describe, expect, it } from 'vitest';
import config from '../wrangler.evaluation.json';
import { parseBenchmark } from '../src/evaluation/benchmark';
import { injectionProbes } from '../src/evaluation/injection-probes';
import { providerBody, inputTokenBound } from './anthropic';
import { readLimits, callCost } from './config';
import { haikuDeployedBody } from './haiku';
import { lunaDeployedBody } from './luna';
import { LUNA_TARGETED_RANKING_INSTRUCTION } from './luna-policy';
import {
  HAIKU_DEPLOYED_RESERVATION,
  HAIKU_FINAL_CHECK_INSTRUCTION,
  HAIKU_BREADTH_INSTRUCTION,
  HAIKU_BROWSING_INSTRUCTION,
  HAIKU_MIXED_GOAL_INSTRUCTION,
} from './haiku-policy';

describe('optimized Haiku low request', () => {
  it('adds breadth and blank browsing guidance while preserving V12 guardrails, prior requests and frozen catalog data', () => {
    const benchmark = parseBenchmark(
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-28-task-tags/benchmark.json',
          'utf8',
        ),
      ),
    );
    const limits = readLimits(config.vars)!;
    expect(Object.keys(v11.hashes)).toEqual(
      benchmark.profiles.map((profile) => profile.id),
    );
    expect(Object.keys(v12.hashes)).toEqual(Object.keys(v11.hashes));
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
      expect(
        haiku.request.system
          .replace(` ${HAIKU_MIXED_GOAL_INSTRUCTION}`, '')
          .endsWith(` ${HAIKU_FINAL_CHECK_INSTRUCTION}`),
      ).toBe(true);
      if (profile.input.goal.trim()) {
        expect(haiku.request.system).not.toContain(HAIKU_BROWSING_INSTRUCTION);
        expect(haiku.request.system).toContain(` ${HAIKU_BREADTH_INSTRUCTION}`);
        expect(
          haiku.request.system.indexOf(HAIKU_BREADTH_INSTRUCTION),
        ).toBeLessThan(
          haiku.request.system.indexOf(LUNA_TARGETED_RANKING_INSTRUCTION),
        );
      } else {
        expect(haiku.request.system).not.toContain(HAIKU_BREADTH_INSTRUCTION);
        expect(haiku.request.system).toContain(
          ` ${HAIKU_BROWSING_INSTRUCTION}`,
        );
      }
      const v18System = haiku.request.system.replace(
        ` ${HAIKU_MIXED_GOAL_INSTRUCTION}`,
        '',
      );
      const v18Hash = Object.entries(v18.hashes).find(
        ([id]) => id === profile.id,
      )?.[1];
      if (v18Hash)
        expect(
          createHash('sha256')
            .update(JSON.stringify({ ...haiku.request, system: v18System }))
            .digest('hex'),
        ).toBe(v18Hash);
      if (profile.input.goal.trim()) {
        expect(
          haiku.request.system.indexOf(HAIKU_MIXED_GOAL_INSTRUCTION),
        ).toBeGreaterThan(
          haiku.request.system.indexOf('Final selection procedure'),
        );
        expect(haiku.request.system).toContain(
          ` ${HAIKU_MIXED_GOAL_INSTRUCTION}`,
        );
      } else
        expect(haiku.request.system).not.toContain(
          HAIKU_MIXED_GOAL_INSTRUCTION,
        );
      const v12System = v18System
        .replace(` ${HAIKU_BREADTH_INSTRUCTION}`, '')
        .replace(` ${HAIKU_BROWSING_INSTRUCTION}`, '');
      const v12Hash = Object.entries(v12.hashes).find(
        ([id]) => id === profile.id,
      )?.[1];
      if (v12Hash)
        expect(
          createHash('sha256')
            .update(JSON.stringify({ ...haiku.request, system: v12System }))
            .digest('hex'),
        ).toBe(v12Hash);
      const v11System = v12System.replace(
        ` ${HAIKU_FINAL_CHECK_INSTRUCTION}`,
        '',
      );
      const expectedHash = Object.entries(v11.hashes).find(
        ([id]) => id === profile.id,
      )?.[1];
      if (expectedHash)
        expect(
          createHash('sha256')
            .update(JSON.stringify({ ...haiku.request, system: v11System }))
            .digest('hex'),
        ).toBe(expectedHash);
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
      const normalized = v11System
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
