import { z } from 'zod';

// Only terminal events contain authoritative output and usage. Never accept deltas.
const terminal = z.object({
  type: z.enum([
    'response.completed',
    'response.incomplete',
    'response.failed',
  ]),
  response: z.object({ status: z.string() }).passthrough(),
});

export async function readLunaStream(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing provider stream');
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) throw new Error('Provider stream ended before terminal usage');
      bytes += value.byteLength;
      if (bytes > 262_144) throw new Error('Provider stream too large');
      buffer += decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        if (data === '[DONE]') throw new Error('Missing terminal usage');
        const event = JSON.parse(data);
        if (event?.type === 'error') throw new Error('Provider stream error');
        const parsed = terminal.safeParse(event);
        if (parsed.success) {
          if (parsed.data.type !== `response.${parsed.data.response.status}`)
            throw new Error('Inconsistent provider terminal event');
          return parsed.data.response;
        }
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    // A slow transport close must not turn completed output into a timeout.
    cancel();
  }
}
