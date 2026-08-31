import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "@/components";

interface Option {
  label: string;
  value: string;
}

interface SearchableSelectControlProps {
  value: string;
  options: Option[];
  placeholder?: string;
  onCommit: (value: string) => void;
  /** Preview visual opcional por opción (glifo de icono, swatch de marca…). */
  renderPreview?: (value: string) => ReactElement | null;
}

const MAX_VISIBLE = 50;

export function SearchableSelectControl({
  value,
  options,
  placeholder,
  onCommit,
  renderPreview,
}: SearchableSelectControlProps) {
  const { t } = useTranslation("inspector");
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const lastExternal = useRef(value);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setDraft(value);
    }
  }, [value]);

  const normalized = draft.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return options;
    return options.filter((o) => o.label.toLowerCase().includes(normalized));
  }, [options, normalized]);

  const visible = filtered.slice(0, MAX_VISIBLE);
  const hasMore = filtered.length > MAX_VISIBLE;
  const activeOption = activeIndex >= 0 ? visible[activeIndex] : undefined;

  const commitAndClose = (v: string) => {
    lastExternal.current = v;
    setDraft(v);
    onCommit(v);
    setOpen(false);
    setActiveIndex(-1);
  };

  const commitCurrent = () => {
    if (activeIndex >= 0 && activeIndex < visible.length) {
      commitAndClose(visible[activeIndex]!.value);
    } else {
      if (draft !== value) {
        lastExternal.current = draft;
        onCommit(draft);
      }
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleFocus = () => {
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveIndex(0);
        } else {
          setActiveIndex((prev) => Math.min(prev + 1, visible.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) {
          setActiveIndex((prev) => Math.max(prev - 1, 0));
        }
        break;
      case "Enter":
        e.preventDefault();
        commitCurrent();
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    requestAnimationFrame(() => {
      if (draft !== value) {
        lastExternal.current = draft;
        onCommit(draft);
      }
      setOpen(false);
      setActiveIndex(-1);
    });
  };

  useEffect(() => {
    if (open && activeIndex >= 0 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLLIElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  const showDropdown = open && (visible.length > 0 || normalized !== "");

  return (
    <div className="pbx-searchable-select">
      <div
        className={
          "pbx-searchable-select__control" +
          (renderPreview ? " pbx-searchable-select__control--with-preview" : "")
        }
      >
        {renderPreview ? (
          <span className="pbx-searchable-select__preview" aria-hidden="true">
            {renderPreview(draft) ?? <span className="pbx-searchable-select__preview-empty" />}
          </span>
        ) : null}
        <input
          className="pbx-control__input pbx-searchable-select__input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.value}` : undefined}
          value={draft}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        <ChevronDown size={13} className="pbx-searchable-select__caret" aria-hidden="true" />
      </div>
      {showDropdown ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={t("searchableSelect.listLabel")}
          className="pbx-searchable-select__dropdown"
        >
          {visible.length === 0 ? (
            <li className="pbx-searchable-select__empty">
              {t("searchableSelect.noResults", { query: draft })}
            </li>
          ) : (
            visible.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listboxId}-${opt.value}`}
                role="option"
                aria-selected={i === activeIndex}
                className={
                  "pbx-searchable-select__option" +
                  (i === activeIndex ? " pbx-searchable-select__option--active" : "")
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitAndClose(opt.value);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {renderPreview ? (
                  <span className="pbx-searchable-select__option-preview" aria-hidden="true">
                    {renderPreview(opt.value)}
                  </span>
                ) : null}
                <span className="pbx-searchable-select__option-label">{opt.label}</span>
              </li>
            ))
          )}
          {hasMore ? (
            <li className="pbx-searchable-select__more" aria-disabled="true">
              {t("searchableSelect.moreResults", { count: filtered.length - MAX_VISIBLE })}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
