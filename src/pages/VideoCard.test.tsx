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
  it('passes the thumbnail button to the player trigger', () => {
    const onPlay = vi.fn();
    render(
      <ul>
        <VideoCard match={match} onPlay={onPlay} />
      </ul>,
    );

    expect(screen.queryByTitle(match.item.title)).toBeNull();

    const button = screen.getByRole('button', { name: /play/i });
    fireEvent.click(button);
    expect(onPlay).toHaveBeenCalledExactlyOnceWith(button);
  });

  it('copies the YouTube link and shows "Copied" for 2 seconds', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    try {
      render(
        <ul>
          <VideoCard match={match} onPlay={vi.fn()} />
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
