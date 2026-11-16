import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';
import { loadYouTubePlayer, type YouTubePlayer } from './youtubePlayer';

interface VideoPlayerDialogProps {
  item: CatalogItem;
  open: boolean;
  onDismiss: () => void;
}

export function VideoPlayerDialog({
  item,
  open,
  onDismiss,
}: VideoPlayerDialogProps) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const showFrame = open || ready;

  useEffect(() => {
    const frame = iframe.current;
    if (!showFrame || !frame) return;
    let connected = true;
    let controller: YouTubePlayer | undefined;
    void loadYouTubePlayer()
      .then((Player) => {
        if (!connected) return;
        controller = new Player(frame, {
          events: {
            onReady: ({ target }) => {
              if (!connected || !dialog.current?.open) return;
              player.current = target;
              setReady(true);
            },
          },
        });
      })
      .catch(() => {
        // The embed still works if the control API is unavailable.
      });
    return () => {
      connected = false;
      player.current = null;
      controller?.destroy();
    };
  }, [showFrame]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || element.open === open) return;
    if (open) {
      element.showModal();
      closeButton.current?.focus({ preventScroll: true });
      player.current?.playVideo();
    } else {
      player.current?.pauseVideo();
      element.close();
    }
  }, [open]);

  function dismiss() {
    player.current?.pauseVideo();
    dialog.current?.close();
    onDismiss();
  }

  return (
    <dialog
      ref={dialog}
      className="video-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div
        className="video-dialog-backdrop"
        role="presentation"
        aria-hidden="true"
        onClick={dismiss}
      />
      <div className="video-dialog-panel">
        <div className="video-dialog-header">
          <h2 id={titleId}>{item.title}</h2>
          <button
            ref={closeButton}
            type="button"
            className="btn btn-outline video-dialog-close"
            onClick={dismiss}
          >
            Close video
          </button>
        </div>
        {showFrame && (
          <iframe
            ref={iframe}
            className="video-player"
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </dialog>
  );
}
