import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContributionSchema,
  type ContributionConfig,
} from '../contracts/contribution';
import { RequestForm } from './RequestForm';
import { contributionConfig } from './config';

export const config: ContributionConfig = {
  endpoint: 'https://script.google.com/macros/s/fictional/exec',
  policy: {
    version: 'fictional-v1',
    topicPrompt: 'What topic is missing?',
    demoInvitation: 'Would you like to record a demo?',
    purpose: 'Review suggestions and follow up on demo offers.',
    access: 'Only approved Sprint staff can read entries.',
    owner: 'Fictional review owner',
    retentionDays: 7,
    demoOffers: true,
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const posts = () =>
  vi
    .mocked(fetch)
    .mock.calls.map(([, options]) => JSON.parse(String(options?.body)));

describe('reviewed contribution form', () => {
  it('AC-26.1/3/6: needs no contact for a topic; links from fallback and retains entries and ID on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('Network'))
        .mockResolvedValue(Response.json({ ok: true, status: 'duplicate' })),
    );
    render(<RequestForm fallback config={config} />);
    expect(
      screen
        .getByRole('link', { name: /Request a video/ })
        .getAttribute('href'),
    ).toBe('#request-heading');
    expect(screen.queryByLabelText(/Email for/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Topic or demo idea'), {
      target: { value: 'Fictional spreadsheet demo' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send for staff review' }),
    );
    await screen.findByText(/could not be confirmed/);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Topic or demo idea').value,
    ).toBe('Fictional spreadsheet demo');
    fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }));
    await screen.findByText(/Submitted for staff review/);
    expect(posts()[1]).toEqual(posts()[0]);
    expect(Object.keys(posts()[0])).not.toContain('email');
    expect(ContributionSchema.parse(posts()[0]).kind).toBe('topic');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Topic or demo idea').value,
    ).toBe('');
  });
  it('AC-26.1/5/7: shows self-contained demo consent and sends only consented demo email', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ ok: true, status: 'accepted' })),
    );
    render(<RequestForm fallback={false} config={config} />);
    expect(document.getElementById('request-notice')).toBeNull();
    fireEvent.click(screen.getByLabelText('Offer to record a demo'));
    expect(screen.getByText(/deleting it after 7 days/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Topic or demo idea'), {
      target: { value: 'Fictional demo idea' },
    });
    fireEvent.change(screen.getByLabelText(/Email for/), {
      target: { value: 'fictional@example.org' },
    });
    fireEvent.click(screen.getByLabelText(/I agree to/));
    fireEvent.click(
      screen.getByRole('button', { name: 'Send for staff review' }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await screen.findByText(/Submitted for staff review/);
    expect(posts()[0]).toMatchObject({
      kind: 'demo',
      email: 'fictional@example.org',
      consent: true,
      policyVersion: 'fictional-v1',
    });
    expect(posts()[0]).not.toHaveProperty('sessionId');
  });
  it('keeps unapproved contact collection and incomplete configuration disabled', () => {
    const { container } = render(<RequestForm fallback config={null} />);
    expect(container.childElementCount).toBe(0);
    expect(contributionConfig()).toBeNull();
    vi.stubEnv('VITE_REQUESTS_ENABLED', 'true');
    vi.stubEnv('VITE_REQUESTS_CONFIG', '{}');
    expect(contributionConfig()).toBeNull();
    render(
      <RequestForm
        fallback
        config={{ ...config, policy: { ...config.policy, demoOffers: false } }}
      />,
    );
    expect(screen.queryByLabelText('Offer to record a demo')).toBeNull();
  });
});
