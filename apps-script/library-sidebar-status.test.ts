import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('updates the visible publication message when the host has a DOMString window.status', () => {
  const message = { textContent: 'Ready to check publication status.' };
  const nodes = {
    publish: {},
    check: {},
    status: message,
    run: {},
    review: {},
    changes: {},
  };
  const rpc = {
    withSuccessHandler: (handler: (value: unknown) => void) => {
      rpc.success = handler;
      return rpc;
    },
    withFailureHandler: () => rpc,
    libraryPublishStatus: () => rpc.success({ ok: true, status: 'succeeded' }),
    success: (value: unknown) => {
      void value;
    },
  };
  const context = {
    document: { getElementById: (id: keyof typeof nodes) => nodes[id] },
    google: { script: { run: rpc } },
  };
  let windowStatus = '';
  Object.defineProperty(context, 'status', {
    configurable: true,
    get: () => windowStatus,
    set: (value: unknown) => {
      windowStatus = String(value);
    },
  });
  const script = readFileSync(
    'apps-script/LibraryPublisher.html',
    'utf8',
  ).match(/<script>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, context);
  expect(message.textContent).toContain('Published successfully');
  expect(windowStatus).toBe('');
});
