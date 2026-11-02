import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { toCatalogItem } from '../contracts/catalogItem';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { UsageEventSchema } from '../contracts/usageEvent';
import type { UsageSender } from '../usage/sendUsage';
import { IntakeResults } from './IntakeResults';

const catalog = parsePublicCatalog(fixture);
const items = catalog.items.map(toCatalogItem);

function setup() {
  const send = vi.fn<UsageSender['send']>().mockResolvedValue('accepted');
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({
      outcome: 'success',
      youtubeIds: ['fx04BdgtSht', 'fx01GrntRpt'],
      catalogVersion: catalog.catalogVersion,
      modelVersion: 'fixture-model',
      promptVersion: 'fixture-prompt',
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <StrictMode>
      <IntakeResults
        catalog={items}
        recommendationCatalog={catalog}

        usage={{
          catalog,
          session: {
            sessionId: crypto.randomUUID(),
            src: 'team',
            sender: { send },
          },
        }}
      />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Haiku AI' }));
  const goal = screen.getByRole('textbox', {
    name: /your goal/i,
  });
  const form = screen.getByRole('form', { name: 'What are you working on?' });
  const searches = () =>
    send.mock.calls
      .map(([event]) => UsageEventSchema.parse(event))
      .filter((event) => event.type === 'search');
  return { goal, form, send, fetchMock, searches };
}

beforeEach(() => vi.stubEnv('VITE_LLM_ENABLED', 'true'));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('text-first discovery', () => {
  it.each([
    'Draft a grant report',
    'I coordinate volunteers and need help planning outreach',
    'Our nonprofit helps families find housing',
    'I want to learn how to use a spreadsheet',
  ])(
    'AC-82.1/3/5 submits "%s" without selectors or another interview',
    async (description) => {
      const { goal, fetchMock, searches } = setup();
      expect(screen.queryAllByRole('combobox')).toHaveLength(0);
      expect(screen.getAllByRole('textbox')[0]).toBe(goal);
      fireEvent.change(goal, { target: { value: description } });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(searches()).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
      await waitFor(() => expect(searches()).toHaveLength(1));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        goal: description,
        functionArea: null,
        tools: [],
        catalogVersion: catalog.catalogVersion,
      });
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Videos to start with' }),
      );
      expect(screen.getByText('AI suggestions')).toBeTruthy();
    },
  );

  it('uses a multiline textbox without category or tool selectors', () => {
    const { goal, fetchMock } = setup();
    expect(goal.tagName).toBe('TEXTAREA');
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryByText(/Refine by function area or tool/)).toBeNull();
    fireEvent.keyDown(goal, { key: 'Enter', shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Enter submits the textarea once, while Shift+Enter leaves it editable', async () => {
    const { goal, fetchMock, searches } = setup();
    fireEvent.change(goal, { target: { value: 'Draft a grant report' } });
    fireEvent.keyDown(goal, { key: 'Enter', shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.keyDown(goal, { key: 'Enter' });
    await waitFor(() => expect(searches()).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['', '   '])(
    'AC-82.3 blank description "%s" uses fallback without a provider request',
    (value) => {
      const { goal, fetchMock, searches } = setup();
      fireEvent.click(screen.getByRole('radio', { name: 'Deterministic' }));
      fireEvent.change(goal, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
      expect(searches()).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    },
  );

  it.each(['button', 'form'])(
    'AC-82.5 %s submission creates one search context and keeps raw text out of analytics, storage and URLs',
    async (method) => {
      const { goal, form, fetchMock, searches, send } = setup();
      const persist = vi.spyOn(Storage.prototype, 'setItem');
      const push = vi.spyOn(window.history, 'pushState');
      const replace = vi.spyOn(window.history, 'replaceState');
      const url = window.location.href;
      const description = 'Draft a grant report for fictional Cedar House';
      fireEvent.change(goal, { target: { value: description } });
      if (method === 'button')
        fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
      else fireEvent.submit(form); // Native form submission, also used by Enter in the textarea.
      await waitFor(() => expect(searches()).toHaveLength(1));
      const search = searches()[0];
      const submittedEvents = send.mock.calls
        .map(([event]) => UsageEventSchema.parse(event))
        .filter((event) => event.searchId === search.searchId);
      expect(
        submittedEvents.filter((event) => event.type === 'impression').length,
      ).toBeGreaterThan(0);
      expect(new Set(submittedEvents.map((event) => event.searchId)).size).toBe(
        1,
      );
      expect(JSON.stringify(send.mock.calls)).not.toContain('Cedar House');
      expect(search).toMatchObject({
        functionArea: null,
        tools: [],
        tasks: ['grant reports'],
      });
      expect(search).not.toHaveProperty('goal');
      expect(persist).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(window.location.href).toBe(url);
      fireEvent.change(goal, { target: { value: 'new unsubmitted text' } });
      expect(searches()).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('AC-82.1 preserves the 500-character limit before dispatch', async () => {
    const { goal, fetchMock, searches } = setup();
    expect(goal).toHaveProperty('maxLength', 500);
    fireEvent.change(goal, { target: { value: 'x'.repeat(501) } });
    expect(goal).toHaveProperty('value', 'x'.repeat(500));
    fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
    await waitFor(() => expect(searches()).toHaveLength(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).goal).toHaveLength(500);
  });

  it('Clear resets the freeform goal without changing the selected engine', () => {
    const { goal } = setup();
    fireEvent.change(goal, { target: { value: 'Draft a report' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(goal).toHaveProperty('value', '');
    expect(screen.getByRole('radio', { name: 'Haiku AI' })).toHaveProperty(
      'checked',
      true,
    );
  });
});
