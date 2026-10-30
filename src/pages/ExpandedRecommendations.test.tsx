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

it('counts model picks and fallback fillers together in the displayed set and events', async () => {
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
      availableFunctionAreas={expandedPublicCatalog.functionAreas}
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
  send.mockClear();
  fireEvent.change(screen.getByLabelText('Function area'), {
    target: { value: 'Operations' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
  await screen.findByText('AI suggestions');
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getAllByText('Start here')).toHaveLength(4);
  expect(screen.getByText(/6 videos/).textContent).toContain(
    '4 fallback suggestions',
  );
  const events = send.mock.calls.map((args) => UsageEventSchema.parse(args[0]));
  expect(events[0]).toMatchObject({
    type: 'search',
    resultCount: 6,
    fallbackType: 'start-here',
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
  ).toHaveLength(4);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(['rules', 'llm'] as const)(
  'AC-83.4/5: %s counts the displayed set once and resets playback on resubmission',
  async (engine) => {
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
          availableFunctionAreas={expandedPublicCatalog.functionAreas}
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
    send.mockClear();
    fireEvent.change(screen.getByLabelText('Function area'), {
      target: { value: 'Operations' },
    });
    const submit = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
    submit();
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(8),
    );
    const events = () =>
      send.mock.calls.map(([event]) => UsageEventSchema.parse(event));
    await waitFor(() =>
      expect(
        events().filter((event) => event.type === 'impression'),
      ).toHaveLength(8),
    );
    expect(events().filter((event) => event.type === 'search')).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      type: 'search',
      resultCount: 8,
      recommendationEngine: engine,
    });
    expect(screen.getByText(/8 videos/).getAttribute('aria-live')).toBe(
      'polite',
    );
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
    ).toHaveLength(16);
    const searches = events().filter((event) => event.type === 'search');
    expect(searches[0].searchId).not.toBe(searches[1].searchId);
    for (const search of searches) {
      const impressions = events().filter(
        (event) =>
          event.searchId === search.searchId && event.type === 'impression',
      );
      expect(impressions).toHaveLength(8);
      expect(
        new Set(
          impressions.map((event) =>
            'youtubeId' in event ? event.youtubeId : null,
          ),
        ).size,
      ).toBe(8);
    }
    expect(fetch).toHaveBeenCalledTimes(engine === 'llm' ? 2 : 0);
  },
);
