/**
 * Count-up — runtime del OUTPUT (docs/44 §5 fila P1). Anima el texto de un
 * nodo `stat` desde 0 hasta su valor final cuando entra en viewport, usando
 * `IntersectionObserver` (mismo patrón que `revealOnScroll.ts`, sin compartir
 * código — ver la nota de decisión en `registry/behaviors/countUp.ts`).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 *
 * **Parseo de `props.value` (CRÍTICO, decisión documentada):** `stat.value`
 * es un STRING libre pensado para mostrarse tal cual (`"+10k"`, `"98%"`,
 * `"1.2M"`, `"$4,500"`), no un número puro. El enfoque elegido es una regex
 * simple que extrae el PRIMER tramo numérico (incluye un signo `-` si es
 * negativo — un `+` líder como en "+10k" es parte del PREFIJO literal, no un
 * signo numérico, ver `NUMBER_PATTERN` abajo) y un
 * separador decimal `.` opcional) y trata todo lo demás — antes y después—
 * como prefijo/sufijo literal que NUNCA se anima, solo el número se interpola:
 *
 *   "+10k"    → prefix="+"  number=10   suffix="k"
 *   "98%"     → prefix=""   number=98   suffix="%"
 *   "1.2M"    → prefix=""   number=1.2  suffix="M"  (decimal preservado en cada frame)
 *   "$4,500"  → prefix="$"  number=4500 suffix=""   (la coma de millares se DESCARTA del
 *                                                     número real; ver límite conocido abajo)
 *
 * Límites conocidos (aceptables para un KPI decorativo, no un valor exacto):
 * - Separadores de millares (`,`/`.` según locale) DENTRO del número se
 *   descartan al parsear — `"$4,500"` anima 0→4500 sin comas intermedias
 *   (el valor FINAL sí se restaura literal, ver abajo: solo los frames
 *   intermedios pierden el formato de millares).
 * - Solo se detecta el PRIMER tramo numérico: `"10 de 20"` anima solo el
 *   `10`, el resto (`" de 20"`) queda como sufijo literal sin animar.
 * - Si no hay ningún tramo numérico (`"N/D"`, emoji, vacío), no se anima:
 *   se muestra el valor final desde el primer render (mismo criterio de
 *   degradación segura que "sin JS").
 *
 * El VALOR FINAL mostrado al terminar la animación (o si `prefers-reduced-
 * motion`/sin soporte) es SIEMPRE el string original completo, sin pasar por
 * el parseo — el redondeo/formato de los frames intermedios nunca se filtra
 * al estado final (docs §7.4: el export nunca debe depender de que el
 * runtime corra para mostrar el valor correcto).
 */

export interface CountUpOptions {
  /** Duración total de la animación en ms. Default 1500. */
  duration?: number;
  /** Distancia (0-1) del viewport a la que se dispara. Default 0.3. */
  threshold?: number;
  /** Solo la primera vez que entra en viewport (default) o cada vez. */
  once?: boolean;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

interface ParsedValue {
  prefix: string;
  /** Número final ya parseado (sin separadores de millares). */
  number: number;
  /** Cantidad de decimales del número final, para no over/under-precisar los frames. */
  decimals: number;
  suffix: string;
}

// Solo `-` cuenta como signo NUMÉRICO real (negativo) dentro del match; un
// `+` líder (p. ej. "+10k") es parte del PREFIJO literal, no del número —
// `Number.parseFloat("+10")` igual da 10, así que si el `+` entrara al match
// se perdería al formatear cada frame (bug real detectado en test: "+10k"
// animaba a "3k" sin el signo). Documentado en el docstring de arriba
// ("prefix='+' number=10") — este patrón es la implementación de esa regla.
const NUMBER_PATTERN = /-?[\d,]*\.?\d+/;

/** Parsea el primer tramo numérico de `raw`; `null` si no hay ninguno (no se anima). */
function parseValue(raw: string): ParsedValue | null {
  const match = NUMBER_PATTERN.exec(raw);
  if (!match) return null;
  const rawNumber = match[0];
  const cleaned = rawNumber.replace(/,/g, "");
  const number = Number.parseFloat(cleaned);
  if (Number.isNaN(number)) return null;
  const decimalPart = cleaned.split(".")[1];
  const decimals = decimalPart ? decimalPart.length : 0;
  return {
    prefix: raw.slice(0, match.index),
    number,
    decimals,
    suffix: raw.slice(match.index + rawNumber.length),
  };
}

function formatFrame(parsed: ParsedValue, current: number): string {
  const formatted = parsed.decimals > 0 ? current.toFixed(parsed.decimals) : String(Math.round(current));
  return `${parsed.prefix}${formatted}${parsed.suffix}`;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function runAnimation(el: HTMLElement, parsed: ParsedValue, finalText: string, duration: number): void {
  const start = performance.now();
  function tick(now: number): void {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    // Easing suave (ease-out cuadrático): arranca rápido, desacelera al final.
    const eased = 1 - (1 - progress) ** 2;
    if (progress >= 1) {
      // Frame final EXACTO: el string original completo, nunca el resultado
      // del parseo/formato (evita perder comas de millares, precisión extra…).
      el.textContent = finalText;
      return;
    }
    el.textContent = formatFrame(parsed, parsed.number * eased);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function enhanceCountUp(el: HTMLElement, options: CountUpOptions = {}): Cleanup | void {
  const { duration = 1500, threshold = 0.3, once = true } = options;
  // El nodo `stat` hidratado (`data-pb-behavior`) es la RAÍZ, que también
  // contiene el label — el valor a animar vive en el marcador propio que
  // `Stat.tsx` emite (`data-pb-stat-value`), nunca `el.textContent` completo.
  const valueEl = el.querySelector<HTMLElement>("[data-pb-stat-value]") ?? el;
  const finalText = valueEl.textContent ?? "";
  const parsed = parseValue(finalText);

  // Sin tramo numérico detectable: no hay nada que animar, se deja el valor
  // final tal cual (degradación segura).
  if (!parsed) return;

  // `prefers-reduced-motion`: muestra el valor final directamente, sin animar
  // (mismo criterio que `revealOnScroll`/`carousel`, docs/44 §7.5).
  if (prefersReducedMotion()) {
    valueEl.textContent = finalText;
    return;
  }

  if (typeof IntersectionObserver === "undefined") {
    valueEl.textContent = finalText;
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          runAnimation(valueEl, parsed, finalText, duration);
          if (once) observer.unobserve(el);
        }
      }
    },
    { threshold },
  );
  observer.observe(el);

  return () => {
    observer.disconnect();
    valueEl.textContent = finalText;
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`)
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceCountUp = (el, options) => enhanceCountUp(el, options as CountUpOptions);
}
