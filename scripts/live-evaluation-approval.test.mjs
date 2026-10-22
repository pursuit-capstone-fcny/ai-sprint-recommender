// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('paid entry point approval checks', () => {
  it('rejects unapproved code before the CLI, wrapper or format mode starts network/tail', () => {
    const directory = mkdtempSync(join(tmpdir(), 'evaluation-entry-'));
    const marker = join(directory, 'network-attempt');
    const preload = join(directory, 'guard.mjs');
    const approvalPath = join(directory, 'approval.json');
    const source = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const approval = JSON.parse(
      readFileSync('docs/evaluation/2026-10-21/approval.json', 'utf8'),
    );
    approval.approvedSourceRevision = (
      source === 'a'.repeat(40) ? 'b' : 'a'
    ).repeat(40);
    approval.expiresAt = '2099-01-01T00:00:00Z';
    writeFileSync(approvalPath, JSON.stringify(approval));
    writeFileSync(
      preload,
      `
      import cp from 'node:child_process';
      import { writeFileSync } from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const block = () => { writeFileSync(${JSON.stringify(marker)}, 'network'); throw new Error('Network blocked by test'); };
      globalThis.fetch = block;
      const spawn = cp.spawn;
      cp.spawn = function(command, args, ...rest) {
        if (args?.some(value => String(value).includes('wrangler'))) return block();
        return spawn.call(this, command, args, ...rest);
      };
      syncBuiltinESMExports();
    `,
    );
    try {
      for (const args of [
        [
          'scripts/check-live-evaluation-approval.mjs',
          '--approval',
          approvalPath,
        ],
        ['scripts/run-live-evaluation.mjs', '--approval', approvalPath],
        [
          'scripts/run-live-evaluation.mjs',
          '--approval',
          approvalPath,
          '--diagnose-format',
        ],
        [
          'scripts/evaluate-recommendations.mjs',
          '--benchmark',
          'docs/evaluation/2026-10-21/benchmark.json',
          '--live-approval',
          approvalPath,
          '--allow-paid',
        ],
      ]) {
        const result = spawnSync(
          process.execPath,
          ['--import', preload, ...args],
          { encoding: 'utf8', timeout: 10_000 },
        );
        expect(result.status, args[0]).toBe(1);
        expect(existsSync(marker), args[0]).toBe(false);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
