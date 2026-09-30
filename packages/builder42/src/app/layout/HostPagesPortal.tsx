/**
 * HostPagesPortal — pone el `PageBreadcrumb` (cambio de página, y de locale de
 * contenido si el sitio es multilingüe) dentro del header del HOST.
 *
 * Por qué hace falta: en modo embebido `Builder42Editor` no monta el `Header`
 * del paquete (`pbx-app--embedded` renderiza solo sidebar / canvas /
 * inspector), y el breadcrumb vivía únicamente ahí. Medido antes de este
 * cambio: `document.querySelector(".pbx-breadcrumb")` era `null` en `/editor`,
 * así que la única forma de saltar entre páginas era la tab "Pages" del panel
 * de ajustes (`PageManager`), que es el CRUD completo, no un selector.
 *
 * Por qué un portal y no un control del host: el breadcrumb necesita el
 * `I18nextProvider` que `Builder42Editor` crea por montaje desde la prop
 * `locale` — un contexto de React al que el header del host, que es hermano
 * del editor y no descendiente, no llega. El store SÍ sería accesible (es un
 * singleton de zustand a nivel de módulo), pero i18n solo ya obliga a que el
 * componente se renderice dentro del árbol del editor. El portal lo deja en
 * ese árbol y mueve únicamente su DOM.
 *
 * Por qué el id lo pone el host por prop (`pagesSlotId`) y no una constante
 * exportada del paquete: un `import` estático desde `builder42` en el header
 * del host arrastraría el barrel entero — y con él el editor — al primer chunk
 * de la página, que es exactamente lo que F11 midió y quitó. Con la prop el
 * host es dueño del string y el paquete no exporta nada que el host deba
 * importar antes de tiempo.
 *
 * Si el host no pasa `pagesSlotId`, o no hay elemento con ese id, esto no
 * renderiza nada: el comportamiento de cualquier embed anterior a este slot.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PageBreadcrumb } from "./PageBreadcrumb";

export function HostPagesPortal({ slotId }: { slotId?: string }) {
  // El slot lo pinta el host en el mismo commit que monta el editor, y los
  // efectos corren cuando todo el árbol ya está en el DOM, así que para cuando
  // esto se ejecuta el elemento existe. El estado es para el primer render,
  // donde todavía no se puede leer el DOM.
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!slotId) {
      setSlot(null);
      return;
    }
    setSlot(document.getElementById(slotId));
  }, [slotId]);

  if (!slot) return null;
  return createPortal(<PageBreadcrumb />, slot);
}
