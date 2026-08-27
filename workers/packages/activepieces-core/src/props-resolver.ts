/**
 * Input resolution — adapted from Activepieces (MIT).
 *
 * Upstream: packages/server/engine/src/lib/variables/props-resolver.ts
 *
 * The structure and the two rules that matter are ported:
 *   1. when the whole string is ONE token, the raw value is returned (an object stays an
 *      object, a number stays a number);
 *   2. otherwise every token is substituted into the string, non-strings via JSON.
 *
 * DELIBERATE DIVERGENCE — the reason this file exists rather than importing upstream's:
 * upstream falls back to a JavaScript evaluator (`script-evaluator` → `isolated-vm`) and a
 * formula engine for tokens that are not plain property paths. Neither is ported. A token
 * that is not a path resolves to `undefined`. That single change removes arbitrary code
 * execution from the product, which is why Maildrill can run flows in-process without a
 * V8 isolate per step.
 */
import { applyToStringLeaves, extractMustacheTokens } from './mustache';
import { propertyPath } from './property-path';

export interface ResolveResult<T> {
  /** Input with tokens substituted, for the piece to consume. */
  resolvedInput: T;
  /** Same shape, with secret-bearing values masked, for the run journal. */
  censoredInput: T;
}

export interface ResolverScope {
  [key: string]: unknown;
}

export const MASKED = '**REDACTED**';

/** Keys whose resolved value is masked in the journal, matched case-insensitively. */
const SENSITIVE_KEY = /(password|secret|token|api[_-]?key|authorization|credential)/i;

export interface CreateResolverOptions {
  /**
   * Extra masking hook: return true to censor a resolved token's value even when the
   * surrounding key looks harmless (e.g. a connection reference).
   */
  isSensitiveToken?: (variableName: string) => boolean;
}

export function createPropsResolver(options: CreateResolverOptions = {}) {
  const resolveToken = (variableName: string, scope: ResolverScope): unknown => {
    const segments = propertyPath.parse(variableName);
    if (!segments || segments.length === 0) return undefined;
    return propertyPath.resolveValue({ segments, scope });
  };

  const resolveString = (input: string, scope: ResolverScope, censor: boolean): unknown => {
    const tokens = extractMustacheTokens(input);
    if (tokens.length === 0) return input;

    const first = tokens[0]!;
    if (tokens.length === 1 && first.token === input) {
      const name = first.inner.trim();
      if (censor && options.isSensitiveToken?.(name)) return MASKED;
      return resolveToken(name, scope);
    }

    let out = '';
    let lastIndex = 0;
    for (const { token, inner, index } of tokens) {
      out += input.slice(lastIndex, index);
      const name = inner.trim();
      const value = censor && options.isSensitiveToken?.(name) ? MASKED : resolveToken(name, scope);
      out +=
        value === undefined || value === null
          ? ''
          : typeof value === 'string'
            ? value
            : JSON.stringify(value);
      lastIndex = index + token.length;
    }
    out += input.slice(lastIndex);
    return out;
  };

  return {
    resolve<T = unknown>(params: {
      unresolvedInput: unknown;
      scope: ResolverScope;
    }): ResolveResult<T> {
      const { unresolvedInput, scope } = params;
      if (unresolvedInput === null || unresolvedInput === undefined) {
        return { resolvedInput: unresolvedInput as T, censoredInput: unresolvedInput as T };
      }
      const resolvedInput = applyToStringLeaves<T>(unresolvedInput, (s) =>
        resolveString(s, scope, false),
      );
      const censoredInput = censorByKey(
        applyToStringLeaves<T>(unresolvedInput, (s) => resolveString(s, scope, true)),
      ) as T;
      return { resolvedInput, censoredInput };
    },
  };
}

export type PropsResolver = ReturnType<typeof createPropsResolver>;

/** Mask values under sensitive-looking keys, at any depth. */
export function censorByKey(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(censorByKey);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? MASKED : censorByKey(v),
      ]),
    );
  }
  return value;
}
