import type { RankedMatch } from '../contracts/rankedMatch';
import { VideoCard } from './VideoCard';

interface ResultsListProps {
  results: RankedMatch[];
  playingId: string | null;
  onPlay: (youtubeId: string) => void;
  canShowMore: boolean;
  onShowMore: () => void;
}

export function ResultsList({
  results,
  playingId,
  onPlay,
  canShowMore,
  onShowMore,
}: ResultsListProps) {
  return (
    <section aria-live="polite">
      <div className="results-head">
        <div>
          <h2>Your picks</h2>
          <p>Ranked by how well each video fits what you told us.</p>
        </div>
        <p className="results-count">
          {results.length} {results.length === 1 ? 'pick' : 'picks'}
        </p>
      </div>
      <ul className="video-card-grid">
        {results.map((match) => (
          <VideoCard
            key={match.item.youtubeId}
            match={match}
            isPlaying={playingId === match.item.youtubeId}
            onPlay={() => onPlay(match.item.youtubeId)}
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
