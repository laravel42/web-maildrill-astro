import { useMemo, useRef, useState } from 'react';
import ratesData from '@/config/pricing-rates.json';
import {
  CHANNEL_META,
  CURRENCIES,
  PROMO,
  SETUP_FEE,
  TIERS,
  tierCommit,
  tierDisc,
  tierHasPromo,
  type ChannelKey,
} from '@/config/pricing';
import { channelRates, estimate, makeFormatters } from '@/lib/pricing-math';

type Country = { code: string; name: string; sms: number; whatsapp: number; voice: number };
const COUNTRIES = ratesData.countries as Country[];
const CONTACT = '/contact';

/** Default send mix (Monthly / pay-as-you-go) — also the base the plan
 *  auto-scaling multiplies from. */
const BASE_USAGE: Record<ChannelKey, number> = {
  email: 50_000,
  sms: 2_000,
  whatsapp: 2_000,
  voice: 1_000,
};

/** How aggressively paid plans scale the send volumes, as a multiple of the
 *  plan's annual commitment. Higher = bigger, more visible slider jumps. */
const PLAN_VOLUME_MULTIPLIER = 2;

const CHANNEL_SVG: Record<ChannelKey, string> = {
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  whatsapp:
    '<path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Z"/>',
  voice:
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
};

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
  };

  const rateCard = (m: (typeof CHANNEL_META)[number]) => {
    const isEmail = m.key === 'email';
    return (
      <div className="pc-card" data-card key={m.key}>
        <div className="pc-card__head">
          <span className="pc-chip" style={{ background: m.tint, color: m.color }}>
            <ChannelIcon k={m.key} size={20} />
          </span>
          <span className="pc-card__label">{m.label}</span>
        </div>
        <div className="pc-card__price mono">{rate(R[m.key])}</div>
        <div className="pc-card__unit">{m.unit.replace('{country}', countryName)}</div>
        <div className="pc-card__foot">
          <span>{isEmail ? 'One-time setup' : 'Setup · shared number'}</span>
          <span className="mono pc-card__setup">{isEmail ? 'Free' : whole(SETUP_FEE)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="pc">
      {/* ---------------- rate cards ---------------- */}
      <section className="pc-rates container--wide" aria-label="Per-message rates">
        <div className="pc-controls">
          <div className="pc-control">
            <span className="pc-clabel mono">Destination</span>
            <div className="pc-combo">
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
                className="pc-combo__input"
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
                className="pc-combo__caret"
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
                <ul className="pc-combo__list" id="pc-country-list" role="listbox">
                  {filtered.length === 0 ? (
                    <li className="pc-combo__empty">No countries match</li>
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
                          className={`pc-combo__opt${c.code === country ? ' is-selected' : ''}${i === activeIndex ? ' is-active' : ''}`}
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

          <div className="pc-control">
            <span className="pc-clabel mono">Currency</span>
            <div className="pc-seg" role="group" aria-label="Currency">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={`pc-seg__btn${c.code === currency ? ' is-active' : ''}`}
                  aria-pressed={c.code === currency}
                  onClick={() => setCurrency(c.code)}
                >
                  <span className="mono pc-seg__sym">{c.sym}</span>
                  {c.code}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pc-ratecards">{CHANNEL_META.map(rateCard)}</div>

        <p className="pc-ratenote">
          Rates shown for {countryName} in {currency} as the average across supported networks.
          WhatsApp uses the Marketing conversation rate. Exact prices vary by network and applicable
          discounts — full per-country rates are in your dashboard. A single $49 number setup covers
          SMS, WhatsApp, and voice together — charged once, not per channel (email is free). Volume
          discounts kick in automatically past 1M messages — <a href={CONTACT}>talk to sales</a>.
        </p>
      </section>

      {/* ---------------- estimator ---------------- */}
      <section className="pc-estimator" aria-label="Monthly bill estimator">
        <div className="container pc-estimator__inner">
          <p className="eyebrow">Estimator</p>
          <h2 className="h-section pc-h2">Estimate your monthly bill.</h2>

          {promoActive && (
            <p className="pc-promobanner" role="note">
              <span className="pc-promobanner__tag mono">Launch promo</span>
              <span className="pc-promobanner__text">
                Deeper prepay discounts for a lower commitment —{' '}
                <span className="pc-promobanner__deadline">through {PROMO.endsAtLabel}.</span>
              </span>
            </p>
          )}

          <div className="pc-tierbar">
            <div className="pc-tiertabs" role="group" aria-label="Billing model">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`pc-tiertab${t.id === tier ? ' is-active' : ''}`}
                  aria-pressed={t.id === tier}
                  onClick={() => selectTier(t.id)}
                >
                  <span className="pc-tiertab__name">{t.short}</span>
                  {tierHasPromo(t, promoActive) ? (
                    <span className="mono pc-tiertab__label is-disc">
                      <s className="pc-was">−{pct(t.disc)}</s> −{pct(tierDisc(t, promoActive))}
                    </span>
                  ) : (
                    <span className={`mono pc-tiertab__label${t.disc > 0 ? ' is-disc' : ''}`}>
                      {t.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="pc-estgrid">
            <div className="pc-sliders">
              {CHANNEL_META.map((m) => {
                const count = fmt(usage[m.key]);
                const cost = money(usage[m.key] * R[m.key] * (1 - disc));
                return (
                  <div className="pc-slider" key={m.key}>
                    <div className="pc-slider__head">
                      <span className="pc-slider__label">
                        <span
                          className="pc-chip pc-chip--sm"
                          style={{ background: m.tint, color: m.color }}
                        >
                          <ChannelIcon k={m.key} size={14} />
                        </span>
                        {m.label}
                      </span>
                      <span className="mono pc-slider__val">
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
                        setUsage((u) => ({ ...u, [m.key]: Number(e.target.value) }));
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="pc-estcard">
              <div className="pc-estcard__head">
                <span className="mono pc-estcard__kicker">Your estimate</span>
                {hasDiscount && <span className="mono pc-estcard__pill">−{discountPct}</span>}
              </div>
              <div className="pc-estcard__row">
                <span>Monthly usage</span>
                <span className="mono pc-estcard__num">{money(usageDisc)}</span>
              </div>
              <div className="pc-estcard__row pc-estcard__row--divider">
                <span>
                  One-time setup
                  {setup > 0 && <span className="pc-estcard__dim"> · one number</span>}
                </span>
                <span className="mono pc-estcard__num">{money(setup)}</span>
              </div>
              <div className="pc-estcard__total">
                <span className="pc-estcard__totallabel">{firstLabel}</span>
                <span className="mono pc-estcard__totalnum">{money(usageDisc + setup)}</span>
              </div>
              <p className="pc-estcard__sub">
                {hasDiscount ? (
                  <>
                    then {money(usageDisc)}/mo ·{' '}
                    {promoOnTier && <s className="pc-was">{whole(selectedTier.commit)}</s>}{' '}
                    {commitLabel(effCommit)}
                  </>
                ) : (
                  <>then {money(usageDisc)}/mo at this volume</>
                )}
              </p>
              {hasDiscount && (
                <div className="pc-estcard__save">
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
              <a href="/signup" className="pc-estcard__cta">
                {ctaLabel}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- annual prepay ---------------- */}
      <section className="pc-prepay container--wide" aria-label="Annual prepay tiers">
        <p className="eyebrow">Annual prepay</p>
        <h2 className="h-section pc-h2">Prepay a year, send for less.</h2>
        <p className="pc-prepay__intro">
          Commit to an annual usage balance up front and every per-message rate drops. Unused credit
          rolls over for the year — you're never charged more than you send.
        </p>
        <div className="pc-prepaycards">
          {TIERS.map((t) => {
            const promoOn = tierHasPromo(t, promoActive);
            return (
              <div key={t.id} data-card className={`pc-pcard${t.hi ? ' pc-pcard--hi' : ''}`}>
                {promoOn && <div className="pc-pcard__ribbon mono">Launch promo</div>}
                <div className="pc-pcard__name">{t.name}</div>
                <div className="pc-pcard__tag">{t.tagline}</div>
                <div className="pc-pcard__disc">
                  {promoOn && <s className="mono pc-pcard__pctwas">{pct(t.disc)}</s>}
                  <span className="mono pc-pcard__pct">{pct(tierDisc(t, promoActive))}</span>
                  <span className="pc-pcard__off">off rates</span>
                </div>
                <div className="pc-pcard__commit">
                  {promoOn && t.commit > 0 && <s className="pc-was">{commitLabel(t.commit)}</s>}{' '}
                  {commitLabel(tierCommit(t, promoActive))}
                </div>
                <div className="pc-pcard__divider" />
                <p className="pc-pcard__note">{t.note}</p>
              </div>
            );
          })}
        </div>
        <p className="pc-prepay__note">
          Discounts apply to usage only; one-time setup fees are unaffected. Need a larger
          commitment? <a href={CONTACT}>Talk to sales →</a>
        </p>
      </section>

      <style>{`
        .pc a { color: var(--accent); }
        .pc a:hover { color: var(--accent-hover); }

        .pc-rates { padding-block: 8px 24px; }
        .pc-controls {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .pc-control { display: flex; align-items: center; gap: 12px; }
        .pc-clabel {
          font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
        }
        .pc-combo { position: relative; width: 250px; max-width: 60vw; }
        .pc-combo__input {
          width: 100%; padding: 9px 34px 9px 14px; border: 1px solid var(--border2);
          border-radius: 10px; background: var(--surface); font-size: 13px; font-weight: 600;
          color: var(--text); outline: none; transition: border-color .15s, box-shadow .15s;
        }
        .pc-combo__input:focus { border-color: var(--accent); box-shadow: var(--focus-ring); }
        .pc-combo__caret {
          position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
          color: var(--muted); pointer-events: none;
        }
        .pc-combo__list {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40;
          max-height: 288px; overflow: auto; list-style: none; margin: 0;
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          box-shadow: var(--shadow-lg); padding: 6px;
        }
        .pc-combo__opt {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 500;
          color: var(--text); background: transparent; text-align: left;
        }
        .pc-combo__opt:hover, .pc-combo__opt.is-active { background: var(--surface2); }
        .pc-combo__opt.is-selected { background: var(--accent-tint); }
        .pc-combo__opt.is-selected.is-active { background: color-mix(in srgb, var(--accent) 16%, var(--surface2)); }
        .pc-combo__empty { padding: 14px 12px; font-size: 13px; color: var(--muted); text-align: center; }

        .pc-seg {
          display: inline-flex; gap: 2px; padding: 4px; background: var(--surface2);
          border: 1px solid var(--border2); border-radius: 10px; flex-wrap: wrap;
        }
        .pc-seg__btn {
          display: flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 7px;
          font-size: 13px; font-weight: 600; color: var(--text3); background: transparent;
          transition: background .2s, color .2s;
        }
        .pc-seg__btn.is-active { background: var(--ink); color: #fff; }
        .pc-seg__sym { opacity: .7; }

        .pc-ratecards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .pc-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
          padding: 26px; display: flex; flex-direction: column;
        }
        .pc-card__head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .pc-chip {
          width: 40px; height: 40px; border-radius: 11px; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
        }
        .pc-chip--sm { width: 26px; height: 26px; border-radius: 8px; }
        .pc-card__label { font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
        .pc-card__price { font-size: 34px; font-weight: 500; letter-spacing: -.02em; }
        .pc-card__unit { font-size: 13px; color: var(--text4); margin: 6px 0 18px; }
        .pc-card__foot {
          margin-top: auto; padding-top: 18px; border-top: 1px solid var(--divider);
          display: flex; justify-content: space-between; align-items: center;
          font-size: 13px; color: var(--text3);
        }
        .pc-card__setup { font-size: 15px; font-weight: 500; color: var(--text); }
        .pc-ratenote { font-size: 13px; color: var(--text4); margin: 18px 0 0; line-height: 1.6; }
        .pc-ratenote a { font-weight: 600; }

        .pc-estimator { background: var(--surface); border-block: 1px solid var(--border); margin-top: 48px; }
        .pc-estimator__inner { padding-block: 72px; max-width: calc(1120px + 2 * var(--gutter)); }
        .pc-h2 { margin: 14px 0 40px; }
        .pc-promobanner {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          margin: -20px 0 28px;
        }
        .pc-promobanner__text {
          font-family: var(--font-mono);
          font-size: var(--fs-sm);
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text4);
        }
        .pc-promobanner__deadline {
          text-decoration: underline;
          text-decoration-color: var(--brand);
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .pc-promobanner__tag {
          font-size: 13px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          color: #fff; background: linear-gradient(135deg, var(--brand), var(--brand-hover));
          padding: 6px 14px; border-radius: 999px;
          box-shadow: 0 3px 12px rgba(255, 68, 31, .38);
        }
        .pc-was { text-decoration: line-through; opacity: .5; font-weight: 400; }
        /* Tab bar mirrors the estimator grid so the plan selector lines up with
           (and is as wide as) the sliders column. */
        .pc-tierbar {
          display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; margin-bottom: 28px;
        }
        .pc-tiertabs {
          display: flex; gap: 10px; flex-wrap: wrap;
        }
        /* Individual pills (not a joined segmented control). */
        .pc-tiertab {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 13px 16px; border-radius: 12px;
          border: 1px solid var(--border2); background: var(--surface2); color: var(--text3);
          transition: background .2s, color .2s, border-color .2s;
        }
        .pc-tiertab:hover {
          border-color: var(--border);
          background: color-mix(in srgb, var(--ink) 5%, var(--surface2));
        }
        .pc-tiertab.is-active,
        .pc-tiertab.is-active:hover {
          background: var(--ink); color: #fff; border-color: var(--ink);
        }
        .pc-tiertab__name { font-size: 16px; font-weight: 600; }
        .pc-tiertab__label { font-size: 13px; color: var(--muted); }
        .pc-tiertab__label.is-disc { color: var(--success); }
        .pc-tiertab.is-active .pc-tiertab__label { color: var(--muted2); }
        .pc-tiertab__label .pc-was { font-size: .9em; }

        .pc-estgrid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; align-items: start; }
        .pc-sliders { display: flex; flex-direction: column; gap: 26px; }
        .pc-slider__head {
          display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;
          gap: 10px; flex-wrap: wrap;
        }
        .pc-slider__label { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; }
        .pc-slider__val { font-size: 14px; color: var(--text3); }
        .pc-slider__val b { color: var(--text); font-weight: 500; }
        .pc-slider input[type='range'] {
          -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
          border-radius: 999px; background: var(--border2); outline: none;
        }
        .pc-slider input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: var(--accent); border: 3px solid #fff; box-shadow: 0 1px 4px rgba(30,27,22,.25);
          cursor: pointer;
        }
        .pc-slider input[type='range']::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: var(--accent);
          border: 3px solid #fff; box-shadow: 0 1px 4px rgba(30,27,22,.25); cursor: pointer;
        }
        .pc-slider input[type='range']:focus-visible { box-shadow: var(--focus-ring); }

        .pc-estcard { background: var(--ink-band); color: var(--ink-band-text); border-radius: 18px; padding: 28px; }
        .pc-estcard__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .pc-estcard__kicker { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
        .pc-estcard__pill {
          font-size: 11px; font-weight: 500; color: var(--ink-band); background: #22c55e;
          padding: 3px 9px; border-radius: 999px;
        }
        .pc-estcard__row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; font-size: 14px; color: var(--ink-band-text2); }
        .pc-estcard__row--divider { padding-bottom: 18px; border-bottom: 1px solid var(--ink-band-border); }
        .pc-estcard__dim { color: var(--ink-band-muted); }
        .pc-estcard__num { font-size: 20px; font-weight: 500; color: var(--ink-band-text); }
        .pc-estcard__total { display: flex; justify-content: space-between; align-items: baseline; margin: 18px 0 4px; }
        .pc-estcard__totallabel { font-size: 15px; font-weight: 600; }
        .pc-estcard__totalnum { font-size: 30px; font-weight: 500; color: #fff; }
        .pc-estcard__sub { font-size: 12px; color: var(--ink-band-muted); margin: 0 0 18px; }
        .pc-estcard__save {
          display: flex; align-items: center; gap: 8px; background: rgba(34,197,94,.12);
          border: 1px solid rgba(34,197,94,.3); border-radius: 10px; padding: 10px 12px;
          margin-bottom: 18px; font-size: 13px; color: #dcfce7;
        }
        .pc-estcard__save svg { color: #22c55e; flex-shrink: 0; }
        .pc-estcard__save b { color: #fff; }
        .pc a.pc-estcard__cta {
          display: block; text-align: center; padding: 13px; border-radius: 10px; font-size: 15px;
          font-weight: 600; background: var(--accent); color: #fff; transition: background .2s;
        }
        .pc a.pc-estcard__cta:hover { background: var(--accent-hover); color: #fff; }
        .pc a.pc-estcard__cta:focus-visible {
          outline: 2px solid #fff; outline-offset: 2px;
        }

        .pc-prepay { padding-block: 72px 24px; }
        .pc-prepay__intro { font-size: 17px; line-height: 1.55; color: var(--text3); max-width: 60ch; margin: 14px 0 40px; }
        .pc-prepaycards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .pc-pcard {
          position: relative;
          background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
          padding: 28px; display: flex; flex-direction: column;
        }
        .pc-pcard__ribbon {
          position: absolute; top: 16px; right: 16px;
          font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
          color: #fff; background: linear-gradient(135deg, var(--brand), var(--brand-hover));
          padding: 5px 12px; border-radius: 999px;
          box-shadow: 0 3px 12px rgba(255, 68, 31, .38);
        }
        .pc-pcard__pctwas {
          font-size: 22px; font-weight: 500; letter-spacing: -.02em;
          text-decoration: line-through; opacity: .45;
        }
        .pc-pcard--hi { background: linear-gradient(180deg, #201d16, #15130d); border-color: #332f26; color: #f5f3ec; }
        .pc-pcard__name { font-size: 15px; font-weight: 600; }
        .pc-pcard--hi .pc-pcard__name { color: #f5f3ec; }
        .pc-pcard__tag { font-size: 13px; color: var(--text4); margin: 4px 0 22px; }
        .pc-pcard--hi .pc-pcard__tag { color: var(--muted); }
        .pc-pcard__disc { display: flex; align-items: baseline; gap: 6px; }
        .pc-pcard__pct { font-size: 44px; font-weight: 500; letter-spacing: -.03em; }
        .pc-pcard__off { font-size: 15px; color: var(--text4); }
        .pc-pcard--hi .pc-pcard__off { color: var(--muted); }
        .pc-pcard__commit { font-size: 13px; color: var(--text4); margin: 10px 0 22px; }
        .pc-pcard--hi .pc-pcard__commit { color: var(--muted); }
        .pc-pcard__divider { height: 1px; background: var(--divider); margin-bottom: 20px; }
        .pc-pcard--hi .pc-pcard__divider { background: #332f26; }
        .pc-pcard__note { font-size: 14px; line-height: 1.5; color: var(--text3); margin: 0; }
        .pc-pcard--hi .pc-pcard__note { color: #c0beb4; }
        .pc-prepay__note { font-size: 13px; color: var(--text4); margin: 18px 0 0; }
        .pc-prepay__note a { font-weight: 600; }

        @media (max-width: 1000px) {
          .pc-ratecards { grid-template-columns: repeat(2, 1fr); }
          .pc-prepaycards { grid-template-columns: repeat(2, 1fr); }
          .pc-estgrid, .pc-tierbar { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .pc-ratecards, .pc-prepaycards { grid-template-columns: 1fr; }
          .pc-controls { flex-direction: column; align-items: stretch; }
          .pc-control { justify-content: space-between; }
          .pc-combo { width: 100%; max-width: none; }
        }
      `}</style>
    </div>
  );
}
