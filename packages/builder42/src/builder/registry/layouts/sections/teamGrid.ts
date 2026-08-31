import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Grid de equipo (docs/37 §3.1 #2): primer uso de `avatar` suelto (fuera de
 * `testimonial`) en la galería de layouts (hueco real, docs/37 §1). 3
 * miembros con `avatar` (fallback de iniciales) + nombre + rol dentro de una
 * `card`.
 */
export function buildTeamGridFragment(): NodeFragment {
  return {
    rootId: "team-grid-root",
    nodes: {
      "team-grid-root": {
        id: "team-grid-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            spacing: { padding: { token: "spacing.md" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
        },
        children: ["team-grid-1", "team-grid-2", "team-grid-3"],
      },
      "team-grid-1": {
        id: "team-grid-1",
        type: "card",
        props: {},
        style: defaultStyleFor("card"),
        children: ["team-grid-1-avatar", "team-grid-1-name", "team-grid-1-role"],
      },
      "team-grid-1-avatar": {
        id: "team-grid-1-avatar",
        type: "avatar",
        props: { source: { kind: "url", url: "" }, alt: "", initials: "LG" },
        style: defaultStyleFor("avatar"),
      },
      "team-grid-1-name": {
        id: "team-grid-1-name",
        type: "text",
        props: { content: "<strong>Laura Gómez</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "team-grid-1-role": {
        id: "team-grid-1-role",
        type: "text",
        props: { content: "Diseño de producto" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "team-grid-2": {
        id: "team-grid-2",
        type: "card",
        props: {},
        style: defaultStyleFor("card"),
        children: ["team-grid-2-avatar", "team-grid-2-name", "team-grid-2-role"],
      },
      "team-grid-2-avatar": {
        id: "team-grid-2-avatar",
        type: "avatar",
        props: { source: { kind: "url", url: "" }, alt: "", initials: "DP" },
        style: defaultStyleFor("avatar"),
      },
      "team-grid-2-name": {
        id: "team-grid-2-name",
        type: "text",
        props: { content: "<strong>Diego Peralta</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "team-grid-2-role": {
        id: "team-grid-2-role",
        type: "text",
        props: { content: "Ingeniería" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "team-grid-3": {
        id: "team-grid-3",
        type: "card",
        props: {},
        style: defaultStyleFor("card"),
        children: ["team-grid-3-avatar", "team-grid-3-name", "team-grid-3-role"],
      },
      "team-grid-3-avatar": {
        id: "team-grid-3-avatar",
        type: "avatar",
        props: { source: { kind: "url", url: "" }, alt: "", initials: "SN" },
        style: defaultStyleFor("avatar"),
      },
      "team-grid-3-name": {
        id: "team-grid-3-name",
        type: "text",
        props: { content: "<strong>Sara Núñez</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "team-grid-3-role": {
        id: "team-grid-3-role",
        type: "text",
        props: { content: "Atención a clientes" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}
