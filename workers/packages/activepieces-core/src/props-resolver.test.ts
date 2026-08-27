import { describe, expect, it } from 'vitest';
import { createPropsResolver, MASKED } from './props-resolver';
import { propertyPath } from './property-path';
import { extractMustacheTokens } from './mustache';

const scope = {
  trigger: {
    subscriber: { id: 's1', email: 'ada@example.com', name: 'Ada', attributes: { plan: 'pro' } },
  },
  steps: {
    find_subscriber: { output: { found: true, subscriber: { id: 's1', tags: ['a', 'b'] } } },
  },
  find_subscriber: { found: true, subscriber: { id: 's1', tags: ['a', 'b'] } },
};

const resolver = createPropsResolver({
  isSensitiveToken: (name) => name.startsWith('connections.'),
});

describe('property paths', () => {
  it('accepts member chains and bracket access', () => {
    expect(propertyPath.parse('a.b.c')).toEqual(['a', 'b', 'c']);
    expect(propertyPath.parse('a[0].b')).toEqual(['a', '0', 'b']);
    expect(propertyPath.parse('a["b c"]')).toEqual(['a', 'b c']);
    expect(propertyPath.parse("a['b'].c")).toEqual(['a', 'b', 'c']);
  });

  it('refuses anything that is not a plain path', () => {
    // The whole reason this resolver exists instead of upstream's: a token that is not a
    // path must resolve to nothing, never be handed to an evaluator.
    expect(propertyPath.parse('a + b')).toBeNull();
    expect(propertyPath.parse('doSomething()')).toBeNull();
    expect(propertyPath.parse('a.b; process.exit(1)')).toBeNull();
    expect(propertyPath.parse('undefined')).toBeNull();
  });

  it('blocks prototype-pollution segments', () => {
    expect(propertyPath.parse('a.__proto__.x')).toBeNull();
    expect(propertyPath.parse('a.constructor')).toBeNull();
    expect(propertyPath.parse('a["prototype"]')).toBeNull();
  });
});

describe('mustache tokenizing', () => {
  it('counts braces rather than stopping at the first close', () => {
    const tokens = extractMustacheTokens('a {{ x }} b {{ y.z }}');
    expect(tokens.map((t) => t.inner.trim())).toEqual(['x', 'y.z']);
  });
});

describe('createPropsResolver', () => {
  it('returns the raw value when the whole string is one token', () => {
    const { resolvedInput } = resolver.resolve<{ tags: unknown; found: unknown }>({
      unresolvedInput: {
        tags: '{{steps.find_subscriber.output.subscriber.tags}}',
        found: '{{find_subscriber.found}}',
      },
      scope,
    });
    // An array stays an array — stringifying it would break the Loop step downstream.
    expect(resolvedInput.tags).toEqual(['a', 'b']);
    expect(resolvedInput.found).toBe(true);
  });

  it('substitutes into surrounding text', () => {
    const { resolvedInput } = resolver.resolve<{ subject: string }>({
      unresolvedInput: { subject: 'Hi {{trigger.subscriber.name}}, welcome!' },
      scope,
    });
    expect(resolvedInput.subject).toBe('Hi Ada, welcome!');
  });

  it('renders an unresolvable token as empty rather than leaving it visible', () => {
    const { resolvedInput } = resolver.resolve<{ a: string; b: unknown }>({
      unresolvedInput: { a: 'x{{trigger.nope.deep}}y', b: '{{trigger.nope}}' },
      scope,
    });
    expect(resolvedInput.a).toBe('xy');
    expect(resolvedInput.b).toBeUndefined();
  });

  it('never evaluates a token as code', () => {
    const { resolvedInput } = resolver.resolve<{ a: unknown }>({
      unresolvedInput: { a: '{{ 1 + 1 }}' },
      scope,
    });
    expect(resolvedInput.a).toBeUndefined();
  });

  it('masks secrets in the censored copy only', () => {
    const withSecret = {
      apiKey: '{{connections.stripe.apiKey}}',
      note: 'plain',
    };
    const { resolvedInput, censoredInput } = resolver.resolve<typeof withSecret>({
      unresolvedInput: withSecret,
      scope: { connections: { stripe: { apiKey: 'sk_live_123' } } },
    });
    expect(resolvedInput.apiKey).toBe('sk_live_123');
    expect(censoredInput.apiKey).toBe(MASKED);
    expect(censoredInput.note).toBe('plain');
  });

  it('masks sensitive-looking keys wherever they appear', () => {
    const { censoredInput } = resolver.resolve<{ headers: { Authorization: string } }>({
      unresolvedInput: { headers: { Authorization: 'Bearer abc' } },
      scope,
    });
    expect(censoredInput.headers.Authorization).toBe(MASKED);
  });
});
