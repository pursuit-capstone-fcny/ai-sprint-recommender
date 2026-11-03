import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../contracts/catalogItem';
import { IntakeResults } from './IntakeResults';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const catalog: CatalogItem[] = [
  {
    youtubeId: 'widgetVid01',
    title: 'Widget Setup Basics',
    description: 'Fixture test video.',
    functionAreas: ['Fundraising'],
    tasks: ['widget setup'],
    tools: ['ChatGPT'],
    addedAt: '2026-01-04',
    status: 'active',
    isStartHere: false,
  },
  {
    youtubeId: 'gizmoVid002',
    title: 'Gizmo Onboarding Guide',
    description: 'Fixture test video.',
    functionAreas: ['Fundraising'],
    tasks: ['gizmo onboarding'],
    tools: ['Copilot'],
    addedAt: '2026-01-03',
    status: 'active',
    isStartHere: false,
  },
  {
    youtubeId: 'sprocketVi3',
    title: 'Sprocket Tracking Walkthrough',
    description: 'Fixture test video.',
    functionAreas: ['Fundraising'],
    tasks: ['sprocket tracking'],
    tools: ['Claude'],
    addedAt: '2026-01-02',
    status: 'active',
    isStartHere: false,
  },
  {
    youtubeId: 'doohickyVi4',
    title: 'Doohickey Planning 101',
    description: 'Fixture test video.',
    functionAreas: ['Fundraising'],
    tasks: ['doohickey planning'],
    tools: ['Gemini'],
    addedAt: '2026-01-01',
    status: 'active',
    isStartHere: false,
  },
  {
    youtubeId: 'opsFillerVi5',
    title: 'Operations Filler Video',
    description: 'Fixture test video.',
    functionAreas: ['Operations'],
    tasks: ['thing cleanup'],
    tools: ['Notion'],
    addedAt: '2025-12-31',
    status: 'active',
    isStartHere: false,
  },
];

const publicCatalog = {
  schemaVersion: 1 as const,
  catalogVersion: `sha256:${'a'.repeat(64)}`,
  functionAreas: [
    ...new Set([...catalog.flatMap((i) => i.functionAreas), 'Leadership']),
  ],
  tasks: [...new Set(catalog.flatMap((i) => i.tasks))],
  tools: [...new Set(catalog.flatMap((i) => i.tools))],
  synonyms: [],
  adjacentTools: [],
  items: catalog.map(({ isStartHere, durationSeconds, ...i }) => ({
    ...i,
    startHere: isStartHere,
    lengthSeconds: durationSeconds ?? null,
  })),
};

function submitDiscovery() {
  fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
}

describe('IntakeResults', () => {
  it('shows honest fallback videos for an unsupported deterministic task without calling either provider', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    fireEvent.change(screen.getByLabelText('Your goal'), {
      target: { value: 'Observe lunar craters through a telescope.' },
    });
    submitDiscovery();
    expect(screen.getByText('No compatible videos found.')).toBeTruthy();
    expect(screen.getAllByText('Fallback video')).toHaveLength(5);
    expect(screen.getByRole('heading', { name: 'Fallback videos' })).toBe(
      document.activeElement,
    );
    expect(
      screen.getByText(/These are general library suggestions/),
    ).toBeTruthy();
    expect(screen.queryByText('Closest match')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /Play / })[0]);
    expect(document.querySelector('iframe')?.src).toContain('widgetVid01');
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy link' })[0]);
    await screen.findByRole('button', { name: 'Copied' });
    expect(writeText).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=widgetVid01',
    );
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(
      screen.queryByRole('heading', { name: 'Fallback videos' }),
    ).toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('shows the available matches and labeled fallback when the catalog has fewer than six', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    submitDiscovery();

    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(5);
    expect(screen.getAllByText('More to explore')).toHaveLength(5);
  });

  it('shows results for "Not sure" without crashing', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('keeps displayed results while typing and re-ranks on submission', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    submitDiscovery();

    const firstCardBefore = screen.getAllByRole('listitem')[0];
    expect(firstCardBefore.textContent).toContain('Widget Setup Basics');

    fireEvent.change(screen.getByLabelText(/your goal/i), {
      target: { value: 'gizmo onboarding' },
    });
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      'Widget Setup Basics',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));

    const firstCardAfter = screen.getAllByRole('listitem')[0];
    expect(firstCardAfter.textContent).toContain('Gizmo Onboarding Guide');
  });

  it('does not add unrelated fallback cards to a task request', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    fireEvent.change(screen.getByLabelText(/your goal/i), {
      target: { value: 'gizmo onboarding' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));

    expect(screen.queryAllByText('Closest match')).toHaveLength(0);
    expect(screen.queryAllByText('Fallback video')).toHaveLength(0);
    expect(screen.queryAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('fills a thin matched set with distinct fallback videos and has no Show more', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    submitDiscovery();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getAllByText('More to explore')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('Clear resets the description, results and playback', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    const goal = screen.getByLabelText(/your goal/i);
    fireEvent.change(goal, { target: { value: 'gizmo onboarding' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Play / })[0]);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(goal).toHaveProperty('value', '');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('"Find videos" moves focus to the results heading', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: /find videos/i }));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Videos to start with' }),
    );
  });

  it('labels fallback discovery picks in the "Not sure" state', () => {
    render(<IntakeResults publicCatalog={publicCatalog} catalog={catalog} />);
    const cards = screen.getAllByRole('listitem');
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.queryByText('Closest match')).toBeNull();
    const firstTitle = cards[0].querySelector('h3')?.textContent;
    const firstItem = catalog.find((item) => item.title === firstTitle);
    expect(firstItem).toBeTruthy();
    expect(within(cards[0]).getByText('More to explore')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
    expect(screen.getAllByText('More to explore')).toHaveLength(5);
  });
});
