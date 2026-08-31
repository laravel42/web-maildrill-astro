/**
 * Component Registry — punto único de extensión (PLAN §3, P4).
 *
 * El core (canvas, export, store) consulta este mapa dinámicamente; NUNCA hace
 * `switch(type)`. Agregar un componente = registrar su `ComponentDefinition`
 * (defaults + schemas + `render`), sin tocar el core.
 */

import type { BuilderNode, NodeId } from "../model/types";
import type { ComponentDefinition } from "./types";
import { containerDefinition } from "./components/Container";
import { imageDefinition } from "./components/Image";
import { buttonDefinition, buttonSubmitDefinition } from "./components/Button";
import { textDefinition } from "./components/Text.stub";
import { selectDefinition } from "./components/Select";
import { languageNavDefinition } from "./components/LanguageNav";
import { labelDefinition } from "./components/Label";
import { inputDefinition } from "./components/Input";
import { textareaDefinition } from "./components/Textarea";
import { formDefinition } from "./components/Form";
import { dividerDefinition } from "./components/Divider";
import { spacerDefinition } from "./components/Spacer";
import { sectionDefinition } from "./components/Section";
import { badgeDefinition } from "./components/Badge";
import { iconDefinition } from "./components/IconComponent";
import { quoteDefinition } from "./components/Quote";
import { statDefinition } from "./components/Stat";
import { avatarDefinition } from "./components/Avatar";
import { videoDefinition } from "./components/Video";
import { cardDefinition } from "./components/Card";
import { heroDefinition } from "./components/Hero";
import { testimonialDefinition } from "./components/Testimonial";
import { pricingCardDefinition } from "./components/PricingCard";
import { logoCloudDefinition } from "./components/LogoCloud";
import { alertDefinition } from "./components/Alert";
import { footerDefinition } from "./components/Footer";
import { navMenuDefinition } from "./components/NavMenu";
import { socialLinksDefinition } from "./components/SocialLinks";
import { breadcrumbDefinition } from "./components/Breadcrumb";
import { accordionDefinition } from "./components/Accordion";
import { accordionItemDefinition } from "./components/AccordionItem";
import { modalDefinition } from "./components/Modal";
import { tabsDefinition } from "./components/Tabs";
import { tabDefinition } from "./components/Tab";
import { navbarDefinition } from "./components/Navbar";

const DEFINITIONS: ComponentDefinition[] = [
  containerDefinition,
  // Fase 12 — componentes especializados
  dividerDefinition,
  spacerDefinition,
  sectionDefinition,
  imageDefinition,
  buttonDefinition,
  textDefinition,
  badgeDefinition,
  iconDefinition,
  quoteDefinition,
  statDefinition,
  avatarDefinition,
  videoDefinition,
  cardDefinition,
  heroDefinition,
  testimonialDefinition,
  pricingCardDefinition,
  logoCloudDefinition,
  alertDefinition,
  selectDefinition,
  languageNavDefinition,
  footerDefinition,
  navMenuDefinition,
  socialLinksDefinition,
  breadcrumbDefinition,
  // Fase 12 Bloque D — componentes interactivos (JS opt-in, docs/16 §12.4)
  accordionDefinition,
  accordionItemDefinition,
  modalDefinition,
  tabsDefinition,
  tabDefinition,
  navbarDefinition,
  // Fase 10 — componentes de formulario
  formDefinition,
  labelDefinition,
  inputDefinition,
  textareaDefinition,
  buttonSubmitDefinition,
];

export const componentRegistry: Record<string, ComponentDefinition> =
  Object.fromEntries(DEFINITIONS.map((def) => [def.type, def]));

/** Definición por tipo (o undefined si no está registrado). */
export function getDefinition(type: string): ComponentDefinition | undefined {
  return componentRegistry[type];
}

/** Lista ordenada de definiciones (para el sidebar de componentes). */
export function listDefinitions(): ComponentDefinition[] {
  return DEFINITIONS;
}

/**
 * CSS estático de los COMPONENTES realmente usados en un conjunto de nodos
 * (T10, AGENTS.md): concatena `ComponentDefinition.css` de cada definición
 * cuyo `type` aparece en algún nodo, en orden estable de `DEFINITIONS`. ""
 * si ningún tipo en uso declara `css`. A diferencia de
 * `usedBehaviorsCssForNodes` (`behaviorRegistry.ts`, tree-shake por behavior
 * ADJUNTO), esto se dispara por la mera EXISTENCIA de un nodo del tipo — el
 * CSS presentacional del componente no depende de si tiene un behavior JS
 * activo. Compartido por el export (`export/site.ts`) y el editor en vivo
 * (`app/layout/ComponentsStyle.tsx`), mismo criterio que su análogo de
 * behaviors.
 */
