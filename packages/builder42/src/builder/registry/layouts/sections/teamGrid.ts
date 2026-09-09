import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Grid de equipo (docs/37 §3.1 #2): primer uso de `avatar` suelto (fuera de
 * `testimonial`) en la galería de layouts (hueco real, docs/37 §1). 3
 * miembros con `avatar` + nombre + rol dentro de una `card`.
 *
 * Pulido (docs/builder-sections-plan.md #9): los 3 `avatar` tenían
 * `source: { kind: "url", url: "" }` (vacío, caían al fallback de
 * iniciales). Se reemplazan por retratos reales de Unsplash
 * (`images.unsplash.com/photo-<id>?...&crop=faces`) y los nombres/roles se
 * alinean a un equipo de producto/soporte de una empresa de mensajería
 * multicanal (Customer Success, Producto, Deliverability engineering) en
 * vez de roles genéricos.
 *
 * Pulido de diseño (feedback: sombra plana, radios inconsistentes): las 3
 * `card` pasan de `shadows.sm` (token `0 1px 2px`, casi imperceptible) a un
 * `boxShadow` compuesto con blur real (`0 16px 32px -12px ...` + una segunda
 * capa de contacto corta) para dar profundidad de tarjeta flotante en vez de
 * un borde apenas sombreado. El avatar sube de 48px (tamaño de icono inline)
 * a 96px con radio 50% consistente en los 3 — suficientemente grande para
 * leerse como retrato de equipo, no como avatar de comentario. El grid en sí
 * se mantiene simétrico a propósito (un equipo real luce bien en 3 columnas
 * uniformes; la asimetría es para features/marketing, no para personas).
 */
export function buildTeamGridFragment(): NodeFragment {
  const cardShadow = "0 16px 32px -12px rgba(15, 23, 42, 0.16), 0 3px 8px -2px rgba(15, 23, 42, 0.08)";
  const avatarStyle = {
    base: {
      ...defaultStyleFor("avatar").base,
      size: { width: "96px", height: "96px" },
      appearance: { ...defaultStyleFor("avatar").base.appearance, borderRadius: "50%" },
    },
  };
  const cardStyle = {
    base: {
      ...defaultStyleFor("card").base,
      layout: { ...defaultStyleFor("card").base.layout, alignItems: "center" as const },
      spacing: { padding: { token: "spacing.lg" } },
      appearance: {
        ...defaultStyleFor("card").base.appearance,
        borderRadius: { token: "radii.lg" },
        boxShadow: cardShadow,
      },
    },
  };

  return {
    rootId: "team-grid-root",
    nodes: {
      "team-grid-root": {
        id: "team-grid-root",
        type: "section",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.lg" } }, spacing: { padding: { token: "spacing.lg" } } },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
        },
        children: ["team-grid-1", "team-grid-2", "team-grid-3"],
      },
      "team-grid-1": {
        id: "team-grid-1",
        type: "card",
        props: {},
        style: cardStyle,
        children: ["team-grid-1-avatar", "team-grid-1-name", "team-grid-1-role"],
      },
      "team-grid-1-avatar": {
        id: "team-grid-1-avatar",
        type: "avatar",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&q=80&auto=format&fit=crop&crop=faces",
          },
          alt: "Portrait of Laura Gomez",
          initials: "LG",
        },
        style: avatarStyle,
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
        props: { content: "Product — Multichannel messaging" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "team-grid-2": {
        id: "team-grid-2",
        type: "card",
        props: {},
        style: cardStyle,
        children: ["team-grid-2-avatar", "team-grid-2-name", "team-grid-2-role"],
      },
      "team-grid-2-avatar": {
        id: "team-grid-2-avatar",
        type: "avatar",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop&crop=faces",
          },
          alt: "Portrait of Diego Peralta",
          initials: "DP",
        },
        style: avatarStyle,
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
        props: { content: "Deliverability engineering" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "team-grid-3": {
        id: "team-grid-3",
        type: "card",
        props: {},
        style: cardStyle,
        children: ["team-grid-3-avatar", "team-grid-3-name", "team-grid-3-role"],
      },
      "team-grid-3-avatar": {
        id: "team-grid-3-avatar",
        type: "avatar",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80&auto=format&fit=crop&crop=faces",
          },
          alt: "Portrait of Sara Nunez",
          initials: "SN",
        },
        style: avatarStyle,
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
        props: { content: "Customer Success" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}

