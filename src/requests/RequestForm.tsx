import './requests.css';
import { useRef, useState } from 'react';
import {
  ContributionSchema,
  type Contribution,
  type ContributionConfig,
} from '../contracts/contribution';
import { contributionConfig } from './config';
import { sendContribution } from './sendContribution';

export function RequestForm({
  fallback,
  config = contributionConfig(),
}: {
  fallback: boolean;
  config?: ContributionConfig | null;
}) {
  const [kind, setKind] = useState<'topic' | 'demo'>('topic');
  const [topic, setTopic] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'saved' | 'failed'>(
    'idle',
  );
  const pending = useRef<Contribution | null>(null);
  const sending = useRef(false);
  if (!config) return null;
  const { policy, endpoint } = config;
  const edit = () => {
    pending.current = null;
    setStatus('idle');
  };
  async function submit() {
    if (sending.current) return;
    const parsed = ContributionSchema.safeParse(
      pending.current ?? {
        schemaVersion: 1,
        type: 'contribution',
        requestId: crypto.randomUUID(),
        time: new Date().toISOString(),
        policyVersion: policy.version,
        kind,
        topic,
        ...(kind === 'demo' ? { email, consent } : {}),
      },
    );
    if (!parsed.success) {
      setStatus('failed');
      return;
    }
    pending.current = parsed.data;
    sending.current = true;
    setStatus('sending');
    const saved = await sendContribution(endpoint, parsed.data);
    sending.current = false;
    setStatus(saved ? 'saved' : 'failed');
    if (saved) {
      pending.current = null;
      setTopic('');
      setEmail('');
      setConsent(false);
    }
  }
  return (
    <section className="request-section" aria-labelledby="request-heading">
      {fallback && (
        <p className="request-link">
          Missing a topic?{' '}
          <a href="#request-heading">Request a video or offer a demo</a>.
        </p>
      )}
      <h2 id="request-heading" tabIndex={-1}>
        Suggest a Sprint video
      </h2>
      <p>{policy.topicPrompt}</p>
      {policy.demoOffers && <p>{policy.demoInvitation}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-describedby="request-notice"
      >
        <p id="request-notice">
          {policy.purpose} {policy.access} Review owner: {policy.owner}. Entries
          and contact details are deleted after {policy.retentionDays} days.
          Nothing is published automatically. Leave personal details out of the
          topic.
        </p>
        <fieldset disabled={status === 'sending'}>
          <legend>What would you like to do?</legend>
          <label className="request-option">
            <input
              type="radio"
              name="request-kind"
              checked={kind === 'topic'}
              onChange={() => {
                setKind('topic');
                setEmail('');
                setConsent(false);
                edit();
              }}
            />{' '}
            Request a topic, no contact details needed
          </label>
          {policy.demoOffers && (
            <label className="request-option">
              <input
                type="radio"
                name="request-kind"
                checked={kind === 'demo'}
                onChange={() => {
                  setKind('demo');
                  edit();
                }}
              />{' '}
              Offer to record a demo
            </label>
          )}
          <div className="field">
            <label htmlFor="request-topic">Topic or demo idea</label>
            <textarea
              id="request-topic"
              required
              maxLength={1000}
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                edit();
              }}
            />
          </div>
          {kind === 'demo' && policy.demoOffers && (
            <>
              <div className="field">
                <label htmlFor="request-email">
                  Email for the Sprint team to follow up
                </label>
                <input
                  id="request-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    edit();
                  }}
                />
              </div>
              <label className="request-option">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    edit();
                  }}
                />{' '}
                I agree to the contact use and retention described above.
              </label>
            </>
          )}
          <button className="btn btn-primary" type="submit">
            {status === 'sending'
              ? 'Sending…'
              : status === 'failed'
                ? 'Retry submission'
                : 'Send for staff review'}
          </button>
        </fieldset>
        <p role="status">
          {status === 'saved' &&
            'Submitted for staff review. Thank you for your suggestion.'}
          {status === 'failed' &&
            'Submission could not be confirmed. Your entries are still here. Check the fields and try again.'}
          {status === 'sending' && 'Sending your suggestion for staff review…'}
        </p>
      </form>
    </section>
  );
}
