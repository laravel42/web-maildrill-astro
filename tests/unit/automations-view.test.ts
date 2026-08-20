import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  isRunSettled,
  runStatusChipClass,
  statusChipClass,
} from '@/lib/app/automations';
import { treeFromSample } from '@/components/react/automations/DataPicker';

describe('formatDuration', () => {
  it('scales the unit to the magnitude', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(182)).toBe('182 ms');
    expect(formatDuration(2400)).toBe('2.4 s');
    expect(formatDuration(64_000)).toBe('1 m 04 s');
  });

  it('renders an unknown duration as a dash rather than 0', () => {
    // A step that has not finished has no duration; "0 ms" would be a lie.
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });
});

describe('status chips', () => {
  it('reuses the workspace status classes', () => {
    expect(statusChipClass('active')).toBe('astatus--active');
    expect(statusChipClass('draft')).toBe('astatus--draft');
    expect(runStatusChipClass('failed')).toBe('astatus--bounced');
    expect(runStatusChipClass('waiting')).toBe('astatus--scheduled');
  });
});

describe('isRunSettled', () => {
  it('treats waiting and running as live', () => {
    expect(isRunSettled('succeeded')).toBe(true);
    expect(isRunSettled('failed')).toBe(true);
    expect(isRunSettled('cancelled')).toBe(true);
    expect(isRunSettled('waiting')).toBe(false);
    expect(isRunSettled('running')).toBe(false);
    expect(isRunSettled('queued')).toBe(false);
  });
});

describe('treeFromSample', () => {
  it('turns a sample payload into insertable expressions', () => {
    const tree = treeFromSample({ subscriber: { email: 'a@b.c', tags: ['x'] } }, 'trigger');
    expect(tree[0]?.path).toBe('trigger.subscriber');
    const child = tree[0]?.children?.find((n) => n.label === 'email');
    expect(child?.path).toBe('trigger.subscriber.email');
    expect(child?.preview).toBe('a@b.c');
  });

  it('offers the first element of an array so indexed paths can be written', () => {
    const tree = treeFromSample({ items: [{ id: 1 }] }, 'steps.x.output');
    const items = tree.find((n) => n.label === 'items');
    expect(items?.preview).toBe('1 item');
    expect(items?.children?.[0]?.path).toBe('steps.x.output.items[0]');
  });

  it('stops before the tree becomes unusable', () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    const tree = treeFromSample(deep, 'trigger');
    let node = tree[0];
    let depth = 0;
    while (node?.children?.length) {
      node = node.children[0];
      depth += 1;
    }
    expect(depth).toBeLessThanOrEqual(4);
  });
});
