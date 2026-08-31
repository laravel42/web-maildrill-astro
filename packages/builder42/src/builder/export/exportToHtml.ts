/**
 * Export a HTML + CSS estático (PLAN §5, P3/P8).
 *
 * NO hay un serializador de HTML aparte: se reutiliza el MISMO `render()` del
 * registry con `exportMode = true` (P3, cero divergencia con el canvas). El
 * resultado no depende del store ni del canvas (P8): solo del documento, el
 * registry y `react-dom/server`.
 *
 * - HTML: `renderToStaticMarkup` sobre el árbol, con `className` generada por
 *   nodo y sin chrome de edición (rootRef/rootProps undefined).
 * - CSS: `cssSerializer` emite base + `@media` por override (docs/01 §5).
 */

import { createElement, Fragment, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_BREAKPOINTS,
  type BreakpointConfig,
  type BuilderDocument,
  type DesignTokens,
  type LinkTarget,
  type NodeId,
  type NodeTranslations,
} from "../model/types";
import { getDefinition } from "../registry/componentRegistry";
import { actionDataAttributes, getActionDefinition } from "../registry/actionRegistry";
import { nodeActions } from "../model/nodeAction";
import type { RenderContext } from "../registry/types";
import { classNameForNode, serializeNodeCss } from "./cssSerializer";
import { tokensToCss } from "../model/tokens";
import { resolvePropsForLocale } from "../model/i18nContent";
import type { ImageSource } from "../model/types";
import type { ExportWarningsCollector } from "./warnings";

/** Resolutores inyectados en el render del export (docs/07 §4). */
export interface RenderResolvers {
  resolveLink?: (link: LinkTarget) => string;
  resolveImageSrc?: (source: ImageSource) => string;
  /**
   * Info de localización para componentes de navegación (docs/14 §2.5,
   * `language-nav`). La construye `exportPage` con el locale actual del loop.
   * Ausente en sitios monolingües.
   */
  localeInfo?: RenderContext["localeInfo"];
  /**
   * Páginas del sitio con ruta resuelta (docs/16 §12.4, rework `navbar`). La
   * construye `resolversFor` (`export/site.ts`) con `buildPathMap`/
   * `buildPathMapForLocale`. Siempre presente en el export (todo sitio tiene
   * al menos la home) — a diferencia de `localeInfo`.
   */
  pagesInfo?: RenderContext["pagesInfo"];
}

/**
 * Contenido multilingüe (docs/12 §B.7). Si se omite, `renderDocumentHtml`
 * produce exactamente el HTML del idioma default (retrocompat total con
 * sitios monolingües — mismo comportamiento que antes de i18n).
 */
export interface RenderLocaleOptions {
  locale: string;
  defaultLocale: string;
  translations: Record<NodeId, NodeTranslations> | undefined;
}

/**
 * Nodos de un documento REFERENCIADOS como objetivo por alguna acción de
 * click cuya `ActionDefinition.targetKind` sea `"node"` (docs/44 §4 fila P1,
 * `scroll-to`). Genérico por diseño (P4): no pregunta por ningún `type` de
 * acción concreto, solo por el `targetKind` que la propia definición declara
 * — el mismo criterio serviría para una acción futura distinta que también
 * apunte a un nodo cualquiera del documento. Un nodo en este set necesita ser
 * LOCALIZABLE en el DOM exportado: `renderNode` le emite `id="<nodeId>"`.
 *
 * Esto también CIERRA un hallazgo real descubierto al implementar `scroll-to`:
 * `LinkTarget.kind:"anchor"` (`export/links.ts`) ya resolvía a `href="#<id>"`
 * desde antes de esta fase, pero ningún nodo del export tenía nunca un `id`
 * real que ese `#id` pudiera encontrar — el ancla estaba rota en la práctica
 * para cualquier nodo que no fuera ya un componente con `id` propio (p. ej.
 * `input`/`textarea`, que sí lo emiten por su propio `render()`). Este mismo
 * criterio genérico ("nodo referenciado como target") también cubre el caso
 * `anchor`: basta con que la resolución de `LinkTarget` cuente como una
 * "referencia por nodeId" igual que una `NodeAction` con `targetKind: "node"`.
 */
function nodesReferencedAsTarget(doc: BuilderDocument): Set<NodeId> {
  const targets = new Set<NodeId>();
  for (const node of Object.values(doc.nodes)) {
    for (const action of nodeActions(node)) {
      if (action.target && getActionDefinition(action.type)?.targetKind === "node") {
        targets.add(action.target);
      }
    }
    // `LinkTarget.kind: "anchor"` (docs/06 §4, `export/links.ts` → `href="#<id>"`)
    // referencia un nodo por id exactamente igual que una acción con
    // `targetKind: "node"` — mismo criterio genérico, sin acoplarse a ningún
    // campo concreto: cualquier prop del nodo con forma `LinkTarget` cuenta.
    for (const value of Object.values(node.props)) {
      if (
        typeof value === "object" &&
        value !== null &&
        (value as { kind?: unknown }).kind === "anchor" &&
        typeof (value as { nodeId?: unknown }).nodeId === "string"
      ) {
        targets.add((value as { nodeId: string }).nodeId);
      }
    }
  }
  return targets;
}

