import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  expandedCatalog,
  expandedPublicCatalog,
} from '../../fixtures/expanded-catalog';
import { UsageEventSchema } from '../contracts/usageEvent';
import { IntakeResults } from './IntakeResults';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('shows only the model picks without filling short lists', async () => {
  vi.stubEnv('VITE_LLM_ENABLED', 'true');
  const send = vi.fn(async (event: unknown) => {
    UsageEventSchema.parse(event);
    return 'accepted' as const;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        outcome: 'success',
        youtubeIds: expandedCatalog.slice(0, 2).map((item) => item.youtubeId),
        catalogVersion: expandedPublicCatalog.catalogVersion,
        modelVersion: 'fixture-model',
        promptVersion: 'fixture-prompt',
      }),
    ),
  );
  render(
    <IntakeResults
      catalog={expandedCatalog}
      recommendationCatalog={expandedPublicCatalog}

      usage={{
        catalog: expandedPublicCatalog,
        session: {
          sessionId: crypto.randomUUID(),
          src: 'pilot',
          sender: { send },
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Haiku AI' }));
  fireEvent.change(screen.getByLabelText('Your goal'), {
    target: { value: 'A fictional request' },
  });
  send.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
  await screen.findByText('AI suggestions');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.queryAllByText('Start here')).toHaveLength(0);
  expect(screen.getByText(/2 videos/).textContent).toContain(
    '0 fallback suggestions',
  );
  await waitFor(() => expect(send).toHaveBeenCalledTimes(3));
  const events = send.mock.calls.map((args) => UsageEventSchema.parse(args[0]));
  expect(events[0]).toMatchObject({
    type: 'search',
    resultCount: 2,
    fallbackType: 'none',
  });
  expect(
    events.filter(
      (event) => event.type === 'impression' && event.matchType === 'semantic',
    ),
  ).toHaveLength(2);
  expect(
    events.filter(
      (event) =>
        event.type === 'impression' && event.matchType === 'start-here',
    ),
  ).toHaveLength(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(['rules', 'llm'] as const)(
  'AC-83.4/5: %s counts the displayed set once and resets playback on resubmission',
  async (engine) => {
    const displayedCount = 8;
    vi.stubEnv('VITE_LLM_ENABLED', engine === 'llm' ? 'true' : 'false');
    const send = vi.fn(async (event: unknown) => {
      UsageEventSchema.parse(event);
      return 'accepted' as const;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          outcome: 'success',
          youtubeIds: expandedCatalog.slice(0, 8).map((item) => item.youtubeId),
          catalogVersion: expandedPublicCatalog.catalogVersion,
          modelVersion: 'fixture-model',
          promptVersion: 'fixture-prompt',
        }),
      ),
    );
    render(
      <StrictMode>
        <IntakeResults
          catalog={expandedCatalog}
          recommendationCatalog={expandedPublicCatalog}

          usage={{
            catalog: expandedPublicCatalog,
            session: {
              sessionId: crypto.randomUUID(),
              src: 'pilot',
              sender: { send },
            },
          }}
        />
      </StrictMode>,
    );
    fireEvent.click(
      screen.getByRole('radio', {
        name: engine === 'llm' ? 'Haiku AI' : 'Deterministic',
      }),
    );
    if (engine === 'llm') {
      fireEvent.click(screen.getByRole('radio', { name: 'Haiku AI' }));
      fireEvent.change(screen.getByLabelText('Your goal'), {
        target: { value: 'A fictional request' },
      });
    }
    send.mockClear();
    const submit = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
    submit();
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(displayedCount),
    );
    const events = () =>
      send.mock.calls.map(([event]) => UsageEventSchema.parse(event));
    await waitFor(() =>
      expect(
        events().filter((event) => event.type === 'impression'),
      ).toHaveLength(displayedCount),
    );
    expect(events().filter((event) => event.type === 'search')).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      type: 'search',
      resultCount: displayedCount,
      recommendationEngine: engine,
    });
    expect(
      screen
        .getByText(new RegExp(`${displayedCount} videos`))
        .getAttribute('aria-live'),
    ).toBe('polite');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    fireEvent.click(
      screen.getAllByRole('button', { name: /Play \[Fixture\] Video/ })[0],
    );
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    submit();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    await waitFor(() =>
      expect(events().filter((event) => event.type === 'search')).toHaveLength(
        2,
      ),
    );
    expect(
      events().filter((event) => event.type === 'impression'),
    ).toHaveLength(displayedCount * 2);
    const searches = events().filter((event) => event.type === 'search');
    expect(searches[0].searchId).not.toBe(searches[1].searchId);
    for (const search of searches) {
      const impressions = events().filter(
        (event) =>
          event.searchId === search.searchId && event.type === 'impression',
      );
      expect(impressions).toHaveLength(displayedCount);
      expect(
        new Set(
          impressions.map((event) =>
            'youtubeId' in event ? event.youtubeId : null,
          ),
        ).size,
      ).toBe(displayedCount);
    }
    expect(fetch).toHaveBeenCalledTimes(engine === 'llm' ? 2 : 0);
  },
);
