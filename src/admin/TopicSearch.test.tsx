import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { topicCatalog } from '../../fixtures/topic-catalog';
import { dashboardDemo } from '../../fixtures/dashboard-demo';
import { TopicSearch } from './TopicSearch';
import { AnalyticsDashboard } from './AnalyticsDashboard';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function submit(topic: string) {
  fireEvent.change(screen.getByLabelText('Topic'), {
    target: { value: topic },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search videos' }));
}
describe('staff topic browsing', () => {
  it('browses >8 same-task videos, filters with AND/OR, clears filters without clearing the submitted topic and handles misses', () => {
    render(<TopicSearch catalog={topicCatalog} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(14);
    submit('pitch deck');
    fireEvent.click(screen.getByText('Function areas · All'));
    fireEvent.click(screen.getByText('Tools · All'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fundraising' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Operations' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(14);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sheets' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(14);
    expect(screen.getByRole('status').textContent).toContain('pitch deck');
    submit('uncovered marine biology');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'No matching videos' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Browse all videos' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(14);
    expect(screen.getByLabelText('Topic')).toHaveProperty('value', '');
  });
  it('plays a selected video and copies its YouTube URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<TopicSearch catalog={topicCatalog} />);
    const row = screen.getAllByRole('listitem')[13];
    fireEvent.click(within(row).getByRole('button', { name: /^Play video/ }));
    expect(row.querySelector('iframe')?.getAttribute('src')).toContain(
      'topic000013',
    );
    fireEvent.click(within(row).getByRole('button', { name: /^Copy link/ }));
    expect(await within(row).findByText('Link copied')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=topic000013',
    );
    submit('no matches');
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('lives in analytics, preserves report filters, works without collection and clears catalog data when access is lost', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        snapshot: {
          ...dashboardDemo,
          collectionAvailable: false,
          catalog: topicCatalog,
        },
      })
      .mockResolvedValueOnce({ ok: false, error: 'ACCESS_DENIED' });
    render(
      <AnalyticsDashboard
        load={load}
        clock={() => Date.parse('2026-10-29T16:00:00Z')}
      />,
    );
    await screen.findByText('38 videos');
    fireEvent.change(screen.getByLabelText('Find a video or keyword'), {
      target: { value: 'Budget' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Topic search' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(14);
    expect(screen.queryByRole('button', { name: 'Apply filters' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Videos' }));
    expect(screen.getByLabelText('Find a video or keyword')).toHaveProperty(
      'value',
      'Budget',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Topic search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload data' }));
    await screen.findByRole('heading', { name: 'Topic search unavailable' });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
