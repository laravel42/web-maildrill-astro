/**
 * FontFamilyCombobox — combobox de búsqueda para elegir una familia de
 * Google Fonts (docs/40 §2.2, reemplaza el `<input type="text">` libre de
 * `web.family` en `TokensEditor.tsx` `FamilyRow`/`AddFamily`).
 *
 * Usa el `Combobox` headless de `@josecortez1/c42-react` (P10) sobre el
 * catálogo generado por codegen (`scripts/build-font-catalog.mjs`,
 * `GOOGLE_FONT_ENTRIES`, 1908 familias) — nunca se importa
 * `google-font-metadata` completo aquí (docs/34, AGENTS.md §5).
 *
 * El controlador de c42 lee sus `<li data-c42-combobox-option>` UNA sola vez
 * al montar (`Combobox.init`, `combobox.d.ts`) — con 1908 familias no se
 * puede montar el catálogo entero en el DOM de una vez (coste de
 * montar/filtrar 1908 nodos). No se puede remontar el `Combobox` en cada
 * tecla para refrescar ese listado: el `<input>` real vive DENTRO del
 * elemento con `key`, así que cambiar la `key` lo recrea y el navegador le
 * quita el foco a mitad de tecleo (bug real encontrado al escribir el test:
 * `userEvent.type("Inter")` solo registraba la primera letra).
 *
 * Solución: el `Combobox` se monta UNA sola vez con el catálogo COMPLETO
 * (1908 `<li>`, `filter: false` — el filtrado real lo hace React, no c42) y
 * el filtrado de QUÉ SE VE es 100% de React vía el atributo `hidden` en cada
 * `<li>` (barato: togglear un atributo en un nodo ya existente, no
 * crear/destruir 1908 nodos por tecla). El `Combobox` de c42 solo aporta:
 * abrir/cerrar la lista al enfocar/hacer click fuera, navegación por
 * teclado, y el evento `combobox:change` al elegir una opción (click o
 * Enter) — nunca reconstruye el DOM del listado.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Combobox } from "@josecortez1/c42-react";
import { ChevronDown } from "./Icon";
import { GOOGLE_FONT_ENTRIES } from "@/builder/registry/catalogs/generated/googleFonts.names";

export interface FontFamilyComboboxProps {
  /** Nombre de familia actualmente seleccionado (puede no estar en el catálogo — valor libre histórico). */
  value: string;
  /** Se llama con el nombre exacto de la familia elegida. */
  onChange: (family: string) => void;
  /** `aria-label` del input (i18n, requerido por accesibilidad). */
  ariaLabel: string;
  className?: string;
}

export function FontFamilyCombobox({ value, onChange, ariaLabel, className }: FontFamilyComboboxProps) {
  const { t } = useTranslation("tokens");
  const [query, setQuery] = useState(value);

  const q = query.trim().toLowerCase();
  const visibility = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const f of GOOGLE_FONT_ENTRIES) {
      map.set(f.family, q === "" || f.family.toLowerCase().includes(q));
    }
    return map;
  }, [q]);
  const visibleCount = useMemo(
    () => [...visibility.values()].filter(Boolean).length,
    [visibility],
  );

  // Al elegir una opción, `combobox:change` entrega `{ values: string[] }`
  // (single-select → un solo valor). El controlador ya sincroniza el label
  // del input con el texto de la opción (`syncSingleInputLabel`), así que
  // solo hace falta propagar el valor elegido hacia arriba.
  const handleChange = (detail: unknown) => {
    const values = (detail as { values?: string[] } | undefined)?.values;
    const family = values?.[0];
    if (family) {
      setQuery(family);
      onChange(family);
    }
  };

  return (
    <Combobox
      className={`pbx-font-combobox${className ? ` ${className}` : ""}`}
      defaultValue={value || null}
      filter={false}
      onChange={handleChange}
    >
      <div className="pbx-font-combobox__field">
        <input
          data-c42-combobox-input
          type="text"
          className="pbx-token__input pbx-font-combobox__input"
          defaultValue={value}
          onInput={(e) => setQuery(e.currentTarget.value)}
          aria-label={ariaLabel}
          placeholder={t("families.googleNamePlaceholder")}
          autoComplete="off"
        />
        <ChevronDown size={13} className="pbx-font-combobox__caret" aria-hidden="true" />
      </div>
      <ul data-c42-combobox-list className="pbx-font-combobox__list">
        {visibleCount === 0 ? (
          <li className="pbx-font-combobox__empty" aria-disabled="true">
            {t("families.comboboxNoResults")}
          </li>
        ) : null}
        {GOOGLE_FONT_ENTRIES.map((f) => (
          <li
            key={f.family}
            data-c42-combobox-option
            data-value={f.family}
            className="pbx-font-combobox__option"
            hidden={!visibility.get(f.family)}
          >
            <span className="pbx-font-combobox__option-name">{f.family}</span>
            <span className="pbx-font-combobox__option-category">{f.category}</span>
          </li>
        ))}
      </ul>
    </Combobox>
  );
}
