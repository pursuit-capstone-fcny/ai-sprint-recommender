import { useRef, useState } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';
import type { RankedMatch } from '../contracts/rankedMatch';
import { VideoCard } from './VideoCard';
import { VideoPlayerDialog } from './VideoPlayerDialog';
import type { PlaybackPosition } from './youtubePlayer';
import type { FeedbackBinding } from '../feedback/vote';

export const RESULTS_HEADING_ID = 'results-heading';

interface ResultsListProps {
  results: RankedMatch[];
  loading?: boolean;
  fallbackOnly?: boolean;
  hasMatches?: boolean;
  playingId: string | null;
  onPlay: (youtubeId: string | null) => void;
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
  fallbackOnly = false,
  hasMatches = false,
  playingId,
  onPlay,
  showClosestMatch = true,
  onVideoClick,
  feedback,
}: ResultsListProps) {
  const playButton = useRef<HTMLButtonElement | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<CatalogItem | null>(null);
  const [pausedPosition, setPausedPosition] = useState<PlaybackPosition | null>(
    null,
  );
  const playerOpen =
    selectedVideo !== null &&
    selectedVideo.youtubeId === playingId &&
    results.some((match) => match.item.youtubeId === playingId);

  return (
    <section
      aria-busy={loading}
      aria-labelledby={RESULTS_HEADING_ID}
      aria-describedby={fallbackOnly ? 'fallback-explanation' : undefined}
    >
      <div className="results-head">
        <h2 id={RESULTS_HEADING_ID} tabIndex={-1}>
          {fallbackOnly
            ? 'Fallback videos'
            : hasMatches
              ? 'Recommended Videos'
              : 'Videos to start with'}
        </h2>
        <p className="pill results-count" aria-live="polite" aria-atomic="true">
          {results.length} {results.length === 1 ? 'video' : 'videos'}
          <span className="sr-only">
            {`, including ${results.filter((match) => match.matchType === 'fallback').length} fallback suggestions`}
          </span>
        </p>
      </div>
      {fallbackOnly && (
        <p id="fallback-explanation" className="fallback-explanation">
          These are general library suggestions. They were not matched to your
          request.
        </p>
      )}
      <ul className="video-card-grid">
        {results.map((match, index) => (
          <VideoCard
            key={match.item.youtubeId}
            match={match}
            pausedPosition={
              match.item.youtubeId === selectedVideo?.youtubeId
                ? pausedPosition
                : null
            }
            fallbackLabel={fallbackOnly ? 'Fallback video' : undefined}
            showClosestMatch={showClosestMatch}
            feedback={
              feedback
                ? {
                    question: feedback.question,
                    binding: feedback.bind(match, index),
                  }
                : undefined
            }
            onPlay={(button) => {
              playButton.current = button;
              setPausedPosition(null);
              setSelectedVideo(match.item);
              onPlay(match.item.youtubeId);
              onVideoClick?.(match, index, 'embed');
            }}
            onWatch={() => onVideoClick?.(match, index, 'youtube')}
          />
        ))}
      </ul>
      {selectedVideo && (
        <VideoPlayerDialog
          key={selectedVideo.youtubeId}
          item={selectedVideo}
          open={playerOpen}
          onDismiss={(position) => {
            setPausedPosition(position);
            onPlay(null);
            playButton.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </section>
  );
}
