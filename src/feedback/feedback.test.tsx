import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { impressionEvent } from '../../fixtures/usage-events';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { UsageEventSchema } from '../contracts/usageEvent';
import { toCatalogItem } from '../contracts/catalogItem';
import { createRecommendationUsage } from '../usage/usageContext';
import type { UsageSession } from '../usage/usageSession';
import { buildAnalyticsReport } from '../analytics/report';
import { feedbackQuestion, type FeedbackEvent } from './vote';
import { buildFeedbackReport } from './report';
import { FeedbackControls } from './FeedbackControls';

const catalog = parsePublicCatalog(fixture);
const feedback = (changes: object = {}): FeedbackEvent => {
  const parsed = UsageEventSchema.parse({
    ...impressionEvent,
    schemaVersion: 2,
    type: 'feedback',
    helpful: true,
    voteRevision: 1,
    ...changes,
  });
  if (parsed.type !== 'feedback') throw new Error('Fixture is not feedback');
  return parsed;
};
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('private usefulness feedback', () => {
  it('AC-29.2: keeps v1 readable; only v2 feedback has bounded revisions and no free text', () => {
    expect(UsageEventSchema.safeParse(impressionEvent).success).toBe(true);
    expect(feedback().schemaVersion).toBe(2);
    for (const changes of [
      { schemaVersion: 1 },
      { voteRevision: 0 },
      { voteRevision: 1.2 },
      { voteRevision: Number.MAX_SAFE_INTEGER + 1 },
      { helpful: 'yes' },
      { comment: 'private' },
      { email: 'fictional@example.org' },
    ]) {
      expect(
        UsageEventSchema.safeParse({ ...feedback(), ...changes }).success,
      ).toBe(false);
    }
  });
  it('AC-29.1/3: announces failed and saved votes; retries preserve identity/context across searches', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce('dropped')
      .mockResolvedValue('accepted');
    const session: UsageSession = {
      sessionId: crypto.randomUUID(),
      src: 'pilot',
      sender: { send },
    };
    const profile = { functionArea: null, tools: [], goalWords: [] };
    const match = {
      item: toCatalogItem(catalog.items[0]),
      matchType: 'strong' as const,
      reason: 'Fictional',
    };
    const first = createRecommendationUsage(
      session,
      catalog,
      profile,
      [match],
      true,
    );
    const second = createRecommendationUsage(
      session,
      catalog,
      profile,
      [match],
      true,
    );
    const binding = first.feedback(match, 0);
    const view = render(
      <FeedbackControls
        binding={binding}
        title="Fictional video"
        question="Was this helpful?"
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Helpful: Fictional video' }),
    );
    await screen.findByText(/could not be confirmed/);
    const failedEvent = send.mock.calls[0][0];
    view.rerender(
      <FeedbackControls
        binding={second.feedback(match, 3)}
        title="Fictional video"
        question="Was this helpful?"
      />,
    );
    expect(
      screen
        .getByRole('button', { name: 'Helpful: Fictional video' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    const retry = screen.getByRole('button', { name: 'Retry response' });
    retry.focus();
    fireEvent.click(retry);
    await screen.findByText(/Saved as helpful/);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Helpful: Fictional video' }),
    );
    expect(send.mock.calls[1][0]).toEqual(failedEvent);
    fireEvent.click(
      screen.getByRole('button', { name: 'Not helpful: Fictional video' }),
    );
    await screen.findByText(/Saved as not helpful/);
    const changed = send.mock.calls[2][0];
    expect(changed).toMatchObject({ helpful: false, voteRevision: 2, rank: 4 });
    expect(changed.searchId).not.toBe(failedEvent.searchId);
    expect(changed.eventId).not.toBe(failedEvent.eventId);
    expect(changed.sessionId).toBe(failedEvent.sessionId);
    fireEvent.click(
      screen.getByRole('button', { name: 'Not helpful: Fictional video' }),
    );
    await waitFor(() => expect(send).toHaveBeenCalledTimes(3));
  });
  it('AC-29.3/4: highest revision wins with reordered and duplicate arrivals, privately, once per session/video', () => {
    const up = feedback();
    const down = feedback({
      helpful: false,
      voteRevision: 2,
      eventId: crypto.randomUUID(),
      searchId: crypto.randomUUID(),
      rank: 6,
    });
    const otherSession = feedback({
      sessionId: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
    });
    const team = feedback({
      sessionId: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
      src: 'team',
    });
    const records = [down, up, otherSession, down, team].map((event) => ({
      event,
      receivedAt: event.time,
    }));
    expect(buildFeedbackReport(records)).toEqual([
      {
        youtubeId: up.youtubeId,
        helpful: 1,
        notHelpful: 1,
        responses: 2,
        helpfulRate: 0.5,
      },
    ]);
    expect(buildFeedbackReport([...records].reverse())).toEqual(
      buildFeedbackReport(records),
    );
    expect(buildFeedbackReport(records, true)[0].responses).toBe(3);
    const output = JSON.stringify(buildFeedbackReport(records));
    expect(output).not.toContain(up.sessionId);
    expect(output).not.toContain(up.searchId);
    expect(output).not.toContain(up.eventId);
    expect(() =>
      buildFeedbackReport([
        { event: up, receivedAt: up.time },
        {
          event: feedback({ eventId: crypto.randomUUID(), helpful: false }),
          receivedAt: up.time,
        },
      ]),
    ).toThrow(/Conflicting vote/);
  });
  it('AC-29.6: feedback never counts as a click or appearance in usage analytics', () => {
    const event = feedback();
    const report = buildAnalyticsReport({
      records: [{ event, receivedAt: event.time }],
      current: catalog,
      filter: { startDate: '2026-10-01', endDate: '2026-10-30' },
    });
    expect(
      report.videos.every(
        (row) => row.appearances + row.embedClicks + row.youtubeClicks === 0,
      ),
    ).toBe(true);
    expect(report.associations).toEqual([]);
  });
  it('requires both enablement and approved question wording', () => {
    expect(feedbackQuestion()).toBeNull();
    vi.stubEnv('VITE_FEEDBACK_ENABLED', 'true');
    expect(feedbackQuestion()).toBeNull();
    vi.stubEnv('VITE_FEEDBACK_QUESTION', 'Approved fictional question');
    expect(feedbackQuestion()).toBe('Approved fictional question');
  });
});
