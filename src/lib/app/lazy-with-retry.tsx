import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { retryDynamicImport, type RetryDynamicImportOptions } from './retry-dynamic-import';

/**
 * `React.lazy` wrapper that retries the dynamic import before rejecting.
 *
 * React.lazy memoises the import promise — once it rejects, re-rendering the
 * same lazy component re-throws. Retries must happen inside the factory, before
 * lazy sees the result.
 */
export function lazyWithRetry<P>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  options?: RetryDynamicImportOptions,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(() => retryDynamicImport(factory, options));
}
