/**
 * PbxSelect — reemplazo genérico de `<select>` nativo usando el controlador
 * `Select` de c42-react (docs/12 §A, mismo patrón ya usado en
 * `LanguageSelect.tsx` / `ContentLocaleSelect.tsx` / `LocaleQuickAccess.tsx` /
 * `PageBreadcrumb.tsx`). Ver `packages/builder42/docs/native-select-migration-plan.md`
 * para el inventario completo de los `<select>` nativos que este componente
 * reemplaza.
 *
 * Por qué existe: los 4 usos previos de `Select` repiten el mismo markup
 * (trigger + listbox de opciones) con clases distintas por contexto. Este
 * wrapper generaliza ese markup para pares `{ value, label }` simples, que es
 * la forma de la enorme mayoría de los `<select>` nativos del Inspector
 * (unidad, tipo de borde, alineación, tema, locale de traducción…), evitando
 * duplicar el bloque `data-c42-select-*` en cada sitio de uso.
 *
 * Limitación real de `Select` (c42-core `select.types.d.ts`): solo acepta
 * `defaultValue` (valor inicial), no un `value` controlado reactivamente — no
 * hay forma de empujarle un cambio externo después del mount salvo remontar
 * el componente. Por eso este wrapper fuerza `key={value}` en el `<Select>`
 * interno: cuando el valor cambia por una causa AJENA a la interacción del
 * propio dropdown (otro nodo seleccionado, cambio de breakpoint, undo/redo),
 * React desmonta y remonta con el nuevo `defaultValue`, en vez de dejar el
 * trigger mostrando un valor obsoleto. El remount es barato (sin estado
 * propio más allá de abierto/cerrado) y es el patrón recomendado para
 * envolver web components/controladores no controlados en React.
 *
 * NO usar para listas largas (>~15-20 opciones) o que necesiten filtro en
 * vivo — para esos casos usar `SearchableSelectControl.tsx` (combobox con
 * input de búsqueda), que sí soporta `value` 100% controlado por React.
 */
import { Select } from "@josecortez1/c42-react";
import { ChevronDown } from "./Icon";

export interface PbxSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface PbxSelectProps {
  value: string;
  options: PbxSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function PbxSelect({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  id,
  className,
  disabled,
}: PbxSelectProps) {
  const current = options.find((o) => o.value === value);
  const handleChange = (detail: { value: string }) => onChange(detail.value);

  return (
    <Select
      key={value}
      defaultValue={value || null}
      placeholder={placeholder}
      onChange={handleChange}
      className={`pbx-nselect${className ? ` ${className}` : ""}${disabled ? " pbx-nselect--disabled" : ""}`}
    >
      <button
        type="button"
        id={id}
        data-c42-select-trigger
        className="pbx-nselect__trigger"
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span data-c42-select-value className="pbx-nselect__value">
          {current?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown size={13} className="pbx-nselect__caret" aria-hidden="true" />
      </button>
      <div data-c42-select-listbox className="pbx-nselect__listbox">
        {options.map((opt) => (
          <div
            key={opt.value}
            data-c42-select-option
            data-value={opt.value}
            aria-disabled={opt.disabled || undefined}
            className={
              "pbx-nselect__option" + (opt.disabled ? " pbx-nselect__option--disabled" : "")
            }
          >
            {opt.label}
          </div>
        ))}
      </div>
    </Select>
  );
}