export function usedComponentsCssForNodes(nodes: Iterable<BuilderNode>): string {
  const usedTypes = new Set<string>();
  for (const node of nodes) usedTypes.add(node.type);
  return DEFINITIONS.filter((def) => usedTypes.has(def.type) && def.css)
    .map((def) => def.css)
    .join("\n\n");
}

/** Orden canónico de categorías para agrupar la paleta del sidebar (docs/14 §3). */
export const COMPONENT_CATEGORIES = ["layout", "content", "form", "navigation"] as const;/**
 * Definiciones agrupadas por categoría, en el orden canónico
 * (`COMPONENT_CATEGORIES`); dentro de cada grupo, orden de registro. Omite
 * categorías vacías. Usado por el sidebar para los headers de sección.
 */
export function listDefinitionsByCategory(): { category: string; definitions: ComponentDefinition[] }[] {
  return COMPONENT_CATEGORIES.map((category) => ({
    category,
    // `hiddenInPalette` (docs/23 §3.1): los nodos de slot (`tab`, …) no se
    // arrastran desde la paleta; se crean vía la afordancia "+ añadir" del
    // composite. Se excluyen del sidebar.
    definitions: DEFINITIONS.filter(
      (def) => def.category === category && !def.hiddenInPalette,
    ),
  })).filter((group) => group.definitions.length > 0);
}

/** Genera un id único para un nodo nuevo. */
function newNodeId(): NodeId {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `n-${rand}`;
}

/**
 * Crea un `BuilderNode` a partir de un tipo registrado, clonando los defaults
 * (para no compartir referencias). Usado por `addComponent` del store (docs/03 §7).
 */
export function createNodeForType(type: string): BuilderNode {
  const def = getDefinition(type);
  if (!def) throw new Error(`Tipo de componente no registrado: "${type}"`);
  const node: BuilderNode = {
    id: newNodeId(),
    type: def.type,
    props: structuredClone(def.defaultProps),
    style: structuredClone(def.defaultStyle),
  };
  if (def.acceptsChildren) node.children = [];
  // Behaviors de fábrica (Bloque D, docs/16 §12.4): los componentes
  // intrínsecamente interactivos traen su runtime declarado en el registry.
  // Se clona igual que props/style para no compartir referencias (P1/P2).
  if (def.defaultBehaviors && def.defaultBehaviors.length > 0) {
    node.behaviors = structuredClone(def.defaultBehaviors);
  }
  return node;
}

/**
 * Crea un nodo y su SUBÁRBOL de hijos por defecto (docs/23 §7) a partir de un
 * tipo registrado. Devuelve el id raíz + todos los nodos generados (raíz +
 * descendientes), listos para insertarse en el documento de una vez. Para tipos
 * sin `defaultChildren` equivale a `createNodeForType` (solo la raíz). Usado por
 * `addComponent` del store; los composites (p. ej. `tabs`) nacen así con sus
 * slots sembradas.
 */
export function createNodeTreeForType(type: string): {
  rootId: NodeId;
  nodes: Record<NodeId, BuilderNode>;
} {
  const def = getDefinition(type);
  if (!def) throw new Error(`Tipo de componente no registrado: "${type}"`);
  const nodes: Record<NodeId, BuilderNode> = {};

  const expand = (specType: string, propsOverride?: Record<string, unknown>, childSpecs?: import("./types").DefaultChildSpec[]): NodeId => {
    const n = createNodeForType(specType);
    if (propsOverride) n.props = { ...n.props, ...structuredClone(propsOverride) };
    nodes[n.id] = n;
    const specs = childSpecs ?? getDefinition(specType)?.defaultChildren;
    if (specs && specs.length > 0) {
      n.children = n.children ?? [];
      for (const spec of specs) {
        n.children.push(expand(spec.type, spec.props, spec.children));
      }
    }
    return n.id;
  };

  // La raíz usa sus propios `defaultChildren` (si los tiene); los hijos se
  // expanden recursivamente con los suyos.
  const rootId = expand(type, undefined, def.defaultChildren);
  return { rootId, nodes };
}
