// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const script = fileURLToPath(
  new URL('./configure-library-app.mjs', import.meta.url),
);
const base = await readFile(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
);
async function configure(overrides, check) {
  const directory = await mkdtemp(join(tmpdir(), 'backend-config-'));
  try {
    await writeFile(join(directory, 'wrangler.jsonc'), base);
    const run = () =>
      execFileSync(process.execPath, [script], {
        cwd: directory,
        env: {
          PATH: process.env.PATH,
          VITE_USAGE_ENVIRONMENT: 'production',
          VITE_USAGE_ENABLED: 'true',
          VITE_USAGE_BUFFER_ENABLED: 'true',
          VITE_USAGE_PRODUCTION_URL:
            'https://script.google.com/macros/s/fixture/exec',
          VITE_LIBRARY_ORIGIN: 'https://library.example.org',
          ...overrides,
        },
        stdio: 'pipe',
      });
    await check(run, () =>
      readFile(join(directory, 'wrangler.library.jsonc'), 'utf8'),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

it.each([
  {},
  {
    USAGE_BATCH_SECRET: 'x'.repeat(32),
    VITE_USAGE_PRODUCTION_URL: 'https://untrusted.example.org/exec',
  },
])(
  'fails before deployment when the buffer lacks a valid server configuration',
  async (overrides) => {
    await configure(overrides, async (run, output) => {
      expect(run).toThrow();
      await expect(output()).rejects.toMatchObject({ code: 'ENOENT' });
    });
  },
);

it('configures the burst backend without serializing its secret or raising spending caps', async () => {
  const secret = 'fictional-test-credential-only'.repeat(2);
  await configure({ USAGE_BATCH_SECRET: secret }, async (run, output) => {
    run();
    const text = await output();
    expect(text).not.toContain(secret);
    expect(JSON.parse(text).vars).toMatchObject({
      USAGE_BUFFER_ENABLED: 'true',
      LLM_ENABLED: 'false',
      LLM_QUEUE_ENABLED: 'true',
      LLM_DAILY_MICRODOLLARS: '1000000',
      LLM_MONTHLY_MICRODOLLARS: '5000000',
    });
  });
});
