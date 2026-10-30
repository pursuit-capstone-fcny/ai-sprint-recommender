import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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
    expect(
      await screen.findByLabelText('Function area (optional)'),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses served dictionary choices, including a tool without any videos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => fixture }),
    );
    render(<IntakeResultsPage />);
    const select = await screen.findByLabelText('Function area (optional)');
    expect(
      [...select.querySelectorAll('option')].map((option) => option.value),
    ).toEqual(['', ...fixture.functionAreas]);
    expect(fixture.items.some((item) => item.tools.includes('Claude'))).toBe(
      false,
    );
    fireEvent.click(
      screen.getByText('Refine by function area or tool (optional)'),
    );
    const toolSelect = screen.getByLabelText('Tool (optional)');
    expect(
      within(toolSelect).getByRole('option', { name: 'Claude' }),
    ).toBeTruthy();
    expect(
      screen.getByText(`${fixture.items.length} videos loaded`),
    ).toBeTruthy();
    expect(screen.getAllByText('Length unavailable').length).toBeGreaterThan(0);
  });
});
