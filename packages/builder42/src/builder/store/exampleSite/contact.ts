import type { BuilderPage } from "../../model/types";
import { createPage } from "../../model/site";
import { defaultStyleFor } from "./styleFor";

// Página de contacto: formulario + columna lateral de información (icono +
// texto por canal, y redes sociales) en un layout de dos columnas. Además del
// formulario de Fase 10 (form, label, input, textarea, button-submit), suma
// `icon`, `divider` y `social-links` — antes la página era solo el formulario
// solo, sin contexto alrededor.
// Usa exclusivamente BASE_TOKENS — funciona con cualquier tema de la galería.
export function createContactPage(): BuilderPage {
  return createPage(
    { title: "Contacto", slug: "contacto" },
    {
      rootId: "contact-root",
      meta: { version: 1 },
      nodes: {
        "contact-root": {
          id: "contact-root",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
              appearance: { background: { token: "colors.surface.alt" } },
            },
          },
          children: ["contact-wrap"],
        },
        // Contenedor centrado con ancho máximo tokenizado (patrón de la home).
        "contact-wrap": {
          id: "contact-wrap",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
              spacing: { padding: { token: "spacing.lg" }, margin: "0 auto" },
              size: { width: "100%", maxWidth: { token: "sizes.container" } },
              appearance: { background: { token: "colors.surface.default" } },
            },
          },
          children: ["contact-navbar", "contact-section"],
        },
        "contact-navbar": {
          id: "contact-navbar",
          type: "navbar",
          // Sin `links`: se generan de `ctx.pagesInfo` (todas las páginas del
          // sitio, docs/16 §12.4 rework) — el usuario oculta con `hiddenPageIds`
          // si no quiere alguna en el menú, en vez de escribir hrefs a mano.
          props: { brand: "Builder42", hiddenPageIds: [] },
          style: defaultStyleFor("navbar"),
          behaviors: [{ type: "navbar", options: { duration: 240 } }],
        },
        // `section`: banda centrada con ancho máximo tokenizado de fábrica —
        // grid 1 col → 2 col en `md` (info lateral + formulario).
        "contact-section": {
          id: "contact-section",
          type: "section",
          props: {},
          style: {
            base: {
              layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.lg" } },
              spacing: { padding: { token: "spacing.md" } },
            },
            overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 320px) 1fr" } } },
          },
          children: ["contact-info", "contact-card"],
        },
        // --- Columna de información: título + canales + redes --------------
        "contact-info": {
          id: "contact-info",
          type: "container",
          props: {},
          style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } } } },
          children: ["contact-heading", "contact-info-intro", "contact-channel-email", "contact-channel-phone", "contact-channel-location", "contact-info-divider", "contact-info-social"],
        },
        "contact-heading": {
          id: "contact-heading",
          type: "text",
          props: { content: "<strong>Contacto</strong>" },
          style: {
            base: {
              typography: {
                fontFamily: { token: "typography.families.sans" },
                fontSize: { token: "typography.sizes.lg" },
                fontWeight: { token: "typography.weights.bold" },
              },
              appearance: { color: { token: "colors.text" } },
            },
          },
        },
        "contact-info-intro": {
          id: "contact-info-intro",
          type: "text",
          props: { content: "Escríbenos y te respondemos en menos de 24 horas." },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "contact-channel-email": {
          id: "contact-channel-email",
          type: "container",
          props: {},
          style: { base: { layout: { display: "flex", alignItems: "center", gap: { token: "spacing.xs" } } } },
          children: ["contact-channel-email-icon", "contact-channel-email-text"],
        },
        "contact-channel-email-icon": {
          id: "contact-channel-email-icon",
          type: "icon",
          props: { name: "Mail", title: "" },
          style: defaultStyleFor("icon"),
        },
        "contact-channel-email-text": {
          id: "contact-channel-email-text",
          type: "text",
          props: { content: "hola@builder42.dev" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "contact-channel-phone": {
          id: "contact-channel-phone",
          type: "container",
          props: {},
          style: { base: { layout: { display: "flex", alignItems: "center", gap: { token: "spacing.xs" } } } },
          children: ["contact-channel-phone-icon", "contact-channel-phone-text"],
        },
        "contact-channel-phone-icon": {
          id: "contact-channel-phone-icon",
          type: "icon",
          props: { name: "Phone", title: "" },
          style: defaultStyleFor("icon"),
        },
        "contact-channel-phone-text": {
          id: "contact-channel-phone-text",
          type: "text",
          props: { content: "+52 55 1234 5678" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "contact-channel-location": {
          id: "contact-channel-location",
          type: "container",
          props: {},
          style: { base: { layout: { display: "flex", alignItems: "center", gap: { token: "spacing.xs" } } } },
          children: ["contact-channel-location-icon", "contact-channel-location-text"],
        },
        "contact-channel-location-icon": {
          id: "contact-channel-location-icon",
          type: "icon",
          props: { name: "MapPin", title: "" },
          style: defaultStyleFor("icon"),
        },
        "contact-channel-location-text": {
          id: "contact-channel-location-text",
          type: "text",
          props: { content: "Ciudad de México, México" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "contact-info-divider": {
          id: "contact-info-divider",
          type: "divider",
          props: {},
          style: defaultStyleFor("divider"),
        },
        "contact-info-social": {
          id: "contact-info-social",
          type: "social-links",
          props: {},
          style: defaultStyleFor("social-links"),
        },
        // `card`: chrome de tarjeta (superficie+borde+radio+sombra) de fábrica
        // en vez del container con borde/padding a mano que tenía antes.
        "contact-card": {
          id: "contact-card",
          type: "card",
          props: {},
          style: defaultStyleFor("card"),
          children: ["contact-form"],
        },
        // form — contenedor del formulario, estilo de fábrica. Behavior
        // `form-validation` (docs/16 §10b, tier 2b Alpine): valida en tiempo
        // real los 3 campos `required` de abajo; sin JS, el submit nativo
        // HTML5 sigue validando igual (progressive enhancement).
        "contact-form": {
          id: "contact-form",
          type: "form",
          props: { action: "", method: "post", noValidate: false },
          style: defaultStyleFor("form"),
          behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
          children: [
            "contact-field-name",
            "contact-field-email",
            "contact-field-msg",
            "contact-submit",
          ],
        },
        // Campo nombre: label + input (agrupados en un container de layout).
        "contact-field-name": {
          id: "contact-field-name",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } },
            },
          },
          children: ["contact-label-name", "contact-input-name"],
        },
        "contact-label-name": {
          id: "contact-label-name",
          type: "label",
          props: { text: "Nombre", for: "contact-input-name" },
          style: defaultStyleFor("label"),
        },
        "contact-input-name": {
          id: "contact-input-name",
          type: "input",
          props: { name: "nombre", type: "text", placeholder: "Tu nombre", required: true, disabled: false },
          style: defaultStyleFor("input"),
        },
        // Campo email: label + input type=email.
        "contact-field-email": {
          id: "contact-field-email",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } },
            },
          },
          children: ["contact-label-email", "contact-input-email"],
        },
        "contact-label-email": {
          id: "contact-label-email",
          type: "label",
          props: { text: "Email", for: "contact-input-email" },
          style: defaultStyleFor("label"),
        },
        "contact-input-email": {
          id: "contact-input-email",
          type: "input",
          props: { name: "email", type: "email", placeholder: "tu@email.com", required: true, disabled: false },
          style: defaultStyleFor("input"),
        },
        // Campo mensaje: label + textarea.
        "contact-field-msg": {
          id: "contact-field-msg",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } },
            },
          },
          children: ["contact-label-msg", "contact-textarea-msg"],
        },
        "contact-label-msg": {
          id: "contact-label-msg",
          type: "label",
          props: { text: "Mensaje", for: "contact-textarea-msg" },
          style: defaultStyleFor("label"),
        },
        "contact-textarea-msg": {
          id: "contact-textarea-msg",
          type: "textarea",
          props: { name: "mensaje", placeholder: "Escribe tu mensaje…", rows: 5, required: true, disabled: false },
          style: defaultStyleFor("textarea"),
        },
        // Botón de envío — estilo de fábrica de `button-submit`.
        "contact-submit": {
          id: "contact-submit",
          type: "button-submit",
          props: { label: "Enviar mensaje", disabled: false },
          style: defaultStyleFor("button-submit"),
        },
      },
    },
  );
}
