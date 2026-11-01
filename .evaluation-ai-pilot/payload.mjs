import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createDecipheriv, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { verify } from './driver.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const publicControl = JSON.parse(
  readFileSync('.evaluation-ai-pilot/control-public.json'),
);
if (process.argv[2] === 'check-approval') {
  const approval = JSON.parse(process.env.AI_PILOT_APPROVAL ?? '{}');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(String(approval.runNumber), process.env.GITHUB_RUN_NUMBER);
  assert.equal(approval.sourceSha, process.env.PILOT_SOURCE_SHA);
  assert.equal(approval.controlSha256, publicControl.controlSha256);
  assert.equal(approval.maxCalls, 40);
  assert.equal(approval.maxAdditionalMicrodollars, 262240);
  console.log('One-pass authorization verified. No candidate calls.');
} else if (process.argv[2] === 'decrypt') {
  const bytes = readFileSync('.evaluation-ai-pilot/payload.enc');
  assert.equal(hash(bytes), publicControl.payloadSha256);
  const key = Buffer.from(process.env.AI_PILOT_PAYLOAD_KEY ?? '', 'hex');
  assert.equal(key.length, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const plain = Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]);
  const root = process.argv[3];
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const archive = join(root, 'sealed.tar');
  writeFileSync(archive, plain, { mode: 0o600 });
  execFileSync('tar', ['-xf', archive, '-C', root]);
  assert.equal(
    hash(readFileSync(join(root, 'control.json'))),
    publicControl.controlSha256,
  );
  verify(root);
  console.log(
    'Payload and both candidate freezes verified. No candidate calls.',
  );
} else throw Error('Explicit payload mode required');
