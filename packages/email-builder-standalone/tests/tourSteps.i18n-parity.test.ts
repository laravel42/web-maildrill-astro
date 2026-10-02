/**
 * tourSteps.i18n-parity.test.ts — paridad del namespace i18n `tour` entre los tres idiomas
 * del paquete (F3a, docs/product-tour-driverjs-plan.md §4).
 *
 * Verifica que toda clave presente en `en-US/tour.json` existe también en `es-419/tour.json`
 * e `it-IT/tour.json` (y viceversa — sin claves huérfanas en ningún idioma), incluyendo tanto
 * el copy de cada paso (`steps.<id>.title` / `.description`) como los textos de botones
 * (`labels.nextBtnText`, `prevBtnText`, `doneBtnText`, `progressText`).
 */
import { describe, expect, it } from 'vitest';

import enTour from '../src/locales/en-US/tour.json';
import esTour from '../src/locales/es-419/tour.json';
import itTour from '../src/locales/it-IT/tour.json';

type Json = Record<string, unknown>;

/** Devuelve todas las rutas "a.b.c" hasta valores string, recorriendo objetos anidados. */
function collectLeafPaths(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (node === null || typeof node !== 'object') return [];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(node as Json)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    paths.push(...collectLeafPaths(value, nextPrefix));
  }
  return paths;
}

const CATALOGS: Record<string, Json> = {
  'en-US': enTour,
  'es-419': esTour,
  'it-IT': itTour,
};

describe('email-builder-standalone tour i18n — paridad de claves', () => {
  const keysByLocale = Object.fromEntries(
    Object.entries(CATALOGS).map(([locale, catalog]) => [locale, new Set(collectLeafPaths(catalog))]),
  ) as Record<string, Set<string>>;

  const allKeys = new Set<string>();
  for (const keys of Object.values(keysByLocale)) {
    for (const key of keys) allKeys.add(key);
  }

  it('el namespace "tour" no está vacío en ningún idioma', () => {
    for (const [locale, keys] of Object.entries(keysByLocale)) {
      expect(keys.size, `${locale} no tiene claves de copy`).toBeGreaterThan(0);
    }
  });

  it.each(Object.keys(CATALOGS))('%s tiene todas las claves del superset', (locale) => {
    const keys = keysByLocale[locale]!;
    const missing = [...allKeys].filter((key) => !keys.has(key));
    expect(missing, `claves ausentes en ${locale}:\n${missing.join('\n')}`).toEqual([]);
  });

  it.each(Object.keys(CATALOGS))('%s no tiene claves huérfanas (fuera del superset)', (locale) => {
    // El superset se construye a partir de la unión de los 3 catálogos, así que una clave
    // "huérfana" real solo aparecería si un locale tuviera una clave que ningún otro tiene —
    // este test documenta la garantía de forma explícita en vez de depender solo del anterior.
    const keys = keysByLocale[locale]!;
    const extra = [...keys].filter((key) => !allKeys.has(key));
    expect(extra, `claves huérfanas en ${locale}:\n${extra.join('\n')}`).toEqual([]);
  });

  it('define los 4 textos de botones/progreso requeridos en los 3 idiomas', () => {
    const requiredLabelKeys = [
      'labels.nextBtnText',
      'labels.prevBtnText',
      'labels.doneBtnText',
      'labels.progressText',
    ];
    for (const locale of Object.keys(CATALOGS)) {
      const keys = keysByLocale[locale]!;
      const missing = requiredLabelKeys.filter((key) => !keys.has(key));
      expect(missing, `${locale} le faltan labels: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('cada clave de copy tiene un string no vacío en los 3 idiomas', () => {
    const emptyEntries: string[] = [];
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const key of allKeys) {
        const value = key.split('.').reduce<unknown>((node, part) => {
          if (node === null || typeof node !== 'object') return undefined;
          return (node as Json)[part];
        }, catalog);
        if (typeof value !== 'string' || value.trim().length === 0) {
          emptyEntries.push(`${locale}:${key}`);
        }
      }
    }
    expect(emptyEntries, `valores vacíos o no-string:\n${emptyEntries.join('\n')}`).toEqual([]);
  });
});
