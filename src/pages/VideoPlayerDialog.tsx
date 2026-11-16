import { useId, useLayoutEffect, useRef } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';

interface VideoPlayerDialogProps {
  item: CatalogItem;
  onDismiss: () => void;
}

export function VideoPlayerDialog({ item, onDismiss }: VideoPlayerDialogProps) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const player = dialog.current;
    if (!player || player.open) return;
    player.showModal();
    closeButton.current?.focus({ preventScroll: true });
  }, []);

  function dismiss() {
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
        <iframe
          className="video-player"
          src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&playsinline=1`}
          title={item.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </dialog>
  );
}
