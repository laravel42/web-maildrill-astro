import { useTranslation } from "react-i18next";
import { Dropdown, SquarePen, Eye, Code, Braces } from "@/components";
import { useDocumentStore, type ViewMode } from "@/builder/store/documentStore";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

const VIEW_ITEMS: { value: ViewMode; Icon: ComponentType<LucideProps> }[] = [
  { value: "edit", Icon: SquarePen },
  { value: "preview", Icon: Eye },
  { value: "code", Icon: Code },
  { value: "json", Icon: Braces },
];

export function ViewModeDropdown() {
  const { t } = useTranslation("header");
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);

  // D1 (docs/46 §2): la vista JSON es el techo de tecnicidad del editor —
  // oculta siempre (Maildrill no expone el documento crudo, ver
  // docs/landing-pages-builder-integration.md), no solo en modo simple.
  const items = VIEW_ITEMS.filter((item) => item.value !== "json");

  const activeItem = items.find((item) => item.value === view) ?? items[0]!;
  const ActiveIcon = activeItem.Icon;

  return (
    <Dropdown placement="bottom-start" className="pbx-header__view-dropdown">
      <button
        type="button"
        data-c42-dropdown-trigger
        className="pbx-history__btn"
        title={t("viewMode.label")}
        aria-label={t(`views.${activeItem.value}`)}
      >
        <ActiveIcon size={16} aria-hidden="true" />
      </button>
      <div data-c42-dropdown-menu className="pbx-header__view-menu">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            className={
              "pbx-header__view-item" +
              (item.value === view ? " pbx-header__view-item--active" : "")
            }
            onClick={() => setView(item.value)}
          >
            <item.Icon size={15} aria-hidden="true" />
            <span>{t(`views.${item.value}`)}</span>
          </button>
        ))}
      </div>
    </Dropdown>
  );
}
