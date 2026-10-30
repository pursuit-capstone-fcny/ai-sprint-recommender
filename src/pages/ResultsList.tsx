import type { RankedMatch } from '../contracts/rankedMatch';
import { VideoCard } from './VideoCard';
import type { FeedbackBinding } from '../feedback/vote';

export const RESULTS_HEADING_ID = 'results-heading';

interface ResultsListProps {
  results: RankedMatch[];
  loading?: boolean;
  playingId: string | null;
  onPlay: (youtubeId: string) => void;
  showClosestMatch?: boolean;
  feedback?: {
    question: string;
    bind: (match: RankedMatch, index: number) => FeedbackBinding;
  };
  onVideoClick?: (
    match: RankedMatch,
    index: number,
    target: 'embed' | 'youtube',
  ) => void;
}

export function ResultsList({
  results,
  loading = false,
  playingId,
  onPlay,
  showClosestMatch = true,
  onVideoClick,
  feedback,
}: ResultsListProps) {
  return (
    <section aria-busy={loading} aria-labelledby={RESULTS_HEADING_ID}>
      <div className="results-head">
        <h2 id={RESULTS_HEADING_ID} tabIndex={-1}>
          Videos to start with
        </h2>
        <p className="pill results-count" aria-live="polite" aria-atomic="true">
          {results.length} {results.length === 1 ? 'video' : 'videos'}
          <span className="sr-only">
            {`, including ${results.filter((match) => match.matchType === 'fallback').length} fallback suggestions`}
          </span>
        </p>
      </div>
      <ul className="video-card-grid">
        {results.map((match, index) => (
          <VideoCard
            key={match.item.youtubeId}
            match={match}
            isPlaying={playingId === match.item.youtubeId}
            showClosestMatch={showClosestMatch}
            feedback={
              feedback
                ? {
                    question: feedback.question,
                    binding: feedback.bind(match, index),
                  }
                : undefined
            }
            onPlay={() => {
              onPlay(match.item.youtubeId);
              onVideoClick?.(match, index, 'embed');
            }}
            onWatch={() => onVideoClick?.(match, index, 'youtube')}
          />
        ))}
      </ul>
    </section>
  );
}
