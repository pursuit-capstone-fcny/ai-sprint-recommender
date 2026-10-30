import type { PublicCatalog } from '../contracts/publicCatalog';
import type { UsageEvent } from '../contracts/usageEvent';
import type { UsageSession } from '../usage/usageSession';

export type FeedbackEvent = Extract<UsageEvent, { type: 'feedback' }>;
export type FeedbackSource = Omit<
  FeedbackEvent,
  'type' | 'schemaVersion' | 'eventId' | 'time' | 'helpful' | 'voteRevision'
>;
type Snapshot = {
  helpful: boolean | null;
  status: 'idle' | 'sending' | 'saved' | 'failed';
};

function createVote(session: UsageSession) {
  let state: Snapshot = { helpful: null, status: 'idle' };
  let revision = 0;
  let pending: { event: FeedbackEvent; catalog: PublicCatalog } | undefined;
  const listeners = new Set<() => void>();
  const update = (next: Snapshot) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function deliver() {
    if (!pending || state.status === 'sending') return;
    const attempt = pending;
    update({ helpful: attempt.event.helpful, status: 'sending' });
    let outcome: string;
    try {
      outcome = await session.sender.send(attempt.event, attempt.catalog);
    } catch {
      outcome = 'dropped';
    }
    update({
      helpful: attempt.event.helpful,
      status:
        outcome === 'accepted' || outcome === 'duplicate' ? 'saved' : 'failed',
    });
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    submit(helpful: boolean, source: FeedbackSource, catalog: PublicCatalog) {
      if (state.status === 'sending') return;
      if (state.helpful === helpful && state.status === 'saved') return;
      if (state.helpful === helpful && state.status === 'failed') {
        void deliver();
        return;
      }
      pending = {
        catalog,
        event: {
          ...source,
          schemaVersion: 2,
          type: 'feedback',
          eventId: crypto.randomUUID(),
          time: new Date().toISOString(),
          helpful,
          voteRevision: ++revision,
        },
      };
      void deliver();
    },
    retry: () => deliver(),
  };
}

export type FeedbackVote = ReturnType<typeof createVote>;
export type FeedbackBinding = {
  vote: FeedbackVote;
  source: FeedbackSource;
  catalog: PublicCatalog;
};
// Page memory only. Re-searches and route remounts share the session's revisions.
const sessions = new WeakMap<UsageSession, Map<string, FeedbackVote>>();
export function feedbackVote(
  session: UsageSession,
  youtubeId: string,
): FeedbackVote {
  let votes = sessions.get(session);
  if (!votes) {
    votes = new Map();
    sessions.set(session, votes);
  }
  let vote = votes.get(youtubeId);
  if (!vote) {
    vote = createVote(session);
    votes.set(youtubeId, vote);
  }
  return vote;
}

export function feedbackQuestion(): string | null {
  const question = import.meta.env.VITE_FEEDBACK_QUESTION?.trim();
  return import.meta.env.VITE_FEEDBACK_ENABLED === 'true' &&
    question &&
    question.length <= 200
    ? question
    : null;
}
