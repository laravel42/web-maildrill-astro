import type { BlockPlugin, ButtonPlugin } from './types';

/**
 * Plugin registries — the extension seam. Adding a Meta component =
 * `registerBlock(plugin)` / `registerButton(plugin)`; the library,
 * inspector, preview, validation engine and serializer all discover it
 * from here. Nothing else in the app enumerates component types.
 */

const blocks = new Map<string, BlockPlugin<unknown>>();
const buttons = new Map<string, ButtonPlugin<unknown>>();

export function registerBlock<T>(plugin: BlockPlugin<T>): void {
  if (blocks.has(plugin.type)) {
    throw new Error(`[wa-studio] duplicate block plugin type "${plugin.type}"`);
  }
  blocks.set(plugin.type, plugin as BlockPlugin<unknown>);
}

export function registerButton<T>(plugin: ButtonPlugin<T>): void {
  if (buttons.has(plugin.type)) {
    throw new Error(`[wa-studio] duplicate button plugin type "${plugin.type}"`);
  }
  buttons.set(plugin.type, plugin as ButtonPlugin<unknown>);
}

export function getBlockPlugin(type: string): BlockPlugin<unknown> | undefined {
  return blocks.get(type);
}

export function getButtonPlugin(type: string): ButtonPlugin<unknown> | undefined {
  return buttons.get(type);
}

export function listBlockPlugins(): BlockPlugin<unknown>[] {
  return [...blocks.values()];
}

export function listButtonPlugins(): ButtonPlugin<unknown>[] {
  return [...buttons.values()];
}

/** Test-only escape hatch. */
export function clearRegistries(): void {
  blocks.clear();
  buttons.clear();
}
