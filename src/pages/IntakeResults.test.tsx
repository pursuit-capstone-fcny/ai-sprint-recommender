import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogItem } from '../contracts/catalogItem';
import { IntakeResults } from './IntakeResults';

afterEach(cleanup);

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

function selectFundraising() {
  fireEvent.change(screen.getByLabelText(/function area/i), {
    target: { value: 'Fundraising' },
  });
}

describe('IntakeResults', () => {
  it('shows 3 cards with reasons after picking an area', () => {
    render(<IntakeResults catalog={catalog} />);
    selectFundraising();

    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.textContent).toMatch(/fundraising|about|made with/i);
    }
  });

  it('shows results for "Not sure" without crashing', () => {
    render(<IntakeResults catalog={catalog} />);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('re-ranks when a goal is typed', () => {
    render(<IntakeResults catalog={catalog} />);
    selectFundraising();

    const firstCardBefore = screen.getAllByRole('listitem')[0];
    expect(firstCardBefore.textContent).toContain('Widget Setup Basics');

    fireEvent.change(screen.getByLabelText(/what do you want to learn/i), {
      target: { value: 'gizmo' },
    });

    const firstCardAfter = screen.getAllByRole('listitem')[0];
    expect(firstCardAfter.textContent).toContain('Gizmo Onboarding Guide');
  });

  it('labels fallback picks as "Closest match" and hides Show more', () => {
    render(<IntakeResults catalog={catalog} />);
    fireEvent.change(screen.getByLabelText(/function area/i), {
      target: { value: 'Leadership' },
    });
    fireEvent.change(screen.getByLabelText(/what do you want to learn/i), {
      target: { value: 'gizmo' },
    });

    expect(screen.getAllByText('Closest match').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('shows at most 3 cards on first render even with more strong matches available', () => {
    render(<IntakeResults catalog={catalog} />);
    selectFundraising();

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /show more/i })).toBeTruthy();
  });

  it('"Show more" reveals the next strong match and never a fallback card', () => {
    render(<IntakeResults catalog={catalog} />);
    selectFundraising();

    fireEvent.click(screen.getByRole('button', { name: /show more/i }));

    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    expect(screen.queryByText('Closest match')).toBeNull();
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('narrows to one tool with the tool select, and "Any AI tool" undoes it', () => {
    render(<IntakeResults catalog={catalog} />);
    selectFundraising();
    const toolSelect = screen.getByLabelText(/tool/i) as HTMLSelectElement;
    expect(toolSelect.value).toBe('');
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      'Widget Setup Basics',
    );

    fireEvent.change(toolSelect, { target: { value: 'Claude' } });
    expect(toolSelect.value).toBe('Claude');
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      'Sprocket Tracking Walkthrough',
    );

    fireEvent.change(toolSelect, { target: { value: 'Copilot' } });
    expect(toolSelect.value).toBe('Copilot');
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      'Gizmo Onboarding Guide',
    );

    fireEvent.change(toolSelect, { target: { value: '' } });
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      'Widget Setup Basics',
    );
  });

  it('"Clear" resets area, goal and tool', () => {
    render(<IntakeResults catalog={catalog} />);
    const area = screen.getByLabelText(/function area/i) as HTMLSelectElement;
    const goal = screen.getByLabelText(
      /what do you want to learn/i,
    ) as HTMLInputElement;
    const tool = screen.getByLabelText(/tool/i) as HTMLSelectElement;

    selectFundraising();
    fireEvent.change(goal, { target: { value: 'gizmo' } });
    fireEvent.change(tool, { target: { value: 'Claude' } });
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(area.value).toBe('');
    expect(goal.value).toBe('');
    expect(tool.value).toBe('');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('"Find videos" moves focus to the results heading', () => {
    render(<IntakeResults catalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: /find videos/i }));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Videos to start with' }),
    );
  });

  it('shows tool pills, not "Closest match", in the "Not sure" state', () => {
    render(<IntakeResults catalog={catalog} />);
    const cards = screen.getAllByRole('listitem');
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.queryByText('Closest match')).toBeNull();
    const firstTitle = cards[0].querySelector('h3')?.textContent;
    const firstItem = catalog.find((item) => item.title === firstTitle);
    expect(within(cards[0]).getByText(firstItem!.tools[0])).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/function area/i), {
      target: { value: 'Leadership' },
    });
    expect(screen.getAllByText('Closest match').length).toBeGreaterThan(0);
  });
});
