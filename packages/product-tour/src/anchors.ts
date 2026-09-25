/**
 * anchors.ts — resolución de anclas `data-tour` para @md/product-tour.
 *
 * El paquete es agnóstico de dominio (§0 de docs/product-tour-driverjs-plan.md): no sabe
 * qué es "email" ni "landing", solo resuelve claves de ancla a elementos del DOM dentro de
 * un `root` explícito.
 *
 * Root-aware: el consumidor decide si resuelve contra `document` o un `ShadowRoot`. driver.js
 * no atraviesa shadow roots y monta su overlay en `document.body`, fuera del ámbito de estilos
 * del shadow — por eso `isSupportedRoot` existe: permite que `createTour` se declare no-op
 * silencioso cuando el root es un `ShadowRoot`, en vez de fallar o comportarse a medias.
 */

export type TourRoot = Document | ShadowRoot;

/**
 * `root` es solo soportado cuando es el `Document` global. Cualquier `ShadowRoot` desactiva
 * el tour (ver §1.4.1 del plan): el resolver sigue funcionando (querySelector funciona en un
 * ShadowRoot), pero el overlay de driver.js no puede recortarse correctamente contra un
 * elemento dentro de un shadow tree, así que el tour completo debe tratarse como no soportado.
 *
 * Usa `nodeType` en vez de `instanceof Document`: en algunos entornos de test (happy-dom,
 * jsdom) el `document` global y la clase `Document` importable no comparten el mismo realm,
 * lo que rompe `instanceof` aunque el objeto sea, en efecto, un documento. `nodeType` es una
 * propiedad estándar del DOM y no depende de identidad de clase entre realms.
 */
export function isSupportedRoot(root: TourRoot): root is Document {
  return root.nodeType === 9; // Node.DOCUMENT_NODE
}

/**
 * Resuelve una clave de ancla (`data-tour="<key>"`) a su elemento dentro de `root`.
 * Devuelve `null` si no existe — nunca lanza. El llamador decide si eso significa "omitir
 * paso" (comportamiento por defecto, ver steps.ts `skipMissingElement`).
 */
export function resolveAnchor(root: TourRoot, key: string): Element | null {
  return root.querySelector(`[data-tour="${cssEscape(key)}"]`);
}

/**
 * Espera hasta `timeoutMs` (poll cada `intervalMs`) a que la ancla aparezca en el DOM.
 * Útil para pasos cuyo elemento solo existe tras abrir un panel (`before()` asíncrono).
 * Se resuelve con `null` si el timeout se agota sin encontrar el elemento.
 */
export function waitForAnchor(
  root: TourRoot,
  key: string,
  { timeoutMs = 2000, intervalMs = 50 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<Element | null> {
  const found = resolveAnchor(root, key);
  if (found) return Promise.resolve(found);

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const el = resolveAnchor(root, key);
      if (el) {
        clearInterval(timer);
        resolve(el);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, intervalMs);
  });
}

/** Escapa una clave de ancla para uso seguro dentro de un selector `[data-tour="…"]`. */
function cssEscape(value: string): string {
  // CSS.escape no está garantizado en todos los entornos de test (happy-dom lo implementa,
  // pero mantenemos un fallback manual para robustez fuera del navegador).
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}
