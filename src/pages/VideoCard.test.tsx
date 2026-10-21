import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RankedMatch } from '../contracts/rankedMatch';
import { VideoCard } from './VideoCard';

afterEach(cleanup);

const match: RankedMatch = {
  item: {
    youtubeId: 'abcdefghijk',
    title: 'A Fixture Video',
    description: 'A description.',
    functionAreas: ['Fundraising'],
    tasks: ['grant reports'],
    tools: ['ChatGPT'],
    addedAt: '2026-01-01',
    status: 'active',
    isStartHere: false,
  },
  reason: 'In Fundraising',
  matchType: 'strong',
};

describe('VideoCard', () => {
  it('shows a thumbnail with no iframe until play is clicked', () => {
    const onPlay = vi.fn();
    const { rerender } = render(
      <ul>
        <VideoCard match={match} isPlaying={false} onPlay={onPlay} />
      </ul>,
    );

    expect(screen.queryByTitle(match.item.title)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);

    rerender(
      <ul>
        <VideoCard match={match} isPlaying onPlay={onPlay} />
      </ul>,
    );

    const iframe = screen.getByTitle(match.item.title);
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('src')).toContain('youtube-nocookie.com');
  });

  it('copies the YouTube link and shows "Copied" for 2 seconds', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    try {
      render(
        <ul>
          <VideoCard match={match} isPlaying={false} onPlay={vi.fn()} />
        </ul>,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
      });

      expect(writeText).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=abcdefghijk',
      );
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      expect(screen.getByText('Link copied')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
      expect(screen.queryByText('Link copied')).toBeNull();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
