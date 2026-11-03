import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { dashboardDemo } from '../../fixtures/dashboard-demo';
import { AnalyticsDashboard } from './AnalyticsDashboard';
const clock = () => Date.parse('2026-10-29T16:00:00Z');
const loader = async () => ({ ok: true as const, snapshot: dashboardDemo });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('admin analytics UI', () => {
  it('renders data with paging and applies unused-content filters', async () => {
    await act(async () => {
      render(<AnalyticsDashboard load={loader} clock={clock} />);
    });
    await screen.findByText('38 videos');
    expect(screen.getByText('1–25 of 38')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('26–38 of 38')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Recorded activity'), {
      target: { value: 'zero-appearances' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('10 videos');
  });
  it('resets pagination when a reloaded snapshot has fewer videos', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, snapshot: dashboardDemo })
      .mockResolvedValueOnce({
        ok: true,
        snapshot: {
          ...dashboardDemo,
          facts: dashboardDemo.facts
            .filter(
              (f) =>
                f.youtubeId !== 'demo0000001' && f.youtubeId !== 'demo0000002',
            )
            .slice(0, 20),
        },
      });
    render(<AnalyticsDashboard load={load} clock={clock} />);
    await screen.findByText('38 videos');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload data' }));
    await waitFor(() => expect(screen.queryByText('38 videos')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveProperty(
        'disabled',
        true,
      ),
    );
    expect(screen.queryByText(/26–/)).toBeNull();
  });
  it('connects from a single Sheet link and hides usage metrics when collection is absent', async () => {
    const connect = vi.fn().mockResolvedValue({
      ok: true,
      connection: {
        title: 'Fictional library',
        url: 'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
        kind: 'library',
      },
      snapshot: {
        ...dashboardDemo,
        collectionAvailable: false,
        pendingTagReviews: 10,
        conservativeWindow: true,
      },
    });
    const disconnect = vi.fn().mockResolvedValue(true);
    render(
      <AnalyticsDashboard
        clock={clock}
        load={async () => ({ ok: false, error: 'SHEET_NOT_CONNECTED' })}
        connect={connect}
        disconnect={disconnect}
      />,
    );
    const input = await screen.findByLabelText('Google Sheets link');
    await waitFor(() => expect(input).toHaveProperty('disabled', false));
    fireEvent.change(input, {
      target: {
        value: 'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect Sheet' }));
    await screen.findByRole('link', { name: 'Fictional library' });
    expect(connect).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
    );
    expect(screen.getByLabelText('Recorded activity')).toHaveProperty(
      'disabled',
      true,
    );
    expect(
      screen.getAllByRole('cell', { name: 'Unavailable' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/10 videos have tags awaiting approval/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await screen.findByRole('heading', { name: 'Connect your library Sheet' });
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('shows canonical keyword frequency and navigates from a video to associations', async () => {
    render(<AnalyticsDashboard load={loader} clock={clock} />);
    await screen.findByText('38 videos');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'View keywords' })[0],
    );
    await screen.findByText('1 association');
    expect(screen.getByLabelText('Find a video or keyword')).toHaveProperty(
      'value',
      'demo0000001',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tags & keywords' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    await screen.findByText('4 tags');
    fireEvent.change(screen.getByLabelText('Recorded activity'), {
      target: { value: 'zero-searches' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('1 tag');
    expect(screen.getByRole('cell', { name: 'Claude' })).toBeTruthy();
  });
  it('rejects an inverted date range without replacing the current view', async () => {
    render(<AnalyticsDashboard load={loader} clock={clock} />);
    await screen.findByText('38 videos');
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-11-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert').textContent).toContain('start date');
    expect(screen.getByText('38 videos')).toBeTruthy();
  });
  it('clears previously visible data if reloading loses authorization', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, snapshot: dashboardDemo })
      .mockResolvedValueOnce({ ok: false, error: 'ACCESS_DENIED' });
    render(<AnalyticsDashboard load={load} clock={clock} />);
    await screen.findByText('38 videos');
    fireEvent.click(screen.getByRole('button', { name: 'Reload data' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('Grant reporting · Example 1')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('hides stale and failed reports instead of presenting cached counts', async () => {
    render(
      <AnalyticsDashboard
        load={loader}
        clock={() => Date.parse('2026-11-01T00:00:00Z')}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('out of date'),
    );
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('labels the synthetic preview and renders metadata as text', async () => {
    render(
      <AnalyticsDashboard
        demo
        load={async () => ({
          ok: true,
          snapshot: {
            ...dashboardDemo,
            facts: dashboardDemo.facts.map((f) =>
              f.entity === 'video'
                ? { ...f, title: '<script>synthetic</script>' }
                : f,
            ),
          },
        })}
        clock={clock}
      />,
    );
    await screen.findByText('38 videos');
    expect(screen.getByText(/Synthetic demo/)).toBeTruthy();
    expect(
      screen.getAllByText('<script>synthetic</script>').length,
    ).toBeGreaterThan(0);
    expect(document.querySelector('script')).toBeNull();
  });

  it('centers numeric headings and their cells with one shared class', async () => {
    render(<AnalyticsDashboard load={loader} clock={clock} />);
    await screen.findByText('38 videos');
    const headers = screen.getAllByRole('columnheader');
    const labels = headers.map((th) =>
      th.textContent?.replace(/[↑↓]/g, '').trim(),
    );
    const firstRow = screen.getAllByRole('row')[1];
    const cells = [...firstRow.querySelectorAll('td')];
    headers.forEach((th, index) => {
      const numeric = labels[index] !== 'Video';
      expect(th.classList.contains('analytics-number')).toBe(numeric);
      expect(cells[index].classList.contains('analytics-number')).toBe(numeric);
    });
    expect(labels).toEqual([
      'Video',
      'Appearances',
      'Embed clicks',
      'YouTube clicks',
    ]);
  });
  it('downloads and copies the filtered table as CSV', async () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:csv';
    });
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<AnalyticsDashboard load={loader} clock={clock} />);
    await screen.findByText('38 videos');
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe(
      'library-analytics-video-2026-10-01-to-2026-10-29.csv',
    );
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
    fireEvent.click(screen.getByRole('button', { name: 'Copy as CSV' }));
    await screen.findByText('CSV copied. Paste it into a spreadsheet.');
    const csv = writeText.mock.calls[0][0] as string;
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      '"Video","Appearances","Embed clicks","YouTube clicks"',
    );
    // Every filtered row is exported, not only the visible page of 25.
    expect(lines).toHaveLength(39);
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
