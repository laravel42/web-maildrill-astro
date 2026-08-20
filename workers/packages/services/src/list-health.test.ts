import { describe, expect, it } from 'vitest';
import {
  LIST_DEAD_SHARE_LIMIT,
  LIST_INVALID_SHARE_LIMIT,
  LIST_MIN_MEMBERS,
  listBreach,
  type ListHealth,
} from './list-health';

const health = (over: Partial<ListHealth> = {}): ListHealth => {
  const members = over.members ?? 200;
  const dead = over.dead ?? 0;
  const invalid = over.invalid ?? 0;
  return {
    members,
    dead,
    invalid,
    deadShare: members === 0 ? 0 : dead / members,
    invalidShare: members === 0 ? 0 : invalid / members,
    significant: over.significant ?? members >= LIST_MIN_MEMBERS,
    suspended: over.suspended ?? false,
    reason: over.reason ?? null,
  };
};

describe('listBreach', () => {
  it('leaves a healthy list alone', () => {
    // Measured against the real lists in this workspace: 0–1.4% dead.
    expect(listBreach(health({ members: 200, dead: 3 }))).toBeNull();
  });

  it('flags a list that looks purchased — failed validation, never mailed', () => {
    // 15% invalid: a legitimately collected list should have almost none.
    const breach = listBreach(health({ members: 200, dead: 30, invalid: 30 }));
    expect(breach).toMatch(/failed address validation/);
    expect(breach).toMatch(/purchased or scraped/);
  });

  it('tolerates an aged list that decayed through real bounces', () => {
    // 15% bounced over years is normal decay, and no addresses failed
    // validation — this must not be treated like a scraped list.
    expect(listBreach(health({ members: 200, dead: 30, invalid: 0 }))).toBeNull();
  });

  it('still stops a list that is mostly undeliverable', () => {
    const breach = listBreach(health({ members: 200, dead: 60, invalid: 0 }));
    expect(breach).toMatch(/undeliverable/);
  });

  it('ignores a list too small for the share to mean anything', () => {
    // 4 of 5 dead is 80% and says nothing.
    expect(listBreach(health({ members: 5, dead: 4, invalid: 4 }))).toBeNull();
  });

  it('treats both bars as exclusive — exactly at the limit still sends', () => {
    expect(listBreach(health({ members: 100, dead: 20, invalid: 10 }))).toBeNull();
  });
});

describe('list health thresholds', () => {
  it('holds invalid to a far tighter bar than accumulated bounces', () => {
    // The two measure opposite things: a bad import versus an old list.
    expect(LIST_INVALID_SHARE_LIMIT).toBeLessThan(LIST_DEAD_SHARE_LIMIT);
    expect(LIST_INVALID_SHARE_LIMIT).toBe(0.1);
    expect(LIST_DEAD_SHARE_LIMIT).toBe(0.2);
  });

  it('stays well clear of the observed healthy baseline', () => {
    // Real lists here sit at 0–1.4% dead; the bar must not be near that.
    expect(LIST_DEAD_SHARE_LIMIT).toBeGreaterThan(0.05);
  });

  it('needs enough members for the share to mean anything', () => {
    expect(LIST_MIN_MEMBERS).toBeGreaterThanOrEqual(25);
  });
});
