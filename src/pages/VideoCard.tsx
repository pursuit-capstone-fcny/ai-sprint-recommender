import { useEffect, useRef, useState } from 'react';
import type { RankedMatch } from '../contracts/rankedMatch';

function formatDuration(durationSeconds?: number): string {
  if (durationSeconds === undefined) return 'Length unavailable';
  return `${Math.round(durationSeconds / 60)} min`;
}

interface VideoCardProps {
  match: RankedMatch;
  isPlaying: boolean;
  onPlay: () => void;
}

export function VideoCard({ match, isPlaying, onPlay }: VideoCardProps) {
  const { item, reason, matchType } = match;
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isPlaying) {
      iframeRef.current?.focus();
    }
  }, [isPlaying]);

  const watchUrl = `https://www.youtube.com/watch?v=${item.youtubeId}`;

  return (
    <li className="video-card">
      {matchType === 'fallback' && (
        <span className="closest-match-badge">Closest match</span>
      )}

      {isPlaying ? (
        <iframe
          ref={iframeRef}
          className="video-player"
          src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1`}
          title={item.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      ) : thumbnailFailed ? (
        <button
          type="button"
          className="thumbnail thumbnail-placeholder"
          onClick={onPlay}
          aria-label={`Play ${item.title}`}
        >
          Play
        </button>
      ) : (
        <button type="button" className="thumbnail" onClick={onPlay}>
          <img
            src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
            alt=""
            onError={() => setThumbnailFailed(true)}
          />
          <span className="play-label" aria-hidden="true">
            Play
          </span>
          <span className="sr-only">{`Play ${item.title}`}</span>
        </button>
      )}

      <div className="card-body">
        <h3>{item.title}</h3>
        <p className="duration">{formatDuration(item.durationSeconds)}</p>
        <p className="description">{item.description}</p>
        <p className="reason">{reason}</p>
        <div className="card-actions">
          <a
            className="watch-link"
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch on YouTube
          </a>
        </div>
      </div>
    </li>
  );
}
