import { useState } from 'react';
import { mockContactSubmit } from '@/lib/app/services';
import type { Status } from './ContactForm.types';
import { TOPICS } from './ContactForm.logic';
import styles from './ContactForm.module.css';

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
        <div
          className={styles.success}
          role="status"
          style={{ animation: 'pop .5s var(--ease-out) both' }}
        >
          <div className={styles.successicon}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2>Message sent</h2>
          <p>Thanks — we'll get back to you within one business day.</p>
          <button type="button" className={styles.ghost} onClick={() => setStatus('idle')}>
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate method="post" action="#">
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>First name</span>
              <input className={styles.input} name="firstName" autoComplete="given-name" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Last name</span>
              <input className={styles.input} name="lastName" autoComplete="family-name" required />
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Work email</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>What can we help with?</span>
            <select
              className={`${styles.input} ${styles.select}`}
              name="topic"
              defaultValue={TOPICS[0]}
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Message</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              name="message"
              rows={4}
              placeholder="Tell us a bit about your use case and volume…"
              required
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button className={styles.submit} type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending…' : 'Send message'}
          </button>
          <p className={styles.note}>By submitting, you agree to our privacy policy.</p>
        </form>
      )}
    </div>
  );
}
