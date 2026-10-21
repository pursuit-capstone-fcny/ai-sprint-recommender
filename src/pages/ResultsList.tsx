import type { RankedMatch } from '../contracts/rankedMatch';
import { VideoCard } from './VideoCard';

export const RESULTS_HEADING_ID = 'results-heading';

interface ResultsListProps {
  results: RankedMatch[];
  loading?: boolean;
  playingId: string | null;
  onPlay: (youtubeId: string) => void;
  canShowMore: boolean;
  onShowMore: () => void;
  showClosestMatch?: boolean;
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
  canShowMore,
  onShowMore,
  showClosestMatch = true,
  onVideoClick,
}: ResultsListProps) {
  return (
    <section
      aria-busy={loading}
      aria-live="polite"
      aria-labelledby={RESULTS_HEADING_ID}
    >
      <div className="results-head">
        <h2 id={RESULTS_HEADING_ID} tabIndex={-1}>
          Videos to start with
        </h2>
        <p className="pill results-count">
          {results.length} {results.length === 1 ? 'video' : 'videos'}
        </p>
      </div>
      <ul className="video-card-grid">
        {results.map((match, index) => (
          <VideoCard
            key={match.item.youtubeId}
            match={match}
            isPlaying={playingId === match.item.youtubeId}
            showClosestMatch={showClosestMatch}
            onPlay={() => {
              onPlay(match.item.youtubeId);
              onVideoClick?.(match, index, 'embed');
            }}
            onWatch={() => onVideoClick?.(match, index, 'youtube')}
          />
        ))}
      </ul>
      {canShowMore && (
        <div className="show-more-row">
          <button
            type="button"
            className="btn btn-secondary show-more"
            onClick={onShowMore}
          >
            Show more
          </button>
        </div>
      )}
    </section>
  );
}
