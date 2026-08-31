/**
 * NodeRenderer — recursión del árbol contra el registry (PLAN §7, P3/P4).
 *
 * Resuelve `nodo -> componentRegistry[type].render(ctx)` y recursa sobre
 * `children`. Cuelga el DnD y la selección en el ELEMENTO RAÍZ del componente
 * vía `rootRef`/`rootProps` (sin wrapper, docs/02 §10.3).
 *
 * En Fase 2 el drop calcula el índice PRECISO (geometry.ts) y pinta un indicador
 * entre hermanos; el `onDrop` aplica una guarda no-op (docs/02 §6).
 *
 * `interactive`:
 *  - true  (modo Edit): draggable + drop target + click-para-seleccionar + indicador.
 *  - false (modo Preview): sin chrome; solo estilos inline en vivo.
 */

import {
  createElement,
  Fragment,
  useCallback,
  useMemo,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useDocumentStore } from "../store/documentStore";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { Zap, ErrorBoundary } from "@/components";
import { getDefinition } from "../registry/componentRegistry";
import { layoutFragmentRootType, getSectionLayout } from "../registry/layoutRegistry";
import { canPlaceChild } from "../registry/placement";
import { getBehaviorDefinition, nodeClipsContentWhenActive } from "../registry/behaviorRegistry";
import { actionDataAttributes } from "../registry/actionRegistry";
import { nodeActions } from "../model/nodeAction";
// Preview de behaviors/ui.js DESACTIVADO (docs/21 §6.1): el Preview usa un
// `<iframe>` con el export real (`PreviewFrame`). Imports comentados junto con
// sus llamadas más abajo, como fallback reversible.
// import { usePreviewBehaviors } from "./usePreviewBehaviors";
// import { usePreviewUIRuntime } from "./usePreviewUIRuntime";
import { isDescendant, findParentId } from "../model/tree";
import { resolveStyle } from "../model/style";
import { resolveImageSrc } from "../model/assets";
import { localizedRoute, withBasePath, buildPathMap } from "../export/links";
import { resolveMetaForLocale, resolvePropsForLocale } from "../model/i18nContent";
import { useDraggable } from "../dnd/useDraggable";
import { GhostNode } from "../dnd/ghost";
import { useDropTarget, type UseDropTargetOptions } from "../dnd/useDropTarget";
import { useOverflowObserver } from "./useOverflowObserver";
import { DropIndicatorOverlay } from "./DropIndicatorOverlay";
import type { DragData, DropData } from "../dnd/contract";
import { nextFreeCell, computeDropTargetAtPoint, type LayoutDirection } from "../dnd/geometry";
import type { BuilderNode, NodeId } from "../model/types";
import type { SlotChild } from "../registry/types";

const EMPTY_SLOT_NODES: (BuilderNode | undefined)[] = [];

interface NodeRendererProps {
  id: NodeId;
  interactive: boolean;
  /**
   * true cuando este `NodeRenderer` es la RAÍZ del overlay de edición del canvas
   * (docs/20 §4.2): propaga `overlayEditing` al `render()` de este nodo para que
   * un elemento no-visible (`modal`) pinte su contenido editable en vez del
   * placeholder de flujo. Solo aplica al nodo raíz del overlay; los hijos se
   * renderizan normal.
   */
  overlayRoot?: boolean;
}

function resolveDirection(id: NodeId): LayoutDirection {
  const s = useDocumentStore.getState();
  const node = s.document.nodes[id];
  if (!node) return "block";
  const layout = resolveStyle(node.style, s.activeBreakpoint, s.site.meta.breakpoints).layout;
  if (layout?.display === "flex") return layout.flexDirection === "row" ? "row" : "column";
  if (layout?.display === "grid") return "grid";
  return "block";
}

