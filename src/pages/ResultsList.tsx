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
      <p className="results-count">
        {results.length} {results.length === 1 ? 'pick' : 'picks'}
      </p>
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
        <button type="button" className="show-more" onClick={onShowMore}>
          Show more
        </button>
      )}
    </section>
  );
}
