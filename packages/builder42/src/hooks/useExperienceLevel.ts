/**
 * useExperienceLevel — punto único de verdad para leer/escribir `experienceLevel`
 * (docs/46 §2 D4). Envuelve `useLocalConfig("experienceLevel")` para que agregar
 * una superficie gated por nivel de experiencia sea declarativo (`isSimple`) en
 * vez de condicionales repetidas con la clave cruda por todo el chrome — el
 * mismo antipatrón que volvió inmanejable al derogado `uiComplexity` (docs/41).
 *
 * `experienceLevel` gobierna qué SUPERFICIES TÉCNICAS del chrome se muestran
 * (idiomas de contenido, SEO, JSON crudo — docs/46 §2).
 *
 * **Actualizado 2026-08-26 (fase 2 de simplificación del panel de propiedades,
 * petición explícita del usuario):** la afirmación histórica de este docblock
 * — "nunca gobierna cómo se edita una propiedad" — YA NO ES CIERTA. Antes,
 * `StylePanel.tsx` tenía su PROPIO mecanismo de "avanzado" (un disclosure
 * "Avanzado ⌄" local por sección, con estado de sesión y auto-expansión,
 * `docs/41` §5.4), independiente de este hook. El usuario pidió unificar
 * bajo un solo switch en vez de mantener dos mecanismos de "avanzado"
 * redundantes: se eliminó el disclosure local y ahora `useExperienceLevel`
 * también gatea la VISIBILIDAD de las filas `tier==="advanced"` del panel de
 * estilo (`StylePanel.tsx` lee `isSimple` para omitirlas del DOM por
 * completo). `docs/41` (§5.4) y `docs/46` (§2) quedan parcialmente
 * derogados en este punto específico — el resto de sus decisiones (idiomas,
 * SEO, JSON) sigue vigente sin cambios.
 */

import { useLocalConfig, type ConfigMap } from "./useLocalConfig";

export type ExperienceLevel = ConfigMap["experienceLevel"];

export interface UseExperienceLevelResult {
  /** Nivel de experiencia actual: "simple" | "advanced". */
  level: ExperienceLevel;
  /** `true` si el nivel actual es "simple" (superficies técnicas ocultas). */
  isSimple: boolean;
  /** `true` si el nivel actual es "advanced" (cero regresión: todo visible). */
  isAdvanced: boolean;
  /** Cambia el nivel de experiencia (persiste en `useLocalConfig`). */
  setLevel: (level: ExperienceLevel) => void;
}

export function useExperienceLevel(): UseExperienceLevelResult {
  const [level, setLevel] = useLocalConfig("experienceLevel");
  return {
    level,
    isSimple: level === "simple",
    isAdvanced: level === "advanced",
    setLevel,
  };
}
