import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRIAL_ALLOWANCES } from '@/config/pricing';

/**
 * The signup page and the send gate must promise the same trial.
 *
 * They cannot share a module: the marketing site builds from `src/`, the gate
 * lives in `workers/packages/domain`, and the site has no dependency on the
 * workers packages. So the numbers are written twice — `src/config/pricing.ts`
 * for the panel on /signup, `workers/packages/domain/src/trial.ts` for
 * `assertTrialAllowance` — and the domain file's own comment says they "must
 * never disagree about what was sold" while nothing checked that they don't.
 *
 * Divergence is silent and one-sided in the worst direction: raise the site's
 * figure and the gate keeps enforcing the old one, so a workspace is cut off
 * at half of what it was promised, with an error quoting a limit that appears
 * nowhere on the site.
 *
 * Parsed from source rather than imported because crossing that boundary is
 * exactly what is not possible. If the shape of the declaration changes, the
 * parse fails loudly instead of quietly matching nothing.
 */
const DOMAIN_TRIAL = resolve(
  import.meta.dirname,
  '../../workers/packages/domain/src/trial.ts',
);

function gateAllowances(): Record<string, number> {
  const src = readFileSync(DOMAIN_TRIAL, 'utf8');
  const start = src.indexOf('export const TRIAL_ALLOWANCES');
  expect(start, 'TRIAL_ALLOWANCES not found in the domain package').toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf('}', start));
  const found = Object.fromEntries(
    [...block.matchAll(/(email|sms|whatsapp|voice):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
  );
  expect(Object.keys(found).sort(), 'could not parse every channel').toEqual([
    'email',
    'sms',
    'voice',
    'whatsapp',
  ]);
  return found;
}

describe('trial allowances', () => {
  it('promise the same numbers on the site and at the gate', () => {
    expect(gateAllowances()).toEqual({
      email: TRIAL_ALLOWANCES.email,
      sms: TRIAL_ALLOWANCES.sms,
      whatsapp: TRIAL_ALLOWANCES.whatsapp,
      voice: TRIAL_ALLOWANCES.voice,
    });
  });

  it('are the figures /signup advertises', () => {
    // Pinned so a change has to be deliberate on both sides at once, and shows
    // up in review as a change to the offer rather than a tweak to a constant.
    expect(TRIAL_ALLOWANCES).toMatchObject({
      email: 100,
      sms: 15,
      whatsapp: 100,
      voice: 60,
    });
  });
});
