import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  countryFlagSrc,
  flagEmoji,
  formatNational,
  matchInternational,
  maxNationalLen,
  nationalLengthError,
  phoneCountry,
  PHONE_COUNTRIES,
  toE164,
} from '@/lib/app/phone-countries';
import styles from './PhoneField.module.css';

/**
 * Guided phone input: country selector (flag + international prefix) beside a
 * national-number input with as-you-type grouping and length validation. The
 * E.164 value is exposed through a hidden input so a plain <form> +
 * FormData("…").get(name) keeps working; invalid lengths surface through
 * native form validity (setCustomValidity), so the host form's
 * checkValidity()/reportValidity() gate catches them.
 *
 * The country selector is the app's styled listbox pattern (trigger button +
 * role="listbox" menu with outside-click close), matching the editor headers'
 * language picker rather than an OS-native dropdown.
 */
export default function PhoneField({
  name = 'phone',
  required = false,
  defaultIso = 'US',
  defaultValue,
  onValueChange,
  onInvalidMessage,
  compact = false,
}: {
  name?: string;
  required?: boolean;
  defaultIso?: string;
  /** Optional E.164 seed (e.g. profile edit). Skips locale auto-detect when set. */
  defaultValue?: string | null;
  /** Fires with the current E.164 value (empty string when national digits are blank). */
  onValueChange?: (e164: string) => void;
  /** Override the native too-short message, e.g. to match host-form copy. */
  onInvalidMessage?: (message: string) => string;
  /** Dense settings-form sizing (37px, matching AppProfile inputs); default is the auth-page size. */
  compact?: boolean;
}) {
  const seeded = defaultValue ? matchInternational(defaultValue) : null;
  const [iso, setIso] = useState(seeded?.country.iso ?? defaultIso);
  const [digits, setDigits] = useState(seeded?.digits ?? '');
  const [open, setOpen] = useState(false);
  // CDN flag failed to load (offline dev) — fall back to the emoji flag.
  const [flagBroken, setFlagBroken] = useState(false);
  const touched = useRef(Boolean(seeded));
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const numRef = useRef<HTMLInputElement>(null);

  const country = phoneCountry(iso) ?? PHONE_COUNTRIES[0];
  const e164 = toE164(digits, country);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    onValueChangeRef.current?.(e164);
  }, [e164]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Open with the current country in view.
  useEffect(() => {
    if (open) {
      listRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  const chooseCountry = (nextIso: string) => {
    touched.current = true;
    setIso(nextIso);
    setOpen(false);
    numRef.current?.focus();
  };

  // A different country's flag may load fine — retry after a switch.
  useEffect(() => setFlagBroken(false), [iso]);

  // Deterministic SSR (defaultIso), then localize the initial country from the
  // browser locale after hydration — only while the field is untouched and no
  // E.164 default was provided.
  useEffect(() => {
    if (touched.current) return;
    try {
      const region = new Intl.Locale(navigator.language).region;
      if (region && phoneCountry(region)) setIso(region.toUpperCase());
    } catch {
      /* unknown locale — keep the default */
    }
  }, []);

  // Too-short numbers block submit through native form validity.
  useEffect(() => {
    const message = nationalLengthError(digits, country);
    numRef.current?.setCustomValidity(
      message && onInvalidMessage ? onInvalidMessage(message) : message,
    );
  }, [digits, country, onInvalidMessage]);

  const onNumChange = (e: ChangeEvent<HTMLInputElement>) => {
    touched.current = true;
    const raw = e.target.value;
    // A pasted/typed international number ("+52 33 …", "0052…") switches the
    // country and keeps the national remainder.
    const intl = matchInternational(raw);
    if (intl) {
      setIso(intl.country.iso);
      setDigits(intl.digits.slice(0, maxNationalLen(intl.country)));
      return;
    }
    setDigits(raw.replace(/\D/g, '').slice(0, maxNationalLen(country)));
  };

  return (
    <div
      className={`${styles.wrap}${compact ? ` ${styles.wrapCompact}` : ''}`}
      ref={wrapRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={styles.country}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code, ${country.name} +${country.dial}`}
        onClick={() => setOpen((o) => !o)}
      >
        {flagBroken ? (
          <span className={styles.flag} aria-hidden="true">
            {flagEmoji(country.iso)}
          </span>
        ) : (
          <img
            className={styles.flagImg}
            src={countryFlagSrc(country.iso)}
            alt=""
            decoding="async"
            onError={() => setFlagBroken(true)}
          />
        )}
        <span className={`${styles.dial} tnum`}>+{country.dial}</span>
        <svg
          className={styles.chevron}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className={styles.menu} role="listbox" aria-label="Country code" ref={listRef}>
          {PHONE_COUNTRIES.map((c) => (
            <li key={c.iso} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={c.iso === country.iso}
                className={`${styles.option}${c.iso === country.iso ? ` ${styles.optionActive}` : ''}`}
                onClick={() => chooseCountry(c.iso)}
              >
                <img
                  className={styles.flagImg}
                  src={countryFlagSrc(c.iso)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className={styles.optionName}>{c.name}</span>
                <span className={`${styles.optionDial} tnum`}>+{c.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={numRef}
        id={name === 'phone' ? 'field-phone' : undefined}
        className={styles.num}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label="Phone number"
        placeholder={formatNational('5550100000'.slice(0, maxNationalLen(country)), country)}
        required={required}
        value={formatNational(digits, country)}
        onChange={onNumChange}
      />
      <input type="hidden" name={name} value={e164} />
    </div>
  );
}
