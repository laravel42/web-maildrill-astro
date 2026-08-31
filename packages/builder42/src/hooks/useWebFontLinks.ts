/**
 * `useWebFontLinks` — carga webfonts de Google en el **editor** (chrome).
 *
 * Motivo (docs/48 §3.3, medido en navegador): `TokensStyle` inyecta los tokens
 * como custom properties, así que el canvas resuelve
 * `--typography-families-sans: 'Playfair Display', serif` — pero **nadie carga
 * el archivo de la fuente**. Medido en `localhost:5173` antes de este hook:
 * `document.querySelectorAll('link[href*="fonts.googleapis"]').length === 0` y
 * `[...document.fonts].length === 0`, con el token `sans` declarando `webFont`
 * Inter. Resultado: el canvas pintaba con el fallback de sistema y el sitio
 * exportado con la fuente real — WYSIWYG roto, y el efecto se nota mucho más
 * con las tipografías de personalidad de las plantillas (docs/48 §3).
 *
 * El export tiene su propio mecanismo (`export/usage.ts` → `fontLinks`, que
 * emite el `<link>` en el `<head>` del HTML generado). Este hook es su gemelo
 * para el chrome y **no toca el documento ni el export** (P1/P8).
 *
 * Implementación: `<link rel="stylesheet">` en `document.head`, con **conteo de
 * referencias por href** — el panel de plantillas monta 20 tarjetas que pueden
 * compartir familia, y no queremos 20 `<link>` iguales ni que desmontar una
 * tarjeta quite la fuente que otra sigue usando.
 */

import { useEffect } from "react";
import { googleFontHref } from "@/builder/model/tokens";
import type { TokenFontFamily } from "@/builder/model/types";

/** href → { link, refs } de los `<link>` que este módulo ha inyectado. */
const injected = new Map<string, { link: HTMLLinkElement; refs: number }>();

function acquire(href: string): void {
  const existing = injected.get(href);
  if (existing) {
    existing.refs += 1;
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.pbxWebfont = "";
  document.head.appendChild(link);
  injected.set(href, { link, refs: 1 });
}

function release(href: string): void {
  const entry = injected.get(href);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.link.remove();
  injected.delete(href);
}

/**
 * Mantiene cargadas las webfonts de `families` mientras el componente esté
 * montado y `enabled` sea `true`. Las familias sin `webFont` de Google se
 * ignoran (una fuente de sistema no necesita `<link>`).
 */
export function useWebFontLinks(
  families: readonly TokenFontFamily[],
  enabled = true,
): void {
  // Los hrefs se serializan para tener una dependencia estable: `families` suele
  // ser un array nuevo en cada render (se deriva de los tokens).
  const hrefs = enabled
    ? [...new Set(families.map(googleFontHref).filter((h): h is string => Boolean(h)))].sort()
    : [];
  const key = hrefs.join("|");

  useEffect(() => {
    if (key === "") return;
    const list = key.split("|");
    for (const href of list) acquire(href);
    return () => {
      for (const href of list) release(href);
    };
  }, [key]);
}

/** Solo para tests: cuántos `<link>` de webfont hay vivos y con cuántas referencias. */
export function __webFontLinkState(): { href: string; refs: number }[] {
  return [...injected.entries()].map(([href, { refs }]) => ({ href, refs }));
}
