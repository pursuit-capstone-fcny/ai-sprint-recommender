import {
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
    render(<AnalyticsDashboard load={loader} clock={clock} />);
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
});
