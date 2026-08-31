/**
 * LayersPanel — botón del Header que abre un dropdown con el árbol de capas de
 * la página activa (docs/01 §8.3). Chrome del editor: usa el `Dropdown`
 * headless de c42 (P10). `closeOnSelect: false` para poder seleccionar/ocultar
 * varios nodos sin que el panel se cierre; el menú tiene `max-height: 50dvh`
 * con scroll para árboles largos.
 */

import { useTranslation } from "react-i18next";
import { Dropdown, Layers } from "@/components";
import { LayersTree } from "@/builder/layers/LayersTree";

export function LayersPanel() {
  const { t } = useTranslation("header");

  return (
    <Dropdown closeOnSelect={false} placement="bottom-start" className="pbx-layers">
      <button type="button" data-c42-dropdown-trigger className="pbx-layers__trigger" title={t("layers.open")}>
        <Layers size={15} aria-hidden="true" /> {t("layers.button")}
      </button>
      <div data-c42-dropdown-menu className="pbx-layers__menu">
        <div className="pbx-layers__title">{t("layers.title")}</div>
        <LayersTree />
      </div>
    </Dropdown>
  );
}
