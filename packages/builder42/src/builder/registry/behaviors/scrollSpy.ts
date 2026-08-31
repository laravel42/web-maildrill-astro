/**
 * Scroll-spy — marca el enlace de "nav" correspondiente a la sección visible
 * (docs/44 §5 fila P3). Pareja natural de `scroll-to`/`LinkTarget.kind:"anchor"`:
 * juntos hacen que una landing de una sola página con secciones ancladas se
 * sienta coherente (el visitante ve qué sección está viendo, no solo puede
 * saltar a ella).
 *
 * **Por qué NO se restringe a `nav-menu`/`navbar` (investigado antes de esta
 * fase, no asumido):** `NavMenu.tsx`/`Navbar.tsx` generan sus `<a>` EXCLUSIVAMENTE
 * desde `ctx.pagesInfo` (páginas del SITIO completo — navegación ENTRE páginas
 * distintas, cada una con su propia ruta). Ninguno de los dos tiene hoy un
 * mecanismo para enlazar una ANCLA dentro de la misma página con un `nodeId`
 * propio: sus links siempre resuelven a `link.href` de `pagesInfo`, nunca a un
 * `LinkTarget.kind:"anchor"` editable por el usuario. `scroll-spy` (que supone
 * una landing de una sola página con secciones ancladas) es conceptualmente
 * incompatible con ese modelo TAL COMO EXISTE HOY. Ampliar `nav-menu`/`navbar`
 * para soportar anclas está fuera del alcance de esta fase (no está en la
 * lista de archivos permitidos ni en el plan).
 *
 * **La vía viable, verificada contra el código real:** cualquier `container`
 * (o cualquier nodo con `acceptsChildren: true`) que actúe de "nav" con hijos
 * `button` (u otro nodo-enlace) cuyo `props.link` sea `{ kind: "anchor",
 * nodeId }` — soporte YA EXISTENTE en `Button.tsx` (`readLink`/`resolveLink`/
 * `localResolve`, sin tocar nada) — apuntando a secciones ancladas por
 * `scroll-to`/`LinkTarget.kind:"anchor"`. Esas secciones YA ganan `id="<nodeId>"`
 * en el export sin ningún cambio adicional: `nodesReferencedAsTarget`
 * (`export/exportToHtml.ts`, Fase 2) trata cualquier `LinkTarget.kind:"anchor"`
 * — venga de una `NodeAction` con `targetKind:"node"` o de `props.link` de un
 * nodo-enlace — como una referencia por `nodeId`, y `behaviorRootProps` emite
 * `id: node.id` para todo nodo en ese set. `scroll-spy` puede confiar 100% en
 * `document.getElementById(id)` para localizar las secciones observadas.
 *
 * **Por qué universal (sin `appliesTo` restrictivo) en vez de restringido a
 * `nav-menu`/`navbar`:** restringirlo a esos dos tipos lo dejaría INAPLICABLE
 * en la práctica (ninguno soporta anclas hoy, ver arriba) — sería registrar
 * un behavior que nadie puede usar. Restringirlo a `acceptsChildren: true`
 * (mismo criterio que `expandable.ts`) tampoco aporta nada: lo único que
 * necesita el runtime es que EXISTAN descendientes `<a href="#...">`, y esa
 * condición no se puede expresar de forma útil en `appliesTo` (que solo recibe
 * el `BuilderNode`, no su HTML renderizado ni sus hijos resueltos — un
 * container vacío al momento de adjuntar el behavior podría llenarse después).
 * Se deja universal, mismo espíritu que `sticky`/`reveal-on-scroll`/`toggle`:
 * un efecto genérico que el usuario adjunta al contenedor que corresponda. Si
 * el contenedor no tiene ningún `<a href="#...">` descendiente, el runtime no
 * hace nada (ver `runtime/behaviors/scrollSpy.ts`) — no rompe nada, solo es un
 * no-op.
 *
 * **Tier 1 real:** no hay forma CSS de saber "qué sección ocupa más el
 * viewport ahora mismo". Degradación sin JS (P8/P9): el CSS de este behavior
 * NO aplica ningún recorte ni oculta nada — los enlaces siguen siendo `<a
 * href="#id">` normales, funcionales de punta a punta (navegan/saltan, con
 * scroll suave si el sitio ya declaró `scroll-behavior:smooth` a nivel
 * global). Solo se pierde el resaltado del ítem activo, nunca la navegación.
 */

import type { BehaviorDefinition } from "../types";

export const scrollSpyBehavior: BehaviorDefinition = {
  type: "scroll-spy",
  label: "Resaltar sección activa (scroll-spy)",
  category: "navigation",
  // Sin `appliesTo`: universal (ver nota arriba — restringir a nav-menu/navbar
  // lo dejaría inutilizable hoy; restringir a acceptsChildren no aporta nada
  // que el propio runtime no maneje ya como no-op).
  defaultOptions: { rootMargin: "-20% 0px -60% 0px" },
  optionsSchema: {
    fields: [
      {
        key: "rootMargin",
        label: "Margen de activación",
        control: "text",
        group: "Scroll-spy",
        placeholder: "-20% 0px -60% 0px",
        help: "behaviors.fields.scroll-spy.rootMarginHelp",
      },
    ],
  },
  runtime: {
    moduleId: "scrollSpy",
    enhance: "enhanceScrollSpy",
    // Solo la clase que marca el link activo + su reset. El behavior NO
    // impone ningún color/subrayado (igual criterio que `sticky` con
    // `--scrolled`): el sitio del usuario decide el aspecto de
    // `.pb-scroll-spy__link--active` desde su propio CSS/tokens. La única
    // regla propia es la transición sutil opcional, respetando
    // `prefers-reduced-motion` (no hay animación propia más allá de esto).
    css: [
      ".pb-scroll-spy__link--active { transition: color 0.2s ease; }",
      "@media (prefers-reduced-motion: reduce) { .pb-scroll-spy__link--active { transition: none; } }",
    ].join("\n"),
    loadPreview: async () => (await import("../../../runtime/behaviors/scrollSpy")).enhanceScrollSpy,
  },
};
