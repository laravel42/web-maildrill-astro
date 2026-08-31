/**
 * LocaleCombobox — combobox de búsqueda para elegir un código de idioma
 * ISO 639-1 (docs/17.c, reemplaza el `<input type="text" maxLength={2}>` de
 * texto libre en `I18nSettings.tsx`). Un string de 2 letras es fácil de
 * teclear con typo (`"xx"` pasaba la validación regex sin ser un idioma
 * real) — este control solo permite elegir de un catálogo cerrado
 * (`localeCatalog.ts`), mostrando código + nombre del idioma para que el
 * usuario reconozca lo que está eligiendo en vez de memorizar códigos.
 *
 * Mismo patrón que `FontFamilyCombobox.tsx` (`Combobox` headless de
 * `@josecortez1/c42-react`, P10; catálogo completo montado una vez,
 * filtrado 100% en React vía `hidden` en cada `<li>` — nunca se remonta el
 * `Combobox` por tecla, evita perder foco a mitad de escritura).
 */

import { useMemo, useState } from "react";
import { Combobox } from "@josecortez1/c42-react";
import { ChevronDown } from "./Icon";
import { getLocaleOptions, type LocaleOption } from "@/builder/inspector/localeCatalog";

export interface LocaleComboboxProps {
  /** Código actualmente elegido (vacío = ninguno). */
  value: string;
  /** Se llama con el CÓDIGO exacto de la opción elegida (ej. "es"). */
  onChange: (code: string) => void;
  /** Locale en el que se muestran los NOMBRES de las opciones (idioma del editor, no del sitio). */
  displayLocale: string;
  /** Códigos a excluir del listado (ej. locales que el sitio ya tiene). */
  excludeCodes?: readonly string[];
  ariaLabel: string;
  placeholder?: string;
  noResultsLabel: string;
  className?: string;
}

export function LocaleCombobox({
  value,
  onChange,
  displayLocale,
  excludeCodes,
  ariaLabel,
  placeholder,
  noResultsLabel,
  className,
}: LocaleComboboxProps) {
  const [query, setQuery] = useState("");

  const options = useMemo<LocaleOption[]>(() => {
    const all = getLocaleOptions(displayLocale);
    if (!excludeCodes || excludeCodes.length === 0) return all;
    const excluded = new Set(excludeCodes.map((c) => c.toLowerCase()));
    return all.filter((o) => !excluded.has(o.code));
  }, [displayLocale, excludeCodes]);

  const q = query.trim().toLowerCase();
  const visibility = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const o of options) {
      map.set(o.code, q === "" || o.name.toLowerCase().includes(q) || o.code.includes(q));
    }
    return map;
  }, [options, q]);
  const visibleCount = useMemo(() => [...visibility.values()].filter(Boolean).length, [visibility]);

  const handleChange = (detail: unknown) => {
    const values = (detail as { values?: string[] } | undefined)?.values;
    const code = values?.[0];
    if (code) {
      setQuery("");
      onChange(code);
    }
  };

  return (
    <Combobox
      className={`pbx-font-combobox${className ? ` ${className}` : ""}`}
      defaultValue={null}
      filter={false}
      onChange={handleChange}
    >
      <div className="pbx-font-combobox__field">
        <input
          data-c42-combobox-input
          type="text"
          className="pbx-control__input pbx-font-combobox__input"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoComplete="off"
        />
        <ChevronDown size={13} className="pbx-font-combobox__caret" aria-hidden="true" />
      </div>
      <ul data-c42-combobox-list className="pbx-font-combobox__list">
        {visibleCount === 0 ? (
          <li className="pbx-font-combobox__empty" aria-disabled="true">
            {noResultsLabel}
          </li>
        ) : null}
        {options.map((o) => (
          <li
            key={o.code}
            data-c42-combobox-option
            data-value={o.code}
            className="pbx-font-combobox__option"
            aria-selected={o.code === value}
            hidden={!visibility.get(o.code)}
          >
            <span className="pbx-font-combobox__option-name">{o.name}</span>
            <span className="pbx-font-combobox__option-category">{o.code}</span>
          </li>
        ))}
      </ul>
    </Combobox>
  );
}
