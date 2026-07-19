import { useMemo, useRef, useState } from 'react';
import { CHANNEL_META, CURRENCIES, SETUP, TIERS, type ChannelKey } from '@/config/pricing';
import { channelRates, estimate, makeFormatters } from '@/lib/pricing-math';
import { CHANNEL_SVG, CONTACT, COUNTRIES } from './PricingEstimator.logic';
import styles from './PricingEstimator.module.css';

function ChannelIcon({ k, size }: { k: ChannelKey; size: number }) {
  const isFilled = k === 'whatsapp';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={isFilled ? 'currentColor' : 'none'}
      stroke={isFilled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: CHANNEL_SVG[k] }}
    />
  );
}

export default function PricingEstimator() {
  const [usage, setUsage] = useState<Record<ChannelKey, number>>({
    email: 250_000,
    sms: 20_000,
    whatsapp: 8_000,
    voice: 4_000,
  });
  const [tier, setTier] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [country, setCountry] = useState('US');
  const [countryQuery, setCountryQuery] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cur = CURRENCIES.find((c) => c.code === currency)!;
  const selected = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];
  const countryName = selected.name;

  const R = channelRates(selected);
  const disc = TIERS[tier].disc;

  // ---- formatters + estimate math (pure, unit-tested in lib/pricing-math) ----
  const { money, rate, whole, fmt } = makeFormatters(cur);
  const commitLabel = (v: number) => (v > 0 ? `${whole(v)} / yr prepaid` : 'No commitment');

  const est = estimate(usage, R, tier);
  const { usage: usageDisc, setup, activeCount, annualSave, hasDiscount, discountPct } = est;
  const firstLabel = hasDiscount ? 'First month + setup' : 'First month total';
  const subline = hasDiscount
    ? `then ${money(usageDisc)}/mo · ${commitLabel(TIERS[tier].commit)}`
    : `then ${money(usageDisc)}/mo at this volume`;
  const ctaLabel = hasDiscount ? `Prepay & save ${discountPct}` : 'Start free — pay as you go';

  // ---- country combobox ----
  const allCountries = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const filtered = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    const base = q ? allCountries.filter((c) => c.name.toLowerCase().includes(q)) : allCountries;
    return base.slice(0, 60);
  }, [allCountries, countryQuery]);
  const inputValue = countryOpen ? countryQuery : countryName;

  const selectCountry = (code: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setCountry(code);
    setCountryOpen(false);
    setCountryQuery('');
  };

  const rateCard = (m: (typeof CHANNEL_META)[number]) => {
    const isEmail = m.key === 'email';
    return (
      <div className={styles.card} data-card key={m.key}>
        <div className={styles.cardHead}>
          <span className={styles.chip} style={{ background: m.tint, color: m.color }}>
            <ChannelIcon k={m.key} size={20} />
          </span>
          <span className={styles.cardLabel}>{m.label}</span>
        </div>
        <div className={`${styles.cardPrice} mono`}>{rate(R[m.key])}</div>
        <div className={styles.cardUnit}>{m.unit.replace('{country}', countryName)}</div>
        <div className={styles.cardFoot}>
          <span>One-time setup</span>
          <span className={`mono ${styles.cardSetup}`}>{isEmail ? 'Free' : whole(SETUP[m.key])}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.pc}>
      {/* ---------------- rate cards ---------------- */}
      <section className={`${styles.rates} container--wide`} aria-label="Per-message rates">
        <div className={styles.controls}>
          <div className={styles.control}>
            <span className={`${styles.clabel} mono`}>Destination</span>
            <div className={styles.combo}>
              <input
                type="text"
                role="combobox"
                aria-expanded={countryOpen}
                aria-controls="pc-country-list"
                aria-autocomplete="list"
                aria-label="Destination country"
                aria-activedescendant={
                  countryOpen && filtered.length > 0 ? `pc-country-opt-${activeIndex}` : undefined
                }
                autoComplete="off"
                className={styles.comboInput}
                placeholder="Search countries…"
                value={inputValue}
                onFocus={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  setCountryOpen(true);
                  setCountryQuery('');
                  setActiveIndex(0);
                }}
                onChange={(e) => {
                  setCountryQuery(e.target.value);
                  setCountryOpen(true);
                  setActiveIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (!countryOpen) setCountryOpen(true);
                    setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    if (countryOpen && filtered[activeIndex]) {
                      e.preventDefault();
                      selectCountry(filtered[activeIndex].code);
                    }
                  } else if (e.key === 'Escape') {
                    setCountryOpen(false);
                  }
                }}
                onBlur={() => {
                  blurTimer.current = setTimeout(() => setCountryOpen(false), 150);
                }}
              />
              <svg
                className={styles.comboCaret}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              {countryOpen && (
                <ul className={styles.comboList} id="pc-country-list" role="listbox">
                  {filtered.length === 0 ? (
                    <li className={styles.comboEmpty}>No countries match</li>
                  ) : (
                    filtered.map((c, i) => (
                      <li
                        key={c.code}
                        id={`pc-country-opt-${i}`}
                        role="option"
                        aria-selected={i === activeIndex}
                      >
                        <button
                          type="button"
                          tabIndex={-1}
                          className={`${styles.comboOpt}${c.code === country ? ' is-selected' : ''}${i === activeIndex ? ' is-active' : ''}`}
                          onMouseEnter={() => setActiveIndex(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectCountry(c.code);
                          }}
                        >
                          <span>{c.name}</span>
                          <span className={`mono ${styles.comboRate}`}>{rate(c.sms)}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.control}>
            <span className={`${styles.clabel} mono`}>Currency</span>
            <div className={styles.seg} role="group" aria-label="Currency">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={`${styles.segBtn}${c.code === currency ? ' is-active' : ''}`}
                  aria-pressed={c.code === currency}
                  onClick={() => setCurrency(c.code)}
                >
                  <span className={`mono ${styles.segSym}`}>{c.sym}</span>
                  {c.code}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.ratecards}>{CHANNEL_META.map(rateCard)}</div>

        <p className={styles.ratenote}>
          Rates shown for {countryName} in {currency} as the average across supported networks.
          WhatsApp uses the Marketing conversation rate. Exact prices vary by network and applicable
          discounts — full per-country rates are in your dashboard. Setup is a one-time fee charged
          the first time you activate a channel. Volume discounts kick in automatically past 1M
          messages — <a href={CONTACT}>talk to sales</a>.
        </p>
      </section>

      {/* ---------------- estimator ---------------- */}
      <section className={styles.estimator} aria-label="Monthly bill estimator">
        <div className={`container ${styles.estimatorInner}`}>
          <p className="eyebrow">Estimator</p>
          <h2 className={`h-section ${styles.h2}`}>Estimate your monthly bill.</h2>

          <div className={styles.tiertabs} role="group" aria-label="Billing model">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.tiertab}${t.id === tier ? ' is-active' : ''}`}
                aria-pressed={t.id === tier}
                onClick={() => setTier(t.id)}
              >
                <span className={styles.tiertabName}>{t.short}</span>
                <span className={`mono ${styles.tiertabLabel}${t.disc > 0 ? ` ${styles.isDisc}` : ''}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.estgrid}>
            <div className={styles.sliders}>
              {CHANNEL_META.map((m) => {
                const count = fmt(usage[m.key]);
                const cost = money(usage[m.key] * R[m.key] * (1 - disc));
                return (
                  <div className={styles.slider} key={m.key}>
                    <div className={styles.sliderHead}>
                      <span className={styles.sliderLabel}>
                        <span
                          className={`${styles.chip} ${styles.chipSm}`}
                          style={{ background: m.tint, color: m.color }}
                        >
                          <ChannelIcon k={m.key} size={14} />
                        </span>
                        {m.label}
                      </span>
                      <span className={`mono ${styles.sliderVal}`}>
                        {count} {m.noun} · <b>{cost}</b>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={m.max}
                      step={m.step}
                      value={usage[m.key]}
                      aria-label={`${m.label} ${m.noun} per month`}
                      style={{ accentColor: m.color }}
                      onChange={(e) => setUsage((u) => ({ ...u, [m.key]: Number(e.target.value) }))}
                    />
                  </div>
                );
              })}
            </div>

            <div className={styles.estcard}>
              <div className={styles.estcardHead}>
                <span className={`mono ${styles.estcardKicker}`}>Your estimate</span>
                {hasDiscount && <span className={`mono ${styles.estcardPill}`}>−{discountPct}</span>}
              </div>
              <div className={styles.estcardRow}>
                <span>Monthly usage</span>
                <span className={`mono ${styles.estcardNum}`}>{money(usageDisc)}</span>
              </div>
              <div className={`${styles.estcardRow} ${styles.estcardRowDivider}`}>
                <span>
                  One-time setup <span className={styles.estcardDim}>({activeCount} ch.)</span>
                </span>
                <span className={`mono ${styles.estcardNum}`}>{money(setup)}</span>
              </div>
              <div className={styles.estcardTotal}>
                <span className={styles.estcardTotallabel}>{firstLabel}</span>
                <span className={`mono ${styles.estcardTotalnum}`}>{money(usageDisc + setup)}</span>
              </div>
              <p className={styles.estcardSub}>{subline}</p>
              {hasDiscount && (
                <div className={styles.estcardSave}>
                  <svg
                    width="16"
                    height="16"
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
                  <span>
                    You save <b className="mono">{money(annualSave)}</b> per year
                  </span>
                </div>
              )}
              <a href="/signup" className={styles.estcardCta}>
                {ctaLabel}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- annual prepay ---------------- */}
      <section className={`${styles.prepay} container--wide`} aria-label="Annual prepay tiers">
        <p className="eyebrow">Annual prepay</p>
        <h2 className={`h-section ${styles.h2}`}>Prepay a year, send for less.</h2>
        <p className={styles.prepayIntro}>
          Commit to an annual usage balance up front and every per-message rate drops. Unused credit
          rolls over for the year — you're never charged more than you send.
        </p>
        <div className={styles.prepaycards}>
          {TIERS.map((t) => (
            <div key={t.id} data-card className={`${styles.pcard}${t.hi ? ` ${styles.pcardHi}` : ''}`}>
              <div className={styles.pcardName}>{t.name}</div>
              <div className={styles.pcardTag}>{t.tagline}</div>
              <div className={styles.pcardDisc}>
                <span className={`mono ${styles.pcardPct}`}>{Math.round(t.disc * 100)}%</span>
                <span className={styles.pcardOff}>off rates</span>
              </div>
              <div className={styles.pcardCommit}>{commitLabel(t.commit)}</div>
              <div className={styles.pcardDivider} />
              <p className={styles.pcardNote}>{t.note}</p>
            </div>
          ))}
        </div>
        <p className={styles.prepayNote}>
          Discounts apply to usage only; one-time setup fees are unaffected. Need a larger
          commitment? <a href={CONTACT}>Talk to sales →</a>
        </p>
      </section>
    </div>
  );
}
