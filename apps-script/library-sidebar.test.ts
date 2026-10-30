import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('keeps publish disabled while queued and exposes only a validated GitHub job link', () => {
  const elements: Record<
    string,
    {
      disabled: boolean;
      hidden: boolean;
      textContent: string;
      href: string;
      onclick?: () => void;
    }
  > = Object.fromEntries(
    ['publish', 'check', 'status', 'run'].map((id) => [
      id,
      { disabled: false, hidden: false, textContent: '', href: '' },
    ]),
  );
  let success: (result: unknown) => void = () => {};
  let requests = 0;
  const rpc = {
    withSuccessHandler: (handler: typeof success) => {
      success = handler;
      return rpc;
    },
    withFailureHandler: () => rpc,
    libraryPublishStatus: () => {
      requests++;
    },
    publishLibrary: () => {
      requests++;
    },
  };
  const html = readFileSync('apps-script/LibraryPublisher.html', 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, {
    document: { getElementById: (id: string) => elements[id] },
    google: { script: { run: rpc } },
  });
  expect(requests).toBe(1);
  success({ ok: true, status: 'idle' });
  elements.publish.onclick!();
  expect(elements.publish.disabled).toBe(true);
  success({ ok: true, status: 'queued', runUrl: 'javascript:alert(1)' });
  expect(elements.publish.disabled).toBe(true);
  expect(elements.check.disabled).toBe(false);
  expect(elements.run.hidden).toBe(true);
  elements.check.onclick!();
  success({
    ok: true,
    status: 'succeeded',
    runUrl: 'https://github.com/example/repo/actions/runs/123',
  });
  expect(elements.publish.disabled).toBe(false);
  expect(elements.status.textContent).toContain('Published successfully');
  expect(elements.run.hidden).toBe(false);
});
