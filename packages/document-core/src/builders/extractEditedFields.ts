import { z } from 'zod';

/**
 * Block-shaped input expected by `extractEditedFields`. Kept flexible to
 * match concrete block types from `@eb/block-*`.
 */
export interface ExtractableBlock<TData = unknown> {
  type: string;
  data: TData;
}

/**
 * Recursively read a Zod schema and return the object-shaped tree of
 * declared `.default(...)` values, used as the diff baseline by
 * `extractEditedFields`.
 *
 * Behaviour:
 *  - `ZodDefault`         → returns the resolved default value.
 *  - `ZodOptional`        → unwraps and recurses on the inner schema.
 *  - `ZodNullable`        → unwraps and recurses on the inner schema.
 *  - `ZodEffects`         → unwraps `.transform()` / `.refine()` chains.
 *  - `ZodObject`          → walks each field; fields without a default
 *                           are omitted from the result.
 *  - anything else        → `undefined` (no default contribution).
 *
 * Returns `undefined` when the resulting object would be empty so that
 * callers can use a simple `?? {}` fallback.
 */
export function getSchemaDefaults(schema: any): unknown {
  if (schema === undefined || schema === null) return undefined;

  const zAny = z as Record<string, unknown>;
  const def = schema._def ?? schema;
  const typeName = def?.typeName ?? schema.constructor?.name;

  if (
    typeName === 'ZodDefault' ||
    (typeof zAny.ZodDefault === 'function' && schema instanceof (zAny.ZodDefault as any))
  ) {
    const defVal = def?.defaultValue;
    return typeof defVal === 'function' ? defVal() : defVal;
  }

  if (
    typeName === 'ZodOptional' ||
    typeName === 'ZodNullable' ||
    (typeof zAny.ZodOptional === 'function' && schema instanceof (zAny.ZodOptional as any)) ||
    (typeof zAny.ZodNullable === 'function' && schema instanceof (zAny.ZodNullable as any))
  ) {
    const inner =
      (typeof schema.unwrap === 'function' ? schema.unwrap() : undefined) ??
      def?.innerType ??
      def?.schema;
    return getSchemaDefaults(inner);
  }

  if (
    typeName === 'ZodEffects' ||
    typeName === 'ZodPipeline' ||
    typeName === 'ZodTransform' ||
    (typeof zAny.ZodEffects === 'function' && schema instanceof (zAny.ZodEffects as any))
  ) {
    const inner =
      (typeof schema.innerType === 'function' ? schema.innerType() : undefined) ??
      def?.schema ??
      def?.innerType ??
      def?.in ??
      def?.out;
    return getSchemaDefaults(inner);
  }

  if (
    typeName === 'ZodObject' ||
    (typeof zAny.ZodObject === 'function' && schema instanceof (zAny.ZodObject as any))
  ) {
    const shape = (schema.shape ??
      (typeof def?.shape === 'function' ? def.shape() : def?.shape)) as Record<string, any>;
    if (!shape) return undefined;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const subDefault = getSchemaDefaults(shape[key]);
      if (subDefault !== undefined) {
        result[key] = subDefault;
      }
    }
    return Object.keys(result).length === 0 ? undefined : result;
  }

  if (def?.schema || def?.in || def?.innerType) {
    return getSchemaDefaults(def.schema ?? def.in ?? def.innerType);
  }

  return undefined;
}

/**
 * Strip every field of `block.data` that is `undefined`, `null`, or
 * deep-equal to the schema-declared default. Used at save time so saved
 * components don't "freeze" what would otherwise inherit from the theme
 * when re-inserted into another document.
 *
 * The returned `data` is a structurally-narrower shallow/deep copy of
 * the original — the input is never mutated.
 *
 * NOTE: this only diffs against `.default(...)` values declared in the
 * Zod schema. Fields that are merely `.optional()` without a default
 * have no baseline to diff against, so any non-null/non-undefined value
 * is preserved verbatim.
 */
export function extractEditedFields<TData>(
  block: ExtractableBlock<TData>,
  schema: z.ZodTypeAny,
): ExtractableBlock<Partial<TData>> {
  const defaults = getSchemaDefaults(schema);
  const sparse = stripDefaults(block.data, defaults);
  return {
    type: block.type,
    data: (sparse ?? {}) as Partial<TData>,
  };
}

function stripDefaults(value: unknown, defaults: unknown): unknown {
  if (value === undefined || value === null) return undefined;

  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    const dObj = isPlainObject(defaults) ? (defaults as Record<string, unknown>) : undefined;
    for (const key of Object.keys(value)) {
      const stripped = stripDefaults((value as Record<string, unknown>)[key], dObj?.[key]);
      if (stripped === undefined) continue;
      next[key] = stripped;
    }
    return Object.keys(next).length === 0 ? undefined : next;
  }

  if (defaults !== undefined && deepEqual(value, defaults)) return undefined;
  return value;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) &&
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}
