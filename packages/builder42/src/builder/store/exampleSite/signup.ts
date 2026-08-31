import type { BuilderPage, PageId } from "../../model/types";
import { createPage } from "../../model/site";
import { defaultStyleFor } from "./styleFor";

/**
 * Página "Registro": escaparate del behavior `form-validation` (Fase 10b,
 * docs/15 §2b, docs/16 §10b) con un formulario más rico que el de
 * `contact.ts` — varios tipos de regla de validez HTML5 nativa a la vez
 * (`required`, `type="email"`, `type="tel"` con `pattern`, `minlength` vía
 * `textarea`) para poder verificar en Preview que Alpine hidrata cada campo
 * de forma independiente: mensaje inline en blur, submit deshabilitado
 * mientras algún campo tocado siga inválido.
 *
 * Usa exclusivamente BASE_TOKENS (funciona con cualquier tema de la galería,
 * igual que el resto del sitio de ejemplo).
 */
export function createSignupPage(homePageId: PageId): BuilderPage {
  return createPage(
    { title: "Registro", slug: "registro" },
    {
      rootId: "signup-root",
      meta: { version: 1 },
      nodes: {
        "signup-root": {
          id: "signup-root",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
              appearance: { background: { token: "colors.surface.alt" } },
            },
          },
          children: ["signup-wrap"],
        },
        "signup-wrap": {
          id: "signup-wrap",
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
          children: ["signup-navbar", "signup-section"],
        },
        "signup-navbar": {
          id: "signup-navbar",
          type: "navbar",
          props: { brand: "Builder42", hiddenPageIds: [] },
          style: defaultStyleFor("navbar"),
          behaviors: [{ type: "navbar", options: { duration: 240 } }],
        },
        "signup-section": {
          id: "signup-section",
          type: "section",
          props: {},
          style: defaultStyleFor("section"),
          children: ["signup-heading", "signup-intro", "signup-card", "signup-footer-link"],
        },
        "signup-heading": {
          id: "signup-heading",
          type: "text",
          props: { content: "<strong>Crea tu cuenta</strong>" },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "signup-intro": {
          id: "signup-intro",
          type: "text",
          props: {
            content:
              "Formulario de prueba del behavior <em>Validación en tiempo real (Alpine)</em>: sal de un campo (blur) sin completarlo o con un email inválido para ver el mensaje de error. El botón «Crear cuenta» se deshabilita mientras algún campo tocado siga inválido.",
          },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "signup-card": {
          id: "signup-card",
          type: "card",
          props: {},
          style: defaultStyleFor("card"),
          children: ["signup-form"],
        },
        // form — behavior `form-validation` activo con validateOn:"blur"
        // (default UX: no interrumpe mientras el usuario escribe).
        "signup-form": {
          id: "signup-form",
          type: "form",
          props: { action: "", method: "post", noValidate: false },
          style: defaultStyleFor("form"),
          behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
          children: [
            "signup-field-fullname",
            "signup-field-email",
            "signup-field-phone",
            "signup-field-plan",
            "signup-field-bio",
            "signup-submit",
          ],
        },
        // Campo nombre completo — required simple.
        "signup-field-fullname": {
          id: "signup-field-fullname",
          type: "container",
          props: {},
          style: {
            base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } },
          },
          children: ["signup-label-fullname", "signup-input-fullname"],
        },
        "signup-label-fullname": {
          id: "signup-label-fullname",
          type: "label",
          props: { text: "Nombre completo", for: "signup-input-fullname" },
          style: defaultStyleFor("label"),
        },
        "signup-input-fullname": {
          id: "signup-input-fullname",
          type: "input",
          props: {
            name: "fullname",
            type: "text",
            placeholder: "Ada Lovelace",
            required: true,
            disabled: false,
          },
          style: defaultStyleFor("input"),
        },
        // Campo email — required + type=email (dispara el mensaje de email).
        "signup-field-email": {
          id: "signup-field-email",
          type: "container",
          props: {},
          style: {
            base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } },
          },
          children: ["signup-label-email", "signup-input-email"],
        },
        "signup-label-email": {
          id: "signup-label-email",
          type: "label",
          props: { text: "Email", for: "signup-input-email" },
          style: defaultStyleFor("label"),
        },
        "signup-input-email": {
          id: "signup-input-email",
          type: "input",
          props: {
            name: "email",
            type: "email",
            placeholder: "ada@ejemplo.com",
            required: true,
            disabled: false,
          },
          style: defaultStyleFor("input"),
        },
        // Campo teléfono — type=tel + required. (docs/16 §10.1: `input` no
        // expone `pattern` en su `propsSchema` hoy; el mensaje mostrado aquí
        // es el de "campo requerido", igual que el resto de required simples,
        // pero deja evidenciado con qué tipo de input funciona — extender
        // `input` con `pattern`/`minlength`/`maxlength` queda fuera de este
        // demo, ver docs/16 §10.1 si se prioriza).
        "signup-field-phone": {
          id: "signup-field-phone",
          type: "container",
          props: {},
          style: {
            base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } },
          },
          children: ["signup-label-phone", "signup-input-phone"],
        },
        "signup-label-phone": {
          id: "signup-label-phone",
          type: "label",
          props: { text: "Teléfono", for: "signup-input-phone" },
          style: defaultStyleFor("label"),
        },
        "signup-input-phone": {
          id: "signup-input-phone",
          type: "input",
          props: {
            name: "phone",
            type: "tel",
            placeholder: "5512345678",
            required: true,
            disabled: false,
          },
          style: defaultStyleFor("input"),
        },
        // Select de plan — sin validación en tiempo real (fuera del alcance
        // MVP de docs/16 §10b: el `select` custom no expone `checkValidity()`
        // nativo). Se incluye para mostrar que convive sin romper el resto
        // del form; su envío sigue siendo nativo (name="plan").
        "signup-field-plan": {
          id: "signup-field-plan",
          type: "container",
          props: {},
          style: {
            base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } },
          },
          children: ["signup-label-plan", "signup-select-plan"],
        },
        "signup-label-plan": {
          id: "signup-label-plan",
          type: "label",
          props: { text: "Plan", for: "signup-select-plan" },
          style: defaultStyleFor("label"),
        },
        "signup-select-plan": {
          id: "signup-select-plan",
          type: "select",
          props: {
            name: "plan",
            placeholder: "Elige un plan…",
            ariaLabel: "Plan",
            options: [
              { label: "Gratis", value: "free" },
              { label: "Pro", value: "pro" },
              { label: "Empresarial", value: "enterprise" },
            ],
          },
          style: defaultStyleFor("select"),
        },
        // Bio — textarea required (demuestra `valueMissing` en un <textarea>,
        // no solo en <input>, ver `messageFor`/`isValidatable`).
        "signup-field-bio": {
          id: "signup-field-bio",
          type: "container",
          props: {},
          style: {
            base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } },
          },
          children: ["signup-label-bio", "signup-textarea-bio"],
        },
        "signup-label-bio": {
          id: "signup-label-bio",
          type: "label",
          props: { text: "Cuéntanos sobre ti", for: "signup-textarea-bio" },
          style: defaultStyleFor("label"),
        },
        "signup-textarea-bio": {
          id: "signup-textarea-bio",
          type: "textarea",
          props: {
            name: "bio",
            placeholder: "Un par de líneas…",
            rows: 4,
            required: true,
            disabled: false,
          },
          style: defaultStyleFor("textarea"),
        },
        "signup-submit": {
          id: "signup-submit",
          type: "button-submit",
          props: { label: "Crear cuenta", disabled: false },
          style: defaultStyleFor("button-submit"),
        },
        "signup-footer-link": {
          id: "signup-footer-link",
          type: "button",
          props: { label: "Volver al inicio", link: { kind: "internal", pageId: homePageId } },
          style: { base: { layout: { display: "inline-block" }, spacing: { margin: "0 auto" } } },
        },
      },
    },
  );
}
