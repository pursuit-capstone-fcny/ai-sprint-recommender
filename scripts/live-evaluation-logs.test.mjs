import { describe, it, expect } from 'vitest';
import {
  createDiagnosticStream,
  diagnosticsFromEnvelope,
  hasReadyDiagnostic,
} from './live-evaluation-logs.mjs';

const diagnostic = {
  requestId: 'bb26fc6e-9dc3-48c4-bcf0-89cb752b3ec4',
  environment: 'test',
  outcome: 'success',
  latencyMs: 250,
  inputTokens: 200,
  outputTokens: 20,
  costMicrodollars: 100,
  reservedMicrodollars: 500,
  catalogVersion: `sha256:${'a'.repeat(64)}`,
  modelVersion: 'claude-haiku-5-5',
  promptVersion: 'catalog-rank-v2',
};
function envelope(candidate = diagnostic) {
  return {
    event: {
      request: {
        headers: {
          authorization: 'PRIVATE_TOKEN',
          'cf-connecting-ip': '192.0.2.1',
        },
        url: 'https://example.test/?goal=PRIVATE_GOAL',
      },
    },
    exceptions: [{ message: 'PRIVATE_EXCEPTION' }],
    logs: [
      { level: 'info', message: [JSON.stringify(candidate)] },
      { level: 'error', message: ['PRIVATE_LOG'] },
    ],
  };
}

describe('sanitized evaluation tail', () => {
  it('accepts a delayed earlier probe after the next probe was sent', () => {
    const firstId = diagnostic.requestId;
    const laterId = 'f976a1c4-1bd9-4ca7-8401-deb88bc46eb1';
    const observed = new Map([
      [firstId, { ...diagnostic, outcome: 'disabled' }],
    ]);
    expect(
      hasReadyDiagnostic(observed, new Set([firstId, laterId]), 'disabled'),
    ).toBe(true);
    expect(hasReadyDiagnostic(observed, new Set([laterId]), 'disabled')).toBe(
      false,
    );
    expect(
      hasReadyDiagnostic(observed, new Set([firstId]), 'not-requested'),
    ).toBe(false);
  });
  it('keeps only bounded diagnostic fields, never headers, IPs, exceptions or unknown fields', () => {
    const entries = diagnosticsFromEnvelope(
      envelope({
        ...diagnostic,
        headers: { secret: 'PRIVATE_TOKEN' },
        goal: 'PRIVATE_GOAL',
        ip: '192.0.2.1',
      }),
    );
    expect(entries).toEqual([diagnostic]);
    const saved = JSON.stringify(entries);
    for (const secret of [
      'PRIVATE_TOKEN',
      'PRIVATE_GOAL',
      '192.0.2.1',
      'PRIVATE_EXCEPTION',
      'PRIVATE_LOG',
      'headers',
    ])
      expect(saved).not.toContain(secret);
  });
  it('parses concatenated pretty JSON split at every character, including escaped braces', () => {
    const entries = [];
    const stream = createDiagnosticStream((entry) => entries.push(entry));
    const first = envelope();
    first.event.request.headers['arbitrary'] = '\\"{[]}';
    const text = `ignored banner\n${JSON.stringify(first, null, 4)}\n${JSON.stringify(envelope(), null, 4)}\n`;
    for (const character of text) stream.push(character);
    expect(entries).toEqual([diagnostic, diagnostic]);
  });
  it('ignores unrelated messages and rejects invalid or production diagnostic fields', () => {
    for (const candidate of [
      { ...diagnostic, environment: 'production' },
      { ...diagnostic, outcome: 'PRIVATE_GOAL' },
      { ...diagnostic, modelVersion: 'private text with spaces' },
      { ...diagnostic, costMicrodollars: -1 },
      { ...diagnostic, requestId: 'PRIVATE_TOKEN' },
      { ...diagnostic, catalogVersion: 'PRIVATE_GOAL' },
    ]) {
      expect(diagnosticsFromEnvelope(envelope(candidate))).toEqual([]);
    }
    expect(
      diagnosticsFromEnvelope({
        logs: [
          {
            level: 'info',
            message: [
              'ordinary log',
              '{bad json',
              'null',
              '[]',
              'x'.repeat(5_000),
            ],
          },
        ],
      }),
    ).toEqual([]);
    expect(
      diagnosticsFromEnvelope({
        logs: [{ level: 'error', message: [JSON.stringify(diagnostic)] }],
      }),
    ).toEqual([]);
  });
  it('bounds incomplete records and throws only a generic error', () => {
    const stream = createDiagnosticStream(() => {}, 40);
    expect(() =>
      stream.push('{"secret":"PRIVATE_TOKEN' + 'x'.repeat(100)),
    ).toThrow('bounded parser limit');
  });
  it('discards malformed envelopes and continues to the next valid object', () => {
    const entries = [];
    const stream = createDiagnosticStream((entry) => entries.push(entry));
    stream.push('{"logs":broken}\n');
    stream.push(JSON.stringify(envelope()));
    expect(entries).toEqual([diagnostic]);
  });
  it('reports only bounded counters and fixed shape labels for missing diagnostics', () => {
    const stream = createDiagnosticStream(() => {});
    const sample = envelope();
    sample.logs.push({
      level: 'PRIVATE_LOG_LEVEL',
      message: [{ secret: 'PRIVATE_TOKEN' }, 42, null],
    });
    sample.logs.push({ level: 'log', message: 'PRIVATE_GOAL' });
    const text = JSON.stringify(sample, null, 4);
    stream.push(text);
    const counts = stream.snapshot();
    expect(counts).toMatchObject({
      stdoutBytes: Buffer.byteLength(text, 'utf8'),
      envelopes: 1,
      acceptedDiagnostics: 1,
      logs: 4,
      logLevels: { info: 1, error: 1, log: 1, other: 1 },
      messageContainers: { array: 3, string: 1 },
      messageValues: { string: 2, object: 1, number: 1, null: 1 },
    });
    expect(JSON.stringify(counts)).not.toMatch(
      /PRIVATE|192\.0\.2\.1|authorization/,
    );
    counts.envelopes = 99;
    expect(stream.snapshot().envelopes).toBe(1);
  });
});
