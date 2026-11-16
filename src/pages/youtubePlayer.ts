interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

type PlayerConstructor = new (
  iframe: HTMLIFrameElement,
  options: { events: { onReady: (event: { target: YouTubePlayer }) => void } },
) => YouTubePlayer;

const youtube = window as Window & {
  YT?: { Player?: PlayerConstructor };
  onYouTubeIframeAPIReady?: () => void;
};

let pending: Promise<PlayerConstructor> | undefined;

export function loadYouTubePlayer(): Promise<PlayerConstructor> {
  if (youtube.YT?.Player) return Promise.resolve(youtube.YT.Player);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previous = youtube.onYouTubeIframeAPIReady;
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    const ready = () => {
      if (youtube.YT?.Player) resolve(youtube.YT.Player);
      else reject(new Error('YouTube player API unavailable'));
      youtube.onYouTubeIframeAPIReady = previous;
      previous?.();
    };
    youtube.onYouTubeIframeAPIReady = ready;
    script.onerror = () => {
      script.remove();
      if (youtube.onYouTubeIframeAPIReady === ready)
        youtube.onYouTubeIframeAPIReady = previous;
      reject(new Error('YouTube player API did not load'));
    };
    document.head.append(script);
  });
  pending.catch(() => {
    pending = undefined;
  });
  return pending;
}

export type { YouTubePlayer };
