import { useMemo, useRef, useState } from 'react';
import {
  CHANNEL_META,
  COMPARISON,
  COMPARISON_TOOLS,
  CURRENCIES,
  PROMO,
  SETUP_FEE,
  TIERS,
  tierCommit,
  tierDisc,
  tierHasPromo,
  type ChannelKey,
  type CompareTool,
} from '@/config/pricing';
import { channelRates, estimate, makeFormatters } from '@/lib/pricing-math';
import {
  BASE_USAGE,
  CHANNEL_SVG,
  CONTACT,
  COUNTRIES,
  PLAN_VOLUME_MULTIPLIER,
} from './PricingEstimator.logic';
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

export default function PricingEstimator({ promoActive = false }: { promoActive?: boolean }) {
  const [usage, setUsage] = useState<Record<ChannelKey, number>>({ ...BASE_USAGE });
  const [usageTouched, setUsageTouched] = useState(false);
  const [tier, setTier] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [country, setCountry] = useState('US');
  const [countryQuery, setCountryQuery] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cur = CURRENCIES.find((c) => c.code === currency)!;
  const selected = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];
  const countryName = selected.name;

  const R = channelRates(selected);
  const selectedTier = TIERS[tier];
  const disc = tierDisc(selectedTier, promoActive);

  // ---- formatters + estimate math (pure, unit-tested in lib/pricing-math) ----
  const { money, rate, whole, fmt } = makeFormatters(cur);
  const commitLabel = (v: number) => (v > 0 ? `${whole(v)} / yr prepaid` : 'No commitment');
  const pct = (d: number) => `${Math.round(d * 100)}%`;

  // Parses a comparison price string ("~$0.012*", "$0.0007", "—", "Variable")
  // and returns the numeric rate, or null when the tool doesn't publish one.
  const parseCompareRate = (raw: string) => {
    const match = raw.match(/[\d.]+/);
    return match ? Number(match[0]) : null;
  };
  // % more expensive than Maildrill for a given competitor on this channel.
  const comparePct = (compareRow: (typeof COMPARISON)[number], tool: CompareTool) => {
    const base = parseCompareRate(compareRow.prices.Maildrill);
    const other = parseCompareRate(compareRow.prices[tool]);
    if (base === null || other === null || base === 0) return null;
    return Math.round(((other - base) / base) * 100);
  };
  // Shorten the long "per X · {country}" unit strings for the compact card back.
  const shortUnit = (unit: string) =>
    unit
      .replace('per marketing conversation', 'per convo')
      .replace('per marketing message', 'per msg')
      .replace(', one flat rate worldwide', '')
      .replace('{country}', countryName);

  const est = estimate(usage, R, tier, promoActive);
  const { usage: usageDisc, setup, annualSave, hasDiscount, discountPct } = est;
  const firstLabel = hasDiscount ? 'First month + setup' : 'First month total';
  const effCommit = tierCommit(selectedTier, promoActive);
  const promoOnTier = tierHasPromo(selectedTier, promoActive);
  const ctaLabel = hasDiscount ? `Prepay & save ${discountPct}` : 'Start free — pay as you go';

  // Switch plan. Until the user drags a slider, moving to a paid plan scales the
  // send mix up to a generous multiple of that plan's annual commitment
  // ($3k/$6k/$12k), so the sliders visibly jump between plans. Pay-as-you-go
  // resets to the defaults.
  const selectTier = (id: number) => {
    setTier(id);
    if (usageTouched) return;
    if (id === 0) {
      setUsage({ ...BASE_USAGE });
      return;
    }
    const t = TIERS[id];
    const baseMonthly = CHANNEL_META.reduce((sum, m) => sum + BASE_USAGE[m.key] * R[m.key], 0);
    const target = (t.commit * PLAN_VOLUME_MULTIPLIER) / 12;
    const factor = target / (baseMonthly * (1 - tierDisc(t, promoActive)));
    setUsage(
      Object.fromEntries(
        CHANNEL_META.map((m) => {
          const scaled = Math.round((BASE_USAGE[m.key] * factor) / m.step) * m.step;
          return [m.key, Math.max(0, Math.min(m.max, scaled))];
        }),
      ) as Record<ChannelKey, number>,
    );
  };

  const captureEstimate = (nextUsage: Record<ChannelKey, number>, nextCountry: string) => {
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(() => {
      window.posthog?.capture('pricing_estimate_calculated', {
        country: nextCountry,
        email_volume: nextUsage.email,
        sms_volume: nextUsage.sms,
        whatsapp_volume: nextUsage.whatsapp,
        voice_volume: nextUsage.voice,
        currency,
      });
    }, 1000);
  };

  // ---- country combobox ----
  const allCountries = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const filtered = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    // Show every destination — the list is scrollable. (Previously capped at 60,
    // which truncated the 222-country list at ~"El Salvador".)
    return q ? allCountries.filter((c) => c.name.toLowerCase().includes(q)) : allCountries;
  }, [allCountries, countryQuery]);
  const inputValue = countryOpen ? countryQuery : countryName;

  const selectCountry = (code: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setCountry(code);
    setCountryOpen(false);
    setCountryQuery('');
    captureEstimate(usage, code);
  };

  const rateCard = (m: (typeof CHANNEL_META)[number]) => {
    const isEmail = m.key === 'email';
    const compareRow = COMPARISON.find((row) => row.channel.toLowerCase() === m.label.toLowerCase());
    const compareTools = COMPARISON_TOOLS.filter((tool) => tool !== 'Maildrill');
    return (
      <div className={styles.card} data-card key={m.key} tabIndex={0}>
        <div className={styles.cardFlip}>
          <div className={styles.cardFront}>
            <div className={styles.cardHead}>
              <span className={styles.chip} style={{ background: m.tint, color: m.color }}>
                <ChannelIcon k={m.key} size={20} />
              </span>
              <span className={styles.cardLabel}>{m.label}</span>
            </div>
            <div className={`${styles.cardPrice} mono`}>{rate(R[m.key])}</div>
            <div className={styles.cardUnit}>{m.unit.replace('{country}', countryName)}</div>
            <div className={styles.cardFoot}>
              <span>{isEmail ? 'One-time setup' : 'Setup · shared number'}</span>
              <span className={`mono ${styles.cardSetup}`}>
                {isEmail ? 'Free' : whole(SETUP_FEE)}
              </span>
            </div>
          </div>
          <div className={styles.cardBack}>
            <div className={styles.cardBackTitle}>Cheaper than the market by</div>
            {compareRow ? (
              <div className={styles.cardBackRows}>
                {compareTools.map((tool) => {
                  const diff = comparePct(compareRow, tool);
                  return (
                    <div className={styles.cardBackRow} key={tool}>
                      <span className={styles.cardBackTool}>{tool}</span>
                      <span className={`mono ${styles.cardBackPrice}`}>
                        {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className={styles.cardBackNote}>{shortUnit(compareRow?.unit ?? m.unit)}</p>
          </div>
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
          discounts — full per-country rates are in your dashboard. A single $49 number setup covers
          SMS, WhatsApp, and voice together — charged once, not per channel (email is free). Volume
          discounts kick in automatically past 1M messages — <a href={CONTACT}>talk to sales</a>.
        </p>
      </section>

      {/* ---------------- estimator ---------------- */}
      <section className={styles.estimator} aria-label="Monthly bill estimator">
        <div className={styles.estimatorInner}>
          <p className="eyebrow">Estimator</p>
          <h2 className={`h-section ${styles.h2}`}>Estimate your monthly bill.</h2>

          {promoActive && (
            <p className={styles.promobanner} role="note">
              <span className={`${styles.promobannerTag} mono`}>Launch promo</span>
              <span className={styles.promobannerText}>
                Deeper prepay discounts for a lower commitment —{' '}
                <span className={styles.promobannerDeadline}>through {PROMO.endsAtLabel}.</span>
              </span>
            </p>
          )}

          <div className={styles.tierbar}>
            <div className={styles.tiertabs} role="group" aria-label="Billing model">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.tiertab}${t.id === tier ? ' is-active' : ''}`}
                  aria-pressed={t.id === tier}
                  onClick={() => selectTier(t.id)}
                >
                  <span className={styles.tiertabName}>{t.short}</span>
                  {tierHasPromo(t, promoActive) ? (
                    <span className={`mono ${styles.tiertabLabel} ${styles.isDisc}`}>
                      <s className={styles.was}>−{pct(t.disc)}</s> −{pct(tierDisc(t, promoActive))}
                    </span>
                  ) : (
                    <span
                      className={`mono ${styles.tiertabLabel}${t.disc > 0 ? ` ${styles.isDisc}` : ''}`}
                    >
                      {t.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
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
                      onChange={(e) => {
                        setUsageTouched(true);
                        const next = { ...usage, [m.key]: Number(e.target.value) };
                        setUsage(next);
                        captureEstimate(next, country);
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className={styles.estcard}>
              <div className={styles.estcardHead}>
                <span className={`mono ${styles.estcardKicker}`}>Your estimate</span>
                {hasDiscount && (
                  <span className={`mono ${styles.estcardPill}`}>−{discountPct}</span>
                )}
              </div>
              <div className={styles.estcardRow}>
                <span>Monthly usage</span>
                <span className={`mono ${styles.estcardNum}`}>{money(usageDisc)}</span>
              </div>
              <div className={`${styles.estcardRow} ${styles.estcardRowDivider}`}>
                <span>
                  One-time setup
                  {setup > 0 && <span className={styles.estcardDim}> · one number</span>}
                </span>
                <span className={`mono ${styles.estcardNum}`}>{money(setup)}</span>
              </div>
              <div className={styles.estcardTotal}>
                <span className={styles.estcardTotallabel}>{firstLabel}</span>
                <span className={`mono ${styles.estcardTotalnum}`}>{money(usageDisc + setup)}</span>
              </div>
              <p className={styles.estcardSub}>
                {hasDiscount ? (
                  <>
                    then {money(usageDisc)}/mo ·{' '}
                    {promoOnTier && <s className={styles.was}>{whole(selectedTier.commit)}</s>}{' '}
                    {commitLabel(effCommit)}
                  </>
                ) : (
                  <>then {money(usageDisc)}/mo at this volume</>
                )}
              </p>
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
          {TIERS.map((t) => {
            const promoOn = tierHasPromo(t, promoActive);
            return (
              <div
                key={t.id}
                data-card
                className={`${styles.pcard}${t.hi ? ` ${styles.pcardHi}` : ''}`}
              >
                {promoOn && <div className={`${styles.pcardRibbon} mono`}>Launch promo</div>}
                <div className={styles.pcardName}>{t.name}</div>
                <div className={styles.pcardTag}>{t.tagline}</div>
                <div className={styles.pcardDisc}>
                  {promoOn && <s className={`mono ${styles.pcardPctwas}`}>{pct(t.disc)}</s>}
                  <span className={`mono ${styles.pcardPct}`}>{pct(tierDisc(t, promoActive))}</span>
                  <span className={styles.pcardOff}>off rates</span>
                </div>
                <div className={styles.pcardCommit}>
                  {promoOn && t.commit > 0 && <s className={styles.was}>{commitLabel(t.commit)}</s>}{' '}
                  {commitLabel(tierCommit(t, promoActive))}
                </div>
                <div className={styles.pcardDivider} />
                <p className={styles.pcardNote}>{t.note}</p>
              </div>
            );
          })}
        </div>
        <p className={styles.prepayNote}>
          Discounts apply to usage only; one-time setup fees are unaffected. Need a larger
          commitment? <a href={CONTACT}>Talk to sales →</a>
        </p>
      </section>
    </div>
  );
}
