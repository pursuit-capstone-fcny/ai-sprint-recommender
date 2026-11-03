import './feedback.css';
import { useId, useRef, useSyncExternalStore } from 'react';
import type { FeedbackBinding } from './vote';

export function FeedbackControls({
  binding,
  question,
  title,
}: {
  binding: FeedbackBinding;
  question: string;
  title: string;
}) {
  const id = useId();
  const selectedButton = useRef<HTMLButtonElement>(null);
  const state = useSyncExternalStore(
    binding.vote.subscribe,
    binding.vote.getSnapshot,
  );
  return (
    <div className="video-feedback" role="group" aria-labelledby={id}>
      <p id={id}>
        {question}
        <span className="sr-only"> {title}</span>
      </p>
      <div className="feedback-actions">
        {[true, false].map((helpful) => (
          <button
            key={String(helpful)}
            ref={state.helpful === helpful ? selectedButton : undefined}
            type="button"
            className="btn btn-outline"
            aria-pressed={state.helpful === helpful}
            aria-label={`${helpful ? 'Helpful' : 'Not helpful'}: ${title}`}
            disabled={state.status === 'sending'}
            onClick={() =>
              binding.vote.submit(helpful, binding.source, binding.catalog)
            }
          >
            {helpful ? 'Helpful' : 'Not helpful'}
          </button>
        ))}
      </div>
      <p className="feedback-status" role="status">
        {state.status === 'sending' && 'Sending your response…'}
        {state.status === 'saved' &&
          `Saved as ${state.helpful ? 'helpful' : 'not helpful'}. You can change your response.`}
        {state.status === 'failed' &&
          'Your response could not be confirmed. Try again.'}
      </p>
      {state.status === 'failed' && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void binding.vote.retry().then(() => {
              if (binding.vote.getSnapshot().status === 'saved')
                selectedButton.current?.focus();
            });
          }}
        >
          Retry response
        </button>
      )}
    </div>
  );
}
