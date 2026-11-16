import { useEffect, useState } from 'react';
import type { RankedMatch } from '../contracts/rankedMatch';
import { FeedbackControls } from '../feedback/FeedbackControls';
import type { FeedbackBinding } from '../feedback/vote';

const COPIED_RESET_MS = 2000;

function formatDuration(durationSeconds: number): string {
  return `${Math.round(durationSeconds / 60)} min`;
}

interface VideoCardProps {
  match: RankedMatch;
  onPlay: (button: HTMLButtonElement) => void;
  onWatch?: () => void;
  // Off in the "Not sure" state, where every pick is a fallback by design.
  showClosestMatch?: boolean;
  fallbackLabel?: string;
  feedback?: { binding: FeedbackBinding; question: string };
}

export function VideoCard({
  match,
  onPlay,
  onWatch,
  showClosestMatch = true,
  fallbackLabel,
  feedback,
}: VideoCardProps) {
  const { item, reason, matchType } = match;
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(
      () => setCopyState('idle'),
      COPIED_RESET_MS,
    );
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const watchUrl = `https://www.youtube.com/watch?v=${item.youtubeId}`;
  const firstTool = item.tools[0];

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(watchUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <li className="video-card">
      <div className="media">
        <button
          type="button"
          className={
            thumbnailFailed ? 'thumbnail thumbnail-placeholder' : 'thumbnail'
          }
          aria-label={`Play ${item.title}`}
          aria-haspopup="dialog"
          onClick={(event) => onPlay(event.currentTarget)}
        >
          {!thumbnailFailed && (
            <img
              src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
              alt=""
              onError={() => setThumbnailFailed(true)}
            />
          )}
          <span className="play-icon" aria-hidden="true" />
        </button>
        {item.durationSeconds !== undefined && (
          <span className="duration-badge">
            {formatDuration(item.durationSeconds)}
          </span>
        )}
      </div>

      <div className="card-body">
        <h3>{item.title}</h3>
        {item.durationSeconds === undefined && (
          <span className="sr-only">Length unavailable</span>
        )}
        <p className="description">{item.description}</p>
        {matchType === 'cross-area' ? (
          <span className="tag tag-fallback">From another area</span>
        ) : matchType === 'fallback' ? (
          <span className="tag tag-fallback">
            {fallbackLabel ??
              (item.isStartHere
                ? 'Start here'
                : showClosestMatch
                  ? 'Closest match'
                  : 'More to explore')}
          </span>
        ) : (
          firstTool && <span className="tag">{firstTool}</span>
        )}
        <p className="reason">
          <span className="reason-label">Why this video</span>
          {reason}
        </p>
        <div className="card-actions">
          <a
            className="btn btn-navy"
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWatch}
            onAuxClick={(event) => {
              if (event.button === 1) onWatch?.();
            }}
          >
            <span aria-hidden="true">▶</span> Watch on YouTube{' '}
            <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <button
            type="button"
            className="btn btn-outline copy-link"
            onClick={handleCopyLink}
          >
            {copyState === 'copied' ? 'Copied' : 'Copy link'}
          </button>
          <span className="sr-only" aria-live="polite">
            {copyState === 'copied' && 'Link copied'}
            {copyState === 'failed' && 'Could not copy the link'}
          </span>
        </div>
        {feedback && (
          <FeedbackControls
            binding={feedback.binding}
            question={feedback.question}
            title={item.title}
          />
        )}
      </div>
    </li>
  );
}