function behaviorRootProps(
  node: BuilderDocument["nodes"][string],
  isReferencedTarget: boolean,
): Record<string, string> | undefined {
  const props: Record<string, string> = {};
  // Ancla real para que un `scroll-to`/`LinkTarget.kind:"anchor"` pueda
  // encontrar este nodo en el DOM exportado (ver `nodesReferencedAsTarget`).
  // Solo se emite si HACE FALTA (tree-shake de atributos, igual criterio que
  // el resto de este archivo): un nodo que nadie referencia no gana un `id`
  // nuevo, así que el output de un sitio sin `scroll-to`/`anchor` no cambia.
  if (isReferencedTarget) props.id = node.id;
  const behaviors = node.behaviors;
  // Tipos de hidratación (docs/10 §4) que este nodo necesita: los `behaviors[]`
  // de siempre, MÁS el tipo de cada acción de click cuya `ActionDefinition`
  // declare `runtime` propio (docs/44 §2.4 — hoy ninguna acción de la Fase 0
  // tenía runtime propio, `dismiss` es la primera). El loader (`enhance.ts`)
  // ya es genérico por convención `data-pb-behavior` + `enhance<Type>` (P4): no
  // necesita saber si el tipo es un "behavior" o una "acción", así que ambos
  // catálogos comparten el mismo canal de hidratación sin que el core
  // distinga entre ellos. `open-modal`/`close-modal` no tienen `runtime` propio
  // (reutilizan el del componente `modal`) y no entran aquí — output sin cambios.
  const actionTypesWithRuntime = nodeActions(node)
    .filter((a) => !!getActionDefinition(a.type)?.runtime)
    .map((a) => a.type);
  const hydratedTypes = [...(behaviors?.map((b) => b.type) ?? []), ...actionTypesWithRuntime];
  if (hydratedTypes.length > 0) {
    // Hidratación multi-behavior (docs/10 §4): `data-pb-behavior` lista TODOS los
    // tipos del nodo separados por espacio; `data-pb-options` es un mapa
    // `type → options` (los tipos son únicos por nodo — `addBehavior` no duplica).
    // Para un solo behavior sin opciones queda `data-pb-behavior="<type>"` a secas.
    props["data-pb-behavior"] = hydratedTypes.join(" ");
    const optionsByType: Record<string, Record<string, unknown>> = {};
    for (const b of behaviors ?? []) {
      if (b.options && Object.keys(b.options).length > 0) optionsByType[b.type] = b.options;
    }
    for (const action of nodeActions(node)) {
      if (getActionDefinition(action.type)?.runtime && action.params && Object.keys(action.params).length > 0) {
        optionsByType[action.type] = action.params;
      }
    }
    if (Object.keys(optionsByType).length > 0) {
      props["data-pb-options"] = JSON.stringify(optionsByType);
    }
  }
  // Acción(es) onClick (docs/20 §3, docs/44 §2.3): emisión CENTRAL vía el
  // `actionRegistry` (P4) — el core no compara contra ningún `type` concreto,
  // solo pide a cada `ActionDefinition` sus `data-pb-*`. `open-modal` emite el
  // mismo `data-pb-modal-target=<id>` de siempre (output sin cambios).
  Object.assign(props, actionDataAttributes(nodeActions(node)));
  return Object.keys(props).length > 0 ? props : undefined;
}

