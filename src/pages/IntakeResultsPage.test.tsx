import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { IntakeResultsPage } from './IntakeResultsPage';

beforeEach(() => {
  vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog');
  vi.stubEnv('VITE_CATALOG_SOURCE', 'remote');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('catalog page integration', () => {
  it('retries a failed request, then shows a distinct empty state', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...fixture, items: [] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => fixture });
    vi.stubGlobal('fetch', fetchMock);
    render(<IntakeResultsPage />);
    expect(screen.getByRole('status').textContent).toContain('Loading');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No videos available')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No videos available')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh catalog' }));
    expect(await screen.findByLabelText('Your goal')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('renders the branded text-first page with real catalog cards and no hero video placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => fixture }),
    );
    render(<IntakeResultsPage />);
    const goal = await screen.findByLabelText('Your goal');
    expect(goal.tagName).toBe('TEXTAREA');
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getByRole('radio', { name: 'Deterministic' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Haiku AI' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'See AI at work in nonprofits.' }),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '.inspiration button, .inspiration iframe, .inspiration video',
      ),
    ).toBeNull();
    expect(screen.queryByText(/placeholder videos|design mock/i)).toBeNull();
    expect(
      screen.getByText(`${fixture.items.length} videos loaded`),
    ).toBeTruthy();
    expect(screen.getAllByText('Length unavailable').length).toBeGreaterThan(0);
  });
});
