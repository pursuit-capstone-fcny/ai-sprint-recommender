import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';
import { projectLibraryOrigin } from '../library/project.ts';
import { loadEnv } from 'vite';
const base = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  await readFile('wrangler.jsonc', 'utf8'),
);
if (base.error) throw new Error('Invalid Worker config');
const configured = projectLibraryOrigin({
  ...loadEnv('production', process.cwd(), ''),
  ...process.env,
});
const config = {
  ...base.config,
  vars: {
    ...base.config.vars,
    LIBRARY_ORIGIN: configured ? configured : 'https://library-demo.invalid',
    LIBRARY_MODE: configured ? 'published' : 'bundled',
  },
};
await writeFile(
  'wrangler.library.jsonc',
  JSON.stringify(config, null, 2) + '\n',
);
