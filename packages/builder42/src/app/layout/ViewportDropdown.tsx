import { useTranslation } from "react-i18next";
import { Dropdown, Smartphone, Tablet, Monitor } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { Breakpoint } from "@/builder/model/types";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

const VIEWPORT_ITEMS: { value: Breakpoint; Icon: ComponentType<LucideProps> }[] = [
  { value: "base", Icon: Smartphone },
  { value: "sm", Icon: Smartphone },
  { value: "md", Icon: Tablet },
  { value: "lg", Icon: Monitor },
  { value: "xl", Icon: Monitor },
];

function viewportIcon(value: Breakpoint): ComponentType<LucideProps> {
  if (value === "base" || value === "sm") return Smartphone;
  if (value === "md") return Tablet;
  return Monitor;
}

export function ViewportDropdown() {
  const { t } = useTranslation("header");
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const setActiveBreakpoint = useDocumentStore((s) => s.setActiveBreakpoint);

  const ActiveIcon = viewportIcon(activeBreakpoint);

  return (
    <Dropdown
      placement="bottom-start"
      className="pbx-header__viewport-dropdown pbx-host-toolbar__views"
    >
      <button
        type="button"
        data-c42-dropdown-trigger
        className="pbx-host-toolbar__view pbx-host-toolbar__view--active"
        title={t("viewport.label")}
        aria-label={t(`viewports.${activeBreakpoint}`)}
      >
        <ActiveIcon size={16} aria-hidden="true" />
        <span>{t(`viewports.${activeBreakpoint}`)}</span>
      </button>
      <div data-c42-dropdown-menu className="pbx-header__viewport-menu">
        {VIEWPORT_ITEMS.map((vp) => (
          <button
            key={vp.value}
            type="button"
            className={
              "pbx-header__viewport-item" +
              (activeBreakpoint === vp.value ? " pbx-header__viewport-item--active" : "")
            }
            onClick={() => setActiveBreakpoint(vp.value)}
          >
            <vp.Icon size={15} aria-hidden="true" />
            <span>{t(`viewports.${vp.value}`)}</span>
          </button>
        ))}
      </div>
    </Dropdown>
  );
}
