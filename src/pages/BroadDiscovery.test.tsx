import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { discoveryCatalog } from '../../fixtures/discoveryCatalog';
import { toCatalogItem } from '../contracts/catalogItem';
import { IntakeResults } from './IntakeResults';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  ['Copilot', 'Fictional feedback analysis with Copilot'],
  [
    'What can I do with Microsoft Copilot?',
    'Fictional feedback analysis with Copilot',
  ],
  [
    'For example, I coordinate volunteers and need help planning outreach.',
    'Fictional volunteer outreach and orientation',
  ],
])(
  'AC-12.23/82.6: real deterministic discovery matches %s with AI disabled',
  (goal, title) => {
    vi.stubEnv('VITE_LLM_ENABLED', 'false');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(
      <IntakeResults
        catalog={discoveryCatalog.items.map(toCatalogItem)}
        publicCatalog={discoveryCatalog}
      />,
    );
    const input = screen.getByLabelText('Your goal');
    if (goal.startsWith('For example'))
      expect(input.getAttribute('placeholder')).toBe(goal);
    fireEvent.change(input, { target: { value: goal } });
    fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
    expect(screen.getByText('Standard matching')).toBeTruthy();
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('No compatible videos found.')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Fallback videos' }),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  },
);
