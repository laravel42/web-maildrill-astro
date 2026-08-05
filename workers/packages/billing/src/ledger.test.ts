import { describe, expect, it } from 'vitest';
import { ValidationError } from '@maildrill/domain';
import { expectedSign, validateEntryAmount } from './ledger';

describe('ledger sign rules', () => {
  it('credits, debits, and free-sign types', () => {
    expect(expectedSign('purchase')).toBe(1);
    expect(expectedSign('promotion')).toBe(1);
    expect(expectedSign('bonus')).toBe(1);
    expect(expectedSign('consumption')).toBe(-1);
    expect(expectedSign('refund')).toBe(-1);
    expect(expectedSign('adjustment')).toBe(0);
    expect(expectedSign('correction')).toBe(0);
  });

  it('rejects wrong-signed and zero entries', () => {
    expect(() => validateEntryAmount('purchase', -100)).toThrow(ValidationError);
    expect(() => validateEntryAmount('consumption', 100)).toThrow(ValidationError);
    expect(() => validateEntryAmount('refund', 100)).toThrow(ValidationError);
    expect(() => validateEntryAmount('purchase', 0)).toThrow(ValidationError);
    expect(() => validateEntryAmount('adjustment', 0)).toThrow(ValidationError);
    expect(() => validateEntryAmount('purchase', 10.5)).toThrow(TypeError);
  });

  it('accepts correctly signed entries', () => {
    expect(() => validateEntryAmount('purchase', 100)).not.toThrow();
    expect(() => validateEntryAmount('consumption', -100)).not.toThrow();
    expect(() => validateEntryAmount('adjustment', -100)).not.toThrow();
    expect(() => validateEntryAmount('adjustment', 100)).not.toThrow();
  });
});