function renderNode(
  doc: BuilderDocument,
  id: NodeId,
  targetIds: Set<NodeId>,
  resolvers?: RenderResolvers,
  localeOpts?: RenderLocaleOptions,
  warnings?: ExportWarningsCollector,
): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) {
    warnings?.push({
      nodeId: id,
      type: "missing-node",
      message: `Node "${id}" not found in document`,
    });
    return null;
  }
  const def = getDefinition(node.type);
  if (!def) {
    warnings?.push({
      nodeId: id,
      type: "unknown-type",
      message: `Unknown component type "${node.type}"`,
      nodeType: node.type,
    });
    return null;
  }

  const children = node.children?.map((childId) =>
    createElement(
      Fragment,
      { key: childId },
      renderNode(doc, childId, targetIds, resolvers, localeOpts, warnings),
    ),
  );

  const effectiveNode = localeOpts
    ? (() => {
        const props = resolvePropsForLocale(
          node,
          localeOpts.locale,
          localeOpts.defaultLocale,
          localeOpts.translations,
        );
        return props === node.props ? node : { ...node, props };
      })()
    : node;

  // Composite con slots partidas (docs/23 §3.2): el padre necesita acceso
  // estructurado a sus slots (label + contenido renderizado). Mismo criterio que
  // `NodeRenderer` en el canvas (P3). El `node` de cada slot se resuelve por
  // locale igual que el padre (su `label` puede estar traducido).
  const slots = def.slots?.splitRender
    ? (node.children ?? []).flatMap((childId) => {
        const child = doc.nodes[childId];
        if (!child) {
          warnings?.push({
            nodeId: childId,
            type: "missing-node",
            message: `Node "${childId}" not found in document`,
          });
          return [];
        }
        const childNode = localeOpts
          ? (() => {
              const props = resolvePropsForLocale(
                child,
                localeOpts.locale,
                localeOpts.defaultLocale,
                localeOpts.translations,
              );
              return props === child.props ? child : { ...child, props };
            })()
          : child;
        return [
          {
            id: childId,
            node: childNode,
            content: createElement(
              Fragment,
              { key: childId },
              renderNode(doc, childId, targetIds, resolvers, localeOpts, warnings),
            ),
          },
        ];
      })
    : undefined;

  return def.render({
    node: effectiveNode,
    children,
    slots,
    exportMode: true,
    className: classNameForNode(node.id),
    breakpoint: "base",
    rootRef: undefined,
    // Hidratación (docs/10 §4): solo se inyecta `data-pb-*` si el nodo tiene
    // behaviors (ausente = nodo estático, sin atributos extra → cero-JS
    // verificable por diff, P8/P9). Reusa el mismo canal `rootProps` que ya
    // usa el DnD/selección en el canvas (docs/02 §10.3): sin wrapper.
    rootProps: behaviorRootProps(node, targetIds.has(node.id)) as RenderContext["rootProps"],
    resolveLink: resolvers?.resolveLink,
    resolveImageSrc: resolvers?.resolveImageSrc,
    localeInfo: resolvers?.localeInfo,
    pagesInfo: resolvers?.pagesInfo,
  });
}

/**
 * HTML estático del árbol de un documento (reusa render() del registry, P3).
 * `localeOpts` resuelve el contenido traducido (docs/12 §B.7); si se omite,
 * produce el HTML del idioma default tal cual (retrocompat).
 */
export function renderDocumentHtml(
  doc: BuilderDocument,
  resolvers?: RenderResolvers,
  localeOpts?: RenderLocaleOptions,
  warnings?: ExportWarningsCollector,
): string {
  const targetIds = nodesReferencedAsTarget(doc);
  const tree = renderNode(doc, doc.rootId, targetIds, resolvers, localeOpts, warnings);
  return tree ? renderToStaticMarkup(tree) : "";
}

export interface ExportResult {
  html: string;
  css: string;
}

/**
 * Reset base del output publicado: `border-box` para que `padding`/`border` no
 * sumen al ancho (mismo modelo de caja que usa el canvas del editor, así el
 * WYSIWYG coincide con el HTML exportado).
 */
const CSS_RESET = "*, *::before, *::after { box-sizing: border-box; }";

/**
 * Exporta una página a HTML + CSS. Los breakpoints (`cfg`) y los `tokens` viven
 * a nivel sitio (docs/06 §3, docs/08), por eso se pasan como parámetros. El CSS
 * emite primero `:root { --… }` (tokens) para que las referencias `var(--…)`
 * resuelvan (docs/08 §4). Por defecto usa `DEFAULT_BREAKPOINTS` y sin tokens.
 */
export function exportToHtml(
  doc: BuilderDocument,
  cfg: BreakpointConfig = DEFAULT_BREAKPOINTS,
  tokens?: DesignTokens,
  warnings?: ExportWarningsCollector,
): ExportResult {
  const html = renderDocumentHtml(doc, undefined, undefined, warnings);

  const nodeCss = Object.values(doc.nodes)
    .map((node) => {
      // T9: si el componente declara un estado con clase derivada (p. ej. el
      // botón de `tab` dentro de `tabs`), ancla las reglas de `style.states`
      // a esa clase en vez de la raíz del nodo (ver `serializeNodeCss`).
      // Limitación conocida: `serializeNodeCss` solo acepta UNA clase de
      // estados por nodo — suficiente hoy (cada componente declara a lo sumo
      // un estado con `classSuffix`); si se necesitan dos estados con clases
      // derivadas distintas en el mismo nodo, extender la firma a un mapa.
      const stateSpec = getDefinition(node.type)?.styleSchema?.states?.[0];
      const statesClassName = stateSpec ? classNameForNode(node.id, stateSpec.classSuffix) : undefined;
      return serializeNodeCss(classNameForNode(node.id), node.style, cfg, statesClassName);
    })
    .filter(Boolean)
    .join("\n\n");

  const rootTokens = tokensToCss(tokens, ":root", cfg);
  const css = [rootTokens, CSS_RESET, nodeCss].filter(Boolean).join("\n\n");

  return { html, css };
}
