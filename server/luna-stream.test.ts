// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readLunaStream } from './luna-stream';

function response(text: string, split = false) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of split ? [...text] : [text])
          controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }),
  );
}
describe('Luna terminal stream', () => {
  it('handles split CRLF frames and ignores partial text until the final response', async () => {
    const value = {
      status: 'completed',
      usage: { input_tokens: 100, output_tokens: 20 },
      output: [],
    };
    const text =
      ': keepalive\r\n\r\ndata: {"type":"response.output_text.delta","delta":"PRIVATE"}\r\n\r\nevent: response.completed\r\ndata: ' +
      JSON.stringify({ type: 'response.completed', response: value }) +
      '\r\n\r\n';
    expect(
      await readLunaStream(response(text, true), new AbortController().signal),
    ).toEqual(value);
  });
  it.each(['response.incomplete', 'response.failed'])(
    'preserves terminal %s usage for accounting',
    async (type) => {
      const value = {
        status: type.split('.')[1],
        usage: { input_tokens: 100, output_tokens: 20 },
      };
      expect(
        await readLunaStream(
          response(`data: ${JSON.stringify({ type, response: value })}\n\n`),
          new AbortController().signal,
        ),
      ).toEqual(value);
    },
  );
  it.each([
    'data: {"type":"response.output_text.done","text":"{}"}\n\n',
    'data: [DONE]\n\n',
    'data: {"type":"error","message":"PRIVATE"}\n\n',
    'data: {"type":"response.completed","response":{"status":"incomplete"}}\n\n',
  ])(
    'rejects nonterminal or inconsistent output without exposing text',
    async (text) => {
      await expect(
        readLunaStream(response(text), new AbortController().signal),
      ).rejects.not.toThrow('PRIVATE');
    },
  );
  it('aborts a stalled read even when transport cancellation never acknowledges', async () => {
    const abort = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      cancel: () => new Promise<void>(() => {}),
    });
    const pending = readLunaStream(new Response(stream), abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('bounds total bytes before accepting a terminal event', async () => {
    await expect(
      readLunaStream(
        response('x'.repeat(262145)),
        new AbortController().signal,
      ),
    ).rejects.toThrow('too large');
  });
});
