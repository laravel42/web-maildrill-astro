import { useState } from 'react';
import { mockContactSubmit } from '@/lib/app/services';

type Status = 'idle' | 'loading' | 'success' | 'error';

const TOPICS = ['Talk to sales', 'Book a demo', 'Technical support', 'Partnerships', 'Something else'];

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;

    const form = event.currentTarget;
    // Enforce native constraints (required / type=email) despite noValidate.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const firstName = String(data.get('firstName') || '').trim();
    const lastName = String(data.get('lastName') || '').trim();
    const email = String(data.get('email') || '').trim();
    const topic = String(data.get('topic') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (!firstName || !lastName || !email || !message) {
      setError('Please complete all fields.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      // Placeholder submit — no backend wired yet (see services.ts).
      await mockContactSubmit({ firstName, lastName, email, topic, message });
      setStatus('success');
      form.reset();
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="cf">
      {status === 'success' ? (
        <div className="cf__success" role="status">
          <div className="cf__successicon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h2>Message sent</h2>
          <p>Thanks — we'll get back to you within one business day.</p>
          <button type="button" className="cf__ghost" onClick={() => setStatus('idle')}>
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate method="post" action="#">
          <div className="cf__row">
            <label className="cf__field">
              <span className="cf__label">First name</span>
              <input className="cf__input" name="firstName" autoComplete="given-name" required />
            </label>
            <label className="cf__field">
              <span className="cf__label">Last name</span>
              <input className="cf__input" name="lastName" autoComplete="family-name" required />
            </label>
          </div>
          <label className="cf__field">
            <span className="cf__label">Work email</span>
            <input className="cf__input" type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@company.com" required />
          </label>
          <label className="cf__field">
            <span className="cf__label">What can we help with?</span>
            <select className="cf__input cf__select" name="topic" defaultValue={TOPICS[0]}>
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="cf__field">
            <span className="cf__label">Message</span>
            <textarea className="cf__input cf__textarea" name="message" rows={4} placeholder="Tell us a bit about your use case and volume…" required />
          </label>
          {error && (
            <p className="cf__error" role="alert">
              {error}
            </p>
          )}
          <button className="cf__submit" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending…' : 'Send message'}
          </button>
          <p className="cf__note">By submitting, you agree to our privacy policy.</p>
        </form>
      )}

      <style>{`
        .cf__row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .cf__field { display: block; margin-bottom: 16px; }
        .cf__label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .cf__input {
          width: 100%; box-sizing: border-box; padding: 11px 14px; border-radius: 10px;
          border: 1px solid var(--border2); font-size: 15px; background: var(--surface3);
          color: var(--text); outline: none; transition: border-color .15s, box-shadow .15s;
        }
        .cf__input:focus { border-color: var(--accent); box-shadow: var(--focus-ring); }
        .cf__input::placeholder { color: var(--muted); }
        .cf__select { cursor: pointer; }
        .cf__textarea { resize: vertical; min-height: 110px; line-height: 1.5; }
        .cf__row .cf__field { margin-bottom: 0; }
        .cf__error { color: var(--danger); font-size: 13px; font-weight: 500; margin: 0 0 14px; }
        .cf__submit {
          width: 100%; padding: 13px; border-radius: 10px; border: none; background: var(--accent);
          color: #fff; font-size: 15px; font-weight: 600; transition: background .15s;
        }
        .cf__submit:hover:not(:disabled) { background: var(--accent-hover); }
        .cf__submit:disabled { opacity: .7; cursor: default; }
        .cf__note { font-size: 12px; color: var(--muted); text-align: center; margin: 14px 0 0; }
        .cf__success { text-align: center; padding: 40px 0; animation: pop .5s var(--ease-out) both; }
        .cf__successicon {
          width: 56px; height: 56px; margin: 0 auto 18px; border-radius: 50%;
          background: var(--success-bg); color: var(--success);
          display: flex; align-items: center; justify-content: center;
        }
        .cf__success h2 { font-size: 24px; font-weight: 700; letter-spacing: -.02em; margin: 0 0 8px; }
        .cf__success p { font-size: 15px; color: var(--text3); margin: 0; }
        .cf__ghost {
          margin-top: 20px; padding: 11px 18px; border-radius: 10px; border: 1px solid var(--border2);
          background: var(--surface); font-size: 14px; font-weight: 600; color: var(--text);
        }
        .cf__ghost:hover { background: var(--surface3); }
        @media (max-width: 520px) { .cf__row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