export function NodeRenderer({ id, interactive, overlayRoot }: NodeRendererProps) {
  const node = useDocumentStore((s) => s.document.nodes[id]);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const selectedId = useDocumentStore((s) => s.selectedId);
  const select = useDocumentStore((s) => s.select);
  // Edición inline de texto (docs/12 §B.11): un segundo click sobre un nodo
  // `editableInline` ya seleccionado entra en modo edición en vez de solo
  // re-seleccionar. Mientras este nodo está en edición, su `draggable` se
  // desactiva (abajo) para no interceptar la selección de texto nativa.
  const editingTextNodeId = useDocumentStore((s) => s.editingTextNodeId);
  const startEditingText = useDocumentStore((s) => s.startEditingText);
  const addComponent = useDocumentStore((s) => s.addComponent);
  const addSlot = useDocumentStore((s) => s.addSlot);
  const setActiveSlot = useDocumentStore((s) => s.setActiveSlot);
  // Slot activa en edición de ESTE nodo si es un composite `splitRender`
  // (docs/23 §5, T11). Suscripción reactiva: al cambiar de pestaña activa,
  // re-renderiza para mostrar el panel elegido. `undefined` si no hay ninguna
  // guardada (→ fallback a la primera slot más abajo).
  const activeSlotStored = useDocumentStore((s) => s.activeSlotByComposite[id]);
  // Estado de interacción previsualizado en el Inspector para ESTE nodo
  // (`StyleSection` → selector "Estado"). `undefined` si no hay preview activo.
  // `NodeRenderer` lo PROPAGA al `render()` como `ctx.previewState` y, si es
  // `"pressed"`, fija `aria-pressed="true"` en el `rootProps` del nodo
  // seleccionado (modo Edit) para que la regla CSS del estado (T9) aplique en
  // vivo. UI-state del Inspector (no entra a zundo, no toca el documento — P1).
  const previewState = useDocumentStore((s) => s.previewStateBySelectedId[id]);
  const moveExistingNode = useDocumentStore((s) => s.moveExistingNode);
  const insertFragment = useDocumentStore((s) => s.insertFragment);
  // Pick & insert (Vía B, docs/24 §3): mientras hay uno en curso, un tap sobre
  // un nodo VÁLIDO como destino coloca ahí en vez de seleccionar (§3.2 paso 2).
  const pickInsert = useDocumentStore((s) => s.pickInsert);
  const canPickInsertInto = useDocumentStore((s) => s.canPickInsertInto);
  const confirmPickInsertTarget = useDocumentStore((s) => s.confirmPickInsertTarget);
  const setPickInsertCandidate = useDocumentStore((s) => s.setPickInsertCandidate);
  const setStyleProp = useDocumentStore((s) => s.setStyleProp);
  const assets = useDocumentStore((s) => s.site.assets);
  // Contenido multilingüe (docs/12 §B.6-7): el canvas muestra el idioma de
  // edición activo, igual que el Inspector. Referencias estables (no objetos
  // derivados) para no romper el snapshot de Zustand.
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const defaultLang = useDocumentStore((s) => s.site.meta.defaultLang);
  const activePageTranslations = useDocumentStore(
    (s) => s.site.pages[s.activePageId]?.translations,
  );

  // Localización para `language-nav` (docs/14 §2.5): en el canvas el "locale
  // actual" es `editingLocale` (análogo al breakpoint activo). Referencias
  // primitivas/estables del store; el objeto derivado se memoiza abajo.
  const siteI18n = useDocumentStore((s) => s.site.meta.i18n);
  const basePath = useDocumentStore((s) => s.site.meta.basePath);
  const activePageSlug = useDocumentStore((s) => s.site.pages[s.activePageId]?.meta.slug);

  // Sistema de páginas para `navbar` (docs/16 §12.4, rework): referencia
  // estable al `site` completo (nunca un objeto nuevo por llamada — P1/P2);
  // el array derivado se memoiza abajo con `buildPathMap` (mismo helper puro
  // que usa el export, para que canvas y output coincidan, P3).
  const site = useDocumentStore((s) => s.site);
  const activePageId = useDocumentStore((s) => s.activePageId);
  const { t } = useTranslation("inspector");

  // Composite con slots partidas (docs/23 §3.2): suscripción REACTIVA a los
  // nodos de slot hijos, para que la tablist del padre re-renderice cuando
  // cambie el `label` de una slot (editado en el Inspector). `useShallow` evita
  // el loop infinito del antipatrón (AGENTS §5.4): las refs de nodo son estables
  // salvo cambio real (Immer), así que el compare superficial no dispara render
  // de más. `EMPTY_SLOT_NODES` (const de módulo) para los no-composite.
  const slotChildNodes = useDocumentStore(
    useShallow((s) => {
      const n = s.document.nodes[id];
      if (!n) return EMPTY_SLOT_NODES;
      const d = getDefinition(n.type);
      if (!d?.slots?.splitRender) return EMPTY_SLOT_NODES;
      return (n.children ?? []).map((cid) => s.document.nodes[cid]);
    }),
  );

  const resolveImgSrc = useCallback(
    (source: import("../model/types").ImageSource) =>
      resolveImageSrc(source, { assets, forExport: false }),
    [assets],
  );

  const ref = useRef<HTMLElement>(null);
  const def = node ? getDefinition(node.type) : undefined;
  const acceptsChildren = def?.acceptsChildren ?? false;
  const isRoot = id === rootId;

  const getDrag = useCallback<() => DragData>(
    () => ({ kind: "existing-node", nodeId: id }),
    [id],
  );
  const getPreviewLabel = useCallback(
    () => def?.label ?? node?.type ?? "nodo",
    [def?.label, node?.type],
  );
  const isEditingThis = editingTextNodeId === id;
  const { dragging } = useDraggable(
    ref,
    getDrag,
    interactive && !isRoot && !isEditingThis,
    getPreviewLabel,
  );

  const getChildIds = useCallback(
    () => useDocumentStore.getState().document.nodes[id]?.children ?? [],
    [id],
  );
  const getDirection = useCallback<() => LayoutDirection>(() => resolveDirection(id), [id]);
  const getExplicit = useCallback(
    () => useDocumentStore.getState().document.nodes[id]?.props.gridPlacement === "explicit",
    [id],
  );

  // Preview del candidate de "pick & insert" (Vía B, Fase 3, docs/24 §3.2 paso
  // 2, ajustado por feedback de usuario — §3.4): en vez de solo la línea/celda
  // del indicador, se pinta el ELEMENTO REAL que caería aquí (`GhostNode`, más
  // abajo en `childList`, EN FLUJO como el hueco del DnD) — más informativo,
  // sobre todo en touch/mobile con menos espacio. `pickCandidateHere` es el
  // candidate SOLO si apunta a este nodo (booleano puro, sin medir DOM: el
  // ghost en flujo no necesita rects, el propio layout lo posiciona).
  const pickCandidateHere =
    pickInsert && pickInsert.candidate && pickInsert.candidate.parentId === id
      ? pickInsert.candidate
      : null;

  const canDrop = useCallback((drag: DragData) => {
    const doc = useDocumentStore.getState().document;
    const parent = doc.nodes[id];
    if (!parent) return false;
    // Guard de colocación tipada (docs/23 §4): el tipo del hijo debe poder ir
    // dentro del padre (composite solo acepta sus slots; un slot no sale de su
    // composite; un container normal acepta no-slots).
    const childType =
      drag.kind === "new-component"
        ? drag.componentType
        : drag.kind === "fragment"
          ? layoutFragmentRootType(drag.layoutId)
          : doc.nodes[drag.nodeId]?.type;
    if (!childType || !canPlaceChild(parent.type, childType)) return false;
    // Cycle guard para nodos existentes (no soltar un nodo dentro de sí mismo
    // ni de un descendiente).
    if (drag.kind === "existing-node") {
      if (drag.nodeId === id) return false;
      if (isDescendant(doc, drag.nodeId, id)) return false;
    }
    return true;
  }, [id]);

  const onDrop = useCallback(
    (drag: DragData, drop: DropData) => {
      let childId: NodeId | null;
      if (drag.kind === "new-component") {
        addComponent(drag.componentType, drop);
        childId = useDocumentStore.getState().selectedId; // addComponent selecciona el nuevo
      } else if (drag.kind === "fragment") {
        const layout = getSectionLayout(drag.layoutId);
        if (!layout) return;
        insertFragment(layout.build(), drop);
        childId = useDocumentStore.getState().selectedId; // insertFragment selecciona la raíz insertada
      } else {
        // No-op guard (docs/02 §6): soltar en el mismo slot no ensucia el historial.
        const doc = useDocumentStore.getState().document;
        const curParent = findParentId(doc, drag.nodeId);
        const curIndex =
          curParent !== null
            ? (doc.nodes[curParent]?.children?.indexOf(drag.nodeId) ?? -1)
            : -1;
        const sameSlot =
          curParent === drop.parentId &&
          (drop.index === curIndex || drop.index === curIndex + 1);
        childId = drag.nodeId;
        if (!sameSlot) moveExistingNode(drag.nodeId, drop);
      }

      // Colocación explícita en grid: fija la celda del hijo soltado (docs/02 §10.4).
      const container = useDocumentStore.getState().document.nodes[id];
      const explicit = container?.props.gridPlacement === "explicit";
      if (explicit && drop.cell && childId) {
        const state = useDocumentStore.getState();
        const bp = state.activeBreakpoint;
        const doc = state.document;
        const cfg = state.site.meta.breakpoints;
        // Celdas ya ocupadas por hermanos con coords explícitas (resueltas al bp
        // activo), para no apilar dos elementos en la misma celda.
        const occupied = new Set<string>();
        for (const sid of doc.nodes[id]?.children ?? []) {
          if (sid === childId) continue;
          const sib = doc.nodes[sid];
          if (!sib) continue;
          const l = resolveStyle(sib.style, bp, cfg).layout;
          const col = parseInt(String(l?.gridColumn ?? ""), 10);
          const row = parseInt(String(l?.gridRow ?? ""), 10);
          if (!Number.isNaN(col) && !Number.isNaN(row)) occupied.add(`${col},${row}`);
        }
        const free = nextFreeCell(
          occupied,
          { column: drop.cell.column, row: drop.cell.row },
          drop.cell.columns,
        );
        setStyleProp(childId, bp, ["layout", "gridColumn"], String(free.column));
        setStyleProp(childId, bp, ["layout", "gridRow"], String(free.row));
      }
    },
    [id, addComponent, moveExistingNode, insertFragment, setStyleProp],
  );

  const dropOptions = useMemo<UseDropTargetOptions>(
    () => ({
      parentId: id,
      getChildIds,
      getDirection,
      getExplicit,
      canDrop,
      onDrop,
      enabled: interactive && acceptsChildren,
    }),
    [id, getChildIds, getDirection, getExplicit, canDrop, onDrop, interactive, acceptsChildren],
  );

  const { isOver, indicator, dropIndex, drag } = useDropTarget(ref, dropOptions);

  // Detección de overflow horizontal (editor-only): alimenta la affordance
  // "Convertir en slider" del Inspector sin tocar el documento (P1).
  useOverflowObserver(ref, id, interactive && acceptsChildren, node?.children?.length ?? 0);

  // Preview hidratado (docs/10 §5, Fase 8.4): en modo Preview (`!interactive`)
  // montaba el `enhance` real de cada behavior sobre el DOM ya renderizado.
  //
  // DESACTIVADO (docs/21 §6.1): el Preview ahora es un `<iframe>` con el export
  // real (`PreviewFrame`), donde el runtime opt-in corre de verdad dentro del
  // iframe. Estos hooks ya no hidratan nada porque el NodeRenderer no-interactivo
  // dejó de usarse en Preview. Se COMENTAN (no se borran) como fallback
  // reversible: si el iframe fallara, basta con reactivar el Preview de
  // NodeRenderer en `Canvas.tsx` y descomentar estas dos líneas.
  // usePreviewBehaviors(ref, node?.behaviors, !interactive);
  // usePreviewUIRuntime(ref, !interactive);

  // Contenido multilingüe (docs/12 §B.6-7): mismo criterio que el export
  // (`resolvePropsForLocale`). Se calcula antes de los retornos tempranos de
  // abajo (reglas de hooks); `node` puede ser undefined en el primer render.
  const effectiveProps = useMemo(
    () =>
      node
        ? resolvePropsForLocale(node, editingLocale, defaultLang, activePageTranslations)
        : undefined,
    [node, editingLocale, defaultLang, activePageTranslations],
  );

  // localeInfo para `language-nav` (docs/14 §2.5): memoizado para no crear un
  // objeto nuevo en cada render. `undefined` en sitios monolingües. El
  // "locale actual" del canvas es `editingLocale`. Usa los mismos helpers puros
  // de rutas que el export (`localizedRoute`/`withBasePath`) → WYSIWYG fiel.
  const localeInfo = useMemo(() => {
    if (!siteI18n) return undefined;
    const slug = activePageSlug ?? "";
    return {
      locales: siteI18n.locales,
      currentLocale: editingLocale,
      defaultLocale: siteI18n.defaultLocale,
      localizedHref: (target: string) =>
        withBasePath(basePath, localizedRoute(slug, target, siteI18n.defaultLocale, siteI18n.routeStrategy)),
    };
  }, [siteI18n, activePageSlug, editingLocale, basePath]);

  // pagesInfo para `navbar`/`nav-menu` (docs/16 §12.4, rework): todas las
  // páginas del sitio, en `pageOrder`, con su ruta resuelta por `buildPathMap`
  // (mismo helper puro que el export) — el componente no vuelve a inventar
  // rutas. Siempre presente (a diferencia de `localeInfo`): todo sitio tiene
  // home. `title` se resuelve con `resolveMetaForLocale` en `editingLocale`
  // (docs/12 §B.9): si el usuario tradujo el título de la página, el menú
  // cambia de idioma junto con el resto del contenido — mismo criterio que
  // `SeoSettings`/`renderHead`, bug real corregido (título quedaba fijo en
  // el idioma default sin importar `editingLocale`).
  const pagesInfo = useMemo(() => {
    const pathMap = buildPathMap(site);
    const defaultLocale = siteI18n?.defaultLocale ?? site.meta.defaultLang;
    return site.pageOrder
      .map((pid) => {
        const page = site.pages[pid];
        if (!page) return null;
        const meta = resolveMetaForLocale(page.meta, editingLocale, defaultLocale);
        return {
          pageId: pid,
          title: meta.title,
          href: withBasePath(basePath, pathMap[pid] ?? "/"),
          isCurrent: pid === activePageId,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [site, activePageId, basePath, siteI18n, editingLocale]);

  // Chrome fantasma de behaviors en Edit (docs/10 §5, feedback de usuario):
  // agrega `BehaviorRuntimeSpec.editPreviewChrome(options)` de CADA behavior
  // activo del nodo que lo declare. El core no interpreta el resultado (P4):
  // solo lo junta en un Fragment y lo pasa al `render()` del componente, que
  // decide dónde/si lo muestra (hoy solo `Container.tsx`). `undefined` si no
  // hay nada que mostrar (ningún behavior activo lo declara, o no estamos en
  // Edit) — evita un Fragment vacío innecesario en el árbol.
  const editPreviewChrome = useMemo(() => {
    if (!interactive || !node?.behaviors?.length) return undefined;
    const nodes = node.behaviors
      .map((instance) => {
        const def = getBehaviorDefinition(instance.type);
        return def?.runtime.editPreviewChrome?.(instance.options ?? {});
      })
      .filter(Boolean);
    return nodes.length > 0 ? createElement(Fragment, null, ...nodes) : undefined;
  }, [interactive, node?.behaviors]);

  if (!node) return null;
  if (!def) {
    return (
      <div data-node-id={id} style={{ color: "var(--pb-chrome-danger)" }}>
        Tipo no registrado: {node.type}
      </div>
    );
  }

  const childElements: ReactNode[] =
    node.children?.map((childId) => (
      <ErrorBoundary key={childId} nodeId={childId}>
        <NodeRenderer id={childId} interactive={interactive} />
      </ErrorBoundary>
    )) ?? [];

  // Composite con slots partidas (docs/23 §3.2): arma `ctx.slots` alineado con
  // `childElements` (mismo orden que `node.children`). El `node` de cada slot es
  // el reactivo de `slotChildNodes` (para que el label re-renderice). Los
  // composites autocontenidos no declaran `splitRender` → `slots` undefined.
  const slots: SlotChild[] | undefined = def.slots?.splitRender
    ? (node.children ?? []).flatMap((childId, i) => {
        const cn = slotChildNodes[i];
        return cn ? [{ id: childId, node: cn, content: childElements[i] }] : [];
      })
    : undefined;

  // Slot activa en edición (docs/23 §5, T11): solo en Edit y solo para
  // composites `splitRender` (hoy `tabs`). El valor guardado si sigue siendo
  // hijo del composite; si no (ninguno aún, o la slot se borró), la primera.
  // `undefined` en Preview/export → el runtime real gobierna qué panel se ve
  // (P8). El callback `onActivateSlot` solo existe en Edit; en export/preview
  // el botón de la pestaña no cambia nada.
  const activeSlotId: NodeId | undefined =
    interactive && def.slots?.splitRender
      ? activeSlotStored && (node.children ?? []).includes(activeSlotStored)
        ? activeSlotStored
        : node.children?.[0]
      : undefined;
  const onActivateSlot =
    interactive && def.slots?.splitRender
      ? (slotId: NodeId) => setActiveSlot(id, slotId)
      : undefined;

  // Afordancia "+ añadir slot" en el canvas (docs/23 Fase 5). Chrome de Edit:
  // solo para composites (`def.slots`), oculta al llegar a `slots.max`. El
  // handler llama `addSlot` (el core posee el store); el componente solo la
  // COLOCA. `undefined` en export/preview (P8).
  const slotAffordance: ReactNode | undefined = (() => {
    if (!interactive || !def.slots) return undefined;
    const count = node.children?.length ?? 0;
    if (def.slots.max !== undefined && count >= def.slots.max) return undefined;
    const label = t(`compositeSlots.${node.type}.add`, {
      defaultValue: def.slots.addLabel ?? "+",
    });
    return (
      <button
        type="button"
        className="pbx-slot-add"
        data-slot-add
        title={label}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          addSlot(id);
        }}
      >
        <span aria-hidden="true">+</span>
        <span className="pbx-slot-add__label">{label}</span>
      </button>
    );
  })();

  // Feedback de drop (docs/09 §2.3, F2-F3): un FANTASMA del elemento arrastrado
  // (GhostNode) muestra dónde caerá.
  //  - Layouts de FLUJO (flex-column/row, block, grid-auto): fantasma EN FLUJO en
  //    el índice → empuja a los hermanos con la forma real (en grid-auto cae en la
  //    celda correcta por orden de lectura).
  //  - grid EXPLÍCITO: la colocación es por celda (no por orden), así que el
  //    fantasma va ABSOLUTO dentro de la celda destino (sobre el recuadro `cell`).
  // El fantasma es chrome: sin `data-node-id` (no entra en `measureChildRects`) y
  // no muta el documento (P1).
  //
  // IMPORTANTE (regresión): `children` SIEMPRE es un Fragment. Si se alternara
  // entre un array y un Fragment según `isOver`, React vería un tipo distinto en
  // ese slot y DESMONTARÍA todo el subárbol (remonta las <img> → parpadeo).
  const dir = interactive && acceptsChildren ? resolveDirection(id) : "block";
  const isExplicitGrid = dir === "grid" && node.props.gridPlacement === "explicit";
  const useFlowGhost =
    interactive && acceptsChildren && isOver && !!drag && dropIndex !== null && !isExplicitGrid;
  const showOverlay = interactive && acceptsChildren && isOver && !!indicator && !useFlowGhost;
  const showCellGhost =
    interactive &&
    acceptsChildren &&
    isOver &&
    !!drag &&
    isExplicitGrid &&
    indicator?.variant === "cell";

  let childList: ReactNode[] = childElements;
  if (useFlowGhost && drag) {
    const i = Math.max(0, Math.min(dropIndex ?? 0, childElements.length));
    childList = [...childElements];
    childList.splice(
      i,
      0,
      <div key="__drop-ghost__" className="pbx-drop-ghost" aria-hidden="true">
        <GhostNode drag={drag} />
      </div>,
    );
  }

  // Fantasma del "pick & insert" (Vía B, Fase 3.1, docs/24 §3.4 + feedback de
  // usuario): el preview por tap NO se limita a la línea/celda del indicador —
  // se ve el elemento REAL que caería ahí (mismo `GhostNode` que usa el hueco
  // en flujo del DnD, §3.4 "reusar el MISMO componente/clases del indicador de
  // drop"), especialmente útil en touch/mobile donde hay menos espacio para
  // "adivinar" el resultado. El `DragData` se deriva 1:1 de `pickInsert.source`
  // (mismo shape que `new-component`/`existing-node`/`fragment`) — no se
  // inventa un tipo nuevo, se reusa el contrato existente del DnD (docs/24 §1).
  // Se pinta EN FLUJO (empuja a los hermanos), igual que `useFlowGhost` arriba;
  // ambos son mutuamente excluyentes (no puede haber un DnD real Y un
  // pick&insert a la vez — el lock de selección ya impide iniciar uno mientras
  // el otro corre).
  if (pickCandidateHere) {
    const pickDrag: DragData =
      pickInsert!.source.kind === "new"
        ? { kind: "new-component", componentType: pickInsert!.source.type }
        : pickInsert!.source.kind === "fragment"
          ? { kind: "fragment", layoutId: pickInsert!.source.layoutId }
          : { kind: "existing-node", nodeId: pickInsert!.source.nodeId };
    const i = Math.max(0, Math.min(pickCandidateHere.index, childElements.length));
    childList = [...childElements];
    childList.splice(
      i,
      0,
      <div key="__pick-insert-ghost__" className="pbx-drop-ghost" aria-hidden="true">
        <GhostNode drag={pickDrag} />
      </div>,
    );
  }

  // Badge de behavior (docs/10 §5, Fase 8.1): en Edit, los nodos con behaviors
  // muestran un indicador "interactivo" (chrome, nunca en export). Se inyecta en
  // los children; hoy los behaviors aplican a containers, que sí los renderizan.
  const hasBehaviors = interactive && !!node.behaviors?.length;
  const behaviorBadge = hasBehaviors ? (
    <div key="__behavior-badge__" className="pbx-behavior-badge" aria-hidden="true">
      <Zap size={11} /> {getBehaviorDefinition(node.behaviors![0]!.type)?.label ?? node.behaviors![0]!.type}
      {node.behaviors!.length > 1 ? ` +${node.behaviors!.length - 1}` : ""}
    </div>
  ) : null;

  const children: ReactNode = (
    <>
      {behaviorBadge}
      {childList}
      <DropIndicatorOverlay
        showOverlay={showOverlay}
        showCellGhost={showCellGhost}
        indicator={indicator}
        drag={drag}
      />
    </>
  );

  // Acción(es) onClick (docs/20 §3, docs/44 §2.3): en el canvas también se
  // emiten los `data-pb-*` de cada `ActionDefinition` (vía `actionRegistry`,
  // P4 — sin comparar contra ningún `type` concreto) para que Preview pueda
  // hidratar el disparo (WYSIWYG). En Edit es inocuo (ningún runtime corre).
  // El export lo emite aparte (`exportToHtml.ts`, central).
  const actionAttrsMap = actionDataAttributes(nodeActions(node));
  const actionAttrs: HTMLAttributes<HTMLElement> | undefined =
    Object.keys(actionAttrsMap).length > 0
      ? (actionAttrsMap as HTMLAttributes<HTMLElement>)
      : undefined;

  // Preview en vivo del estado `pressed` desde el Inspector (T9 + `pressed`):
  // si este nodo está seleccionado y su previewState es `"pressed"`, fija
  // `aria-pressed="true"` en el `rootProps` para que la regla CSS del estado
  // (`[aria-pressed="true"]`, `cssSerializer.STATE_SELECTORS`) aplique en vivo
  // sin tocar el documento (P1 intacto: UI-state del Inspector, no entra a
  // zundo, no muta `document.nodes`). `false`/ausente = vuelve al estado normal
  // implícito.
  const previewPressed = previewState === "pressed";

  const rootProps: HTMLAttributes<HTMLElement> & { "data-node-id"?: NodeId } = interactive
    ? {
        ...actionAttrs,
        ...(previewPressed ? { "aria-pressed": true } : {}),
        "data-node-id": id,
        className: [
          "pbx-node",
          selectedId === id ? "pbx-node--selected" : "",
          isEditingThis ? "pbx-node--editing-text" : "",
          isOver ? "pbx-node--drop-over" : "",
          dragging ? "pbx-node--dragging" : "",
          hasBehaviors ? "pbx-node--has-behaviors" : "",
        ]
          .filter(Boolean)
          .join(" "),
        onClick: (e) => {
          e.stopPropagation();
          // Pick & insert activo (Vía B, docs/24 §3.2 pasos 2-3): un tap sobre
          // un destino válido PREVISUALIZA dónde caería (mismo cómputo de
          // proximidad que el DnD, `computeDropTargetAtPoint` — geometry.ts),
          // sin mutar el documento (P1). Innermost-wins (mismo
          // `stopPropagation` de siempre): el nodo más profundo bajo el
          // puntero que sea un destino válido es el que previsualiza/confirma;
          // si este nodo no acepta el `source` actual, el tap no hace nada.
          if (pickInsert) {
            if (!canPickInsertInto(id)) return;
            const container = ref.current;
            if (!container) return;
            const { index } = computeDropTargetAtPoint({
              container,
              childIds: getChildIds(),
              direction: getDirection(),
              pointer: { x: e.clientX, y: e.clientY },
            });
            const existing = pickInsert.candidate;
            // Segundo tap en el MISMO destino (mismo parentId + índice ya
            // previsualizado) confirma (docs/24 §3.2 doble modalidad,
            // combinado con el mini-dropdown de confirmación). Tap en otro
            // destino (u otro punto del mismo) re-previsualiza.
            if (existing && existing.parentId === id && existing.index === index) {
              confirmPickInsertTarget(id);
            } else {
              setPickInsertCandidate({ parentId: id, index });
            }
            return;
          }
          // Ya en edición: el propio TextRender maneja sus clicks internos
          // (stopPropagation), así que llegar aquí con isEditingThis=true no
          // debería pasar en la práctica — no-op defensivo, sin reseleccionar.
          if (isEditingThis) return;
          // Segundo click sobre un nodo `editableInline` ya seleccionado:
          // entra en modo edición (docs/12 §B.11) en vez de solo reseleccionar.
          if (def?.editableInline && selectedId === id) {
            startEditingText(id);
            return;
          }
          select(id);
        },
      }
    : {};

  return def.render({
    // `props` con el contenido resuelto en el idioma de edición activo; el
    // resto del nodo (id, type, style, children) no cambia (docs/12 §B.6-7).
    node: effectiveProps === node.props ? node : { ...node, props: effectiveProps! },
    children,
    slots,
    exportMode: false,
    interactive,
    breakpoint: activeBreakpoint,
    rootRef: ref,
    rootProps: interactive ? rootProps : actionAttrs,
    resolveImageSrc: resolveImgSrc,
    // Solo en Edit (nunca en Preview: ahí el runtime real SÍ debe recortar
    // visualmente, es su propósito — docs/10 §5 tabla). El core no conoce
    // "carousel": el helper lee el registry contra `node.behaviors` (P4).
    suppressClip: interactive && nodeClipsContentWhenActive(node),
    overlayEditing: overlayRoot ?? false,
    editPreviewChrome,
    // Estado de interacción previsualizado en el Inspector (ver `RenderContext.previewState`).
    // Solo se pasa en modo Edit: en Preview el runtime real gobierna el estado, en export
    // el documento no tiene preview (P1: UI-state del Inspector, no del documento).
    previewState: interactive ? previewState : undefined,
    localeInfo,
    pagesInfo,
    slotAffordance,
    activeSlotId,
    onActivateSlot,
  });
}
