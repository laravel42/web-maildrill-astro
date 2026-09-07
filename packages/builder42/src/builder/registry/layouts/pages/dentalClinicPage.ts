import type { NodeFragment } from "../../../model/tree";
import type { NodeTranslations } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { NAVBAR_BRAND_STYLE } from "../../components/Navbar";
import { darkBandStyleFor, testimonialFragment } from "../helpers";

/**
 * Página "Clínica dental" — plantilla de negocio real (encargo del
 * orquestador de plantillas multilingües): topbar con teléfono de urgencias +
 * `language-nav`, navbar, hero con `badge` de seguros, tratamientos en pares
 * media/copy que alternan lado (`icon` + `text`), equipo (`avatar`), `alert`
 * de citas urgentes, testimonio de paciente, FAQ en `accordion`, formulario
 * de cita (`form` + `select` + `textarea`) y footer con dirección/horarios +
 * redes.
 *
 * Arquetipo A2 — Split zig-zag (docs/48 §2, re-tematizado en F2): cada
 * tratamiento es un par imagen/copy al 50/50 que alterna de lado sección a
 * sección (imagen-izq en el 1º y 3º, imagen-der en el 2º vía orden de hijos
 * — el modelo no tiene `flexDirection: row-reverse`, solo `row`/`column`),
 * reemplazando el grid de 3 tarjetas iguales. Tema "Cuidado" (blanco/cian,
 * tipografía Nunito Sans).
 *
 * Lenguaje visual (docs/43): la raíz es FULL-BLEED (sin `maxWidth`); cada
 * banda declara su propio fondo (claro → alt → acento con degradado → claro
 * → alt → oscuro) y envuelve su contenido en un `inner` centrado
 * (`maxWidth: sizes.container`, `margin: 0 auto`). Tipografía fluida con
 * `clamp()` en hero/títulos de sección, tarjetas de equipo con sombra + hover,
 * grids mobile-first que escalan en `md`/`lg`. Todos los ids llevan el
 * prefijo `dental-`; componentes especializados (`navbar`, `badge`,
 * `avatar`, `alert`, `accordion`, `form`, `select`, `textarea`…) siguen
 * usando `defaultStyleFor`. Copy comercial neutro (sin afirmaciones médicas
 * concretas), sin cambios respecto a la versión anterior.
 */
export function buildDentalClinicPageFragment(): NodeFragment {
  const fragment: NodeFragment = {
    rootId: "dental-root",
    nodes: {
      // --- Raíz full-bleed (docs/43 §1): SIN maxWidth ------------------------
      "dental-root": {
        id: "dental-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0px" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: [
          "dental-topbar",
          "dental-navbar",
          "dental-hero",
          "dental-treatments",
          "dental-alert-section",
          "dental-team",
          "dental-testimonial-section",
          "dental-faq",
          "dental-appointment",
          "dental-footer",
        ],
      },

      // --- Topbar: teléfono de urgencias + language-nav ---------------------
      "dental-topbar": {
        id: "dental-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "8px 20px" },
            size: { width: "100%" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.muted" }, background: { token: "colors.surface.alt" } },
          },
        },
        children: ["dental-topbar-phone", "dental-topbar-lang"],
      },
      "dental-topbar-phone": {
        id: "dental-topbar-phone",
        type: "text",
        props: { content: "Urgencias 24h: +52 33 1122 3344" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-topbar-lang": {
        id: "dental-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
        style: defaultStyleFor("language-nav"),
      },

      // --- Navbar -------------------------------------------------------------
      "dental-navbar": {
        id: "dental-navbar",
        type: "navbar",
        props: { hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
        children: ["dental-navbar-brand-container"],
      },
      "dental-navbar-brand-container": {
        id: "dental-navbar-brand-container",
        type: "container",
        props: {},
        style: NAVBAR_BRAND_STYLE,
        children: ["dental-navbar-brand"],
      },
      "dental-navbar-brand": {
        id: "dental-navbar-brand",
        type: "text",
        props: { content: "<strong>Clínica Dental Sonrisa Plena</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },

      // --- Hero con badge de seguros — scrim + foto, titular fluido -------------
      "dental-hero": {
        id: "dental-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "16px" },
            spacing: { padding: "56px 20px" },
            size: { width: "100%", minHeight: "420px" },
            typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(15,23,42,0.40)), url('https://images.unsplash.com/photo-1762625570087-6d98fca29531?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { spacing: { padding: "112px 20px" } } },
        },
        children: ["dental-hero-badge", "dental-hero-title", "dental-hero-sub", "dental-hero-cta"],
      },
      "dental-hero-badge": {
        id: "dental-hero-badge",
        type: "badge",
        props: { label: "Aceptamos seguros" },
        style: defaultStyleFor("badge"),
      },
      "dental-hero-title": {
        id: "dental-hero-title",
        type: "text",
        props: { content: "<strong>Cuidado dental cercano para toda la familia</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.05",
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "dental-hero-sub": {
        id: "dental-hero-sub",
        type: "text",
        props: {
          content: "Consultorio moderno, equipo cálido y planes de tratamiento claros, con opciones para pagar con tu seguro dental.",
        },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
              lineHeight: { token: "typography.lineHeights.normal" },
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "dental-hero-cta": {
        id: "dental-hero-cta",
        type: "button",
        props: { label: "Agendar mi cita", link: { kind: "anchor", nodeId: "dental-appointment" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(15,23,42,0.28)",
            },
          },
          states: {
            hover: {
              appearance: { boxShadow: "0 16px 40px rgba(15,23,42,0.36)" },
            },
          },
        },
      },

      // --- Grid de tratamientos (card + icon + text) — banda alt ----------------
      "dental-treatments": {
        id: "dental-treatments",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["dental-treatments-inner"],
      },
      "dental-treatments-inner": {
        id: "dental-treatments-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "clamp(24px, 4vw, 40px)" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
        },
        children: ["dental-treatments-title", "dental-treatments-list"],
      },
      "dental-treatments-title": {
        id: "dental-treatments-title",
        type: "text",
        props: { content: "<strong>Nuestros tratamientos</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      // Arquetipo A2 (docs/48 §2) — Split zig-zag: pares media/copy 50/50 que
      // alternan lado por sección. Base: 1 columna (imagen sobre texto);
      // desde `md` cada par pasa a 2 columnas, alternando qué hijo va primero
      // (imagen-izq/copy-der en el 1º y 3º par, copy-izq/imagen-der en el 2º)
      // mediante `flexDirection: row-reverse` en el par impar.
      "dental-treatments-list": {
        id: "dental-treatments-list",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "clamp(32px, 5vw, 56px)" } },
        },
        children: ["dental-treatment-1", "dental-treatment-2", "dental-treatment-3"],
      },
      "dental-treatment-1": {
        id: "dental-treatment-1",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "clamp(20px, 3vw, 32px)", alignItems: "center" },
          },
          overrides: { md: { layout: { flexDirection: "row" } } },
        },
        children: ["dental-treatment-1-media", "dental-treatment-1-copy"],
      },
      "dental-treatment-1-media": {
        id: "dental-treatment-1-media",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80&auto=format&fit=crop" },
          alt: "Higienista dental realizando una limpieza",
          objectFit: "cover",
          loading: "lazy",
        },
        style: {
          base: {
            size: { width: "100%", height: "240px" },
            appearance: { borderRadius: "18px", boxShadow: "0 12px 32px rgba(15,23,42,0.1)" },
          },
          overrides: { md: { size: { width: "50%", height: "300px" } }, lg: { size: { height: "340px" } } },
        },
      },
      "dental-treatment-1-copy": {
        id: "dental-treatment-1-copy",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "12px" }, size: { width: "100%" } },
          overrides: { md: { size: { width: "50%" } } },
        },
        children: ["dental-treatment-1-icon", "dental-treatment-1-title", "dental-treatment-1-text"],
      },
      "dental-treatment-1-icon": {
        id: "dental-treatment-1-icon",
        type: "icon",
        props: { name: "Sparkles", pressedName: "", title: "Limpieza dental" },
        style: defaultStyleFor("icon"),
      },
      "dental-treatment-1-title": {
        id: "dental-treatment-1-title",
        type: "text",
        props: { content: "<strong>Limpieza y prevención</strong>" },
        style: {
          base: {
            typography: { fontSize: "1.25rem", lineHeight: "1.3", fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "dental-treatment-1-text": {
        id: "dental-treatment-1-text",
        type: "text",
        props: { content: "Revisión y limpieza profesional para mantener tu salud bucal al día." },
        style: { base: { size: { maxWidth: "60ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-treatment-2": {
        id: "dental-treatment-2",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "clamp(20px, 3vw, 32px)", alignItems: "center" },
          },
          overrides: { md: { layout: { flexDirection: "row" } } },
        },
        // Par impar (2º): alterna lado — el copy va primero en el orden de
        // hijos (izquierda en `flexDirection: row`), la imagen después
        // (derecha). El modelo no tiene `flexDirection: row-reverse`
        // (`layout.flexDirection` solo admite `row`/`column`), así que la
        // alternancia de lado se logra reordenando los hijos, no invirtiendo
        // el eje.
        children: ["dental-treatment-2-copy", "dental-treatment-2-media"],
      },
      "dental-treatment-2-media": {
        id: "dental-treatment-2-media",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1601000937443-8dab7e3a3cf7?w=800&q=80&auto=format&fit=crop" },
          alt: "Alineadores dentales transparentes",
          objectFit: "cover",
          loading: "lazy",
        },
        style: {
          base: {
            size: { width: "100%", height: "240px" },
            appearance: { borderRadius: "18px", boxShadow: "0 12px 32px rgba(15,23,42,0.1)" },
          },
          overrides: { md: { size: { width: "50%", height: "300px" } }, lg: { size: { height: "340px" } } },
        },
      },
      "dental-treatment-2-copy": {
        id: "dental-treatment-2-copy",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "12px" }, size: { width: "100%" } },
          overrides: { md: { size: { width: "50%" } } },
        },
        children: ["dental-treatment-2-icon", "dental-treatment-2-title", "dental-treatment-2-text"],
      },
      "dental-treatment-2-icon": {
        id: "dental-treatment-2-icon",
        type: "icon",
        props: { name: "Smile", pressedName: "", title: "Ortodoncia" },
        style: defaultStyleFor("icon"),
      },
      "dental-treatment-2-title": {
        id: "dental-treatment-2-title",
        type: "text",
        props: { content: "<strong>Ortodoncia</strong>" },
        style: {
          base: {
            typography: { fontSize: "1.25rem", lineHeight: "1.3", fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "dental-treatment-2-text": {
        id: "dental-treatment-2-text",
        type: "text",
        props: { content: "Brackets tradicionales y alineadores transparentes, con plan de pago a tu medida." },
        style: { base: { size: { maxWidth: "60ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-treatment-3": {
        id: "dental-treatment-3",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "clamp(20px, 3vw, 32px)", alignItems: "center" },
          },
          overrides: { md: { layout: { flexDirection: "row" } } },
        },
        children: ["dental-treatment-3-media", "dental-treatment-3-copy"],
      },
      "dental-treatment-3-media": {
        id: "dental-treatment-3-media",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1588776814546-ec7e5d5b7d19?w=800&q=80&auto=format&fit=crop" },
          alt: "Niña sonriendo en el consultorio dental",
          objectFit: "cover",
          loading: "lazy",
        },
        style: {
          base: {
            size: { width: "100%", height: "240px" },
            appearance: { borderRadius: "18px", boxShadow: "0 12px 32px rgba(15,23,42,0.1)" },
          },
          overrides: { md: { size: { width: "50%", height: "300px" } }, lg: { size: { height: "340px" } } },
        },
      },
      "dental-treatment-3-copy": {
        id: "dental-treatment-3-copy",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "12px" }, size: { width: "100%" } },
          overrides: { md: { size: { width: "50%" } } },
        },
        children: ["dental-treatment-3-icon", "dental-treatment-3-title", "dental-treatment-3-text"],
      },
      "dental-treatment-3-icon": {
        id: "dental-treatment-3-icon",
        type: "icon",
        props: { name: "Baby", pressedName: "", title: "Odontopediatría" },
        style: defaultStyleFor("icon"),
      },
      "dental-treatment-3-title": {
        id: "dental-treatment-3-title",
        type: "text",
        props: { content: "<strong>Odontopediatría</strong>" },
        style: {
          base: {
            typography: { fontSize: "1.25rem", lineHeight: "1.3", fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "dental-treatment-3-text": {
        id: "dental-treatment-3-text",
        type: "text",
        props: { content: "Atención pensada para los más pequeños, en un ambiente relajado y amigable." },
        style: { base: { size: { maxWidth: "60ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Alerta informativa — banda con degradado de acento --------------------
      "dental-alert-section": {
        id: "dental-alert-section",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "40px 20px", margin: "0" },
            appearance: { background: "linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))" },
          },
          overrides: { md: { spacing: { padding: "56px 20px" } } },
        },
        children: ["dental-alert-inner"],
      },
      "dental-alert-inner": {
        id: "dental-alert-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
        },
        children: ["dental-alert"],
      },
      "dental-alert": {
        id: "dental-alert",
        type: "alert",
        props: {
          message: "¿Necesitas una cita de urgencia? Atendemos casos el mismo día sujeto a disponibilidad, llamando antes de venir.",
          variant: "info",
          showIcon: true,
        },
        style: {
          base: {
            ...defaultStyleFor("alert").base,
            appearance: {
              ...defaultStyleFor("alert").base.appearance,
              background: { token: "colors.surface.default" },
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
            },
          },
        },
      },

      // --- Equipo (avatar + nombre + especialidad) — banda clara ------------------
      "dental-team": {
        id: "dental-team",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["dental-team-inner"],
      },
      "dental-team-inner": {
        id: "dental-team-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "clamp(24px, 4vw, 40px)" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
        },
        children: ["dental-team-title", "dental-team-grid"],
      },
      "dental-team-title": {
        id: "dental-team-title",
        type: "text",
        props: { content: "<strong>Conoce a nuestro equipo</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "dental-team-grid": {
        id: "dental-team-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } } },
        },
        children: ["dental-team-member-1", "dental-team-member-2", "dental-team-member-3"],
      },
      "dental-team-member-1": {
        id: "dental-team-member-1",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" },
            spacing: { padding: "20px" },
            size: { minHeight: "64px", width: "100%" },
            typography: { textAlign: "center" },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
          states: { hover: { appearance: { boxShadow: "0 18px 44px rgba(15,23,42,0.16)" } } },
        },
        children: ["dental-team-member-1-avatar", "dental-team-member-1-name", "dental-team-member-1-role"],
      },
      "dental-team-member-1-avatar": {
        id: "dental-team-member-1-avatar",
        type: "avatar",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80&auto=format&fit=crop" }, alt: "Retrato de la Dra. Camila Reyes", initials: "CR" },
        style: defaultStyleFor("avatar"),
      },
      "dental-team-member-1-name": {
        id: "dental-team-member-1-name",
        type: "text",
        props: { content: "<strong>Dra. Camila Reyes</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "dental-team-member-1-role": {
        id: "dental-team-member-1-role",
        type: "text",
        props: { content: "Directora clínica y odontología general" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-team-member-2": {
        id: "dental-team-member-2",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" },
            spacing: { padding: "20px" },
            size: { minHeight: "64px", width: "100%" },
            typography: { textAlign: "center" },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
          states: { hover: { appearance: { boxShadow: "0 18px 44px rgba(15,23,42,0.16)" } } },
        },
        children: ["dental-team-member-2-avatar", "dental-team-member-2-name", "dental-team-member-2-role"],
      },
      "dental-team-member-2-avatar": {
        id: "dental-team-member-2-avatar",
        type: "avatar",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1622253694238-3b22139576c6?w=200&q=80&auto=format&fit=crop" }, alt: "Retrato del Dr. Andrés Molina", initials: "AM" },
        style: defaultStyleFor("avatar"),
      },
      "dental-team-member-2-name": {
        id: "dental-team-member-2-name",
        type: "text",
        props: { content: "<strong>Dr. Andrés Molina</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "dental-team-member-2-role": {
        id: "dental-team-member-2-role",
        type: "text",
        props: { content: "Ortodoncia" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-team-member-3": {
        id: "dental-team-member-3",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" },
            spacing: { padding: "20px" },
            size: { minHeight: "64px", width: "100%" },
            typography: { textAlign: "center" },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
          states: { hover: { appearance: { boxShadow: "0 18px 44px rgba(15,23,42,0.16)" } } },
        },
        children: ["dental-team-member-3-avatar", "dental-team-member-3-name", "dental-team-member-3-role"],
      },
      "dental-team-member-3-avatar": {
        id: "dental-team-member-3-avatar",
        type: "avatar",
        props: { source: { kind: "url", url: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&q=80&auto=format&fit=crop" }, alt: "Retrato de la Dra. Sofía Liévano", initials: "SL" },
        style: defaultStyleFor("avatar"),
      },
      "dental-team-member-3-name": {
        id: "dental-team-member-3-name",
        type: "text",
        props: { content: "<strong>Dra. Sofía Liévano</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "dental-team-member-3-role": {
        id: "dental-team-member-3-role",
        type: "text",
        props: { content: "Odontopediatría" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Testimonio de paciente — banda alt -------------------------------------
      "dental-testimonial-section": {
        id: "dental-testimonial-section",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["dental-testimonial-inner"],
      },
      "dental-testimonial-inner": {
        id: "dental-testimonial-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
        },
        children: ["dental-testimonial"],
      },
      ...testimonialFragment(
        "dental-testimonial",
        {
          quote:
            "Le tenía mucho miedo al dentista, pero en Sonrisa Plena me explicaron cada paso y nunca me sentí presionada. Ahora vengo a mis revisiones sin ansiedad.",
          name: "Lorena Castillo",
          role: "Paciente desde 2023",
          initials: "LC",
        },
        defaultStyleFor("testimonial"),
      ),

      // --- FAQ (accordion) — banda clara ------------------------------------------
      "dental-faq": {
        id: "dental-faq",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["dental-faq-inner"],
      },
      "dental-faq-inner": {
        id: "dental-faq-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "clamp(24px, 4vw, 40px)" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
        },
        children: ["dental-faq-title", "dental-accordion"],
      },
      "dental-faq-title": {
        id: "dental-faq-title",
        type: "text",
        props: { content: "<strong>Preguntas frecuentes</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "dental-accordion": {
        id: "dental-accordion",
        type: "accordion",
        props: {},
        style: defaultStyleFor("accordion"),
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["dental-faq-item-1", "dental-faq-item-2", "dental-faq-item-3", "dental-faq-item-4"],
      },
      "dental-faq-item-1": {
        id: "dental-faq-item-1",
        type: "accordion-item",
        props: { label: "¿Cuánto cuesta una primera valoración?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["dental-faq-item-1-body"],
      },
      "dental-faq-item-1-body": {
        id: "dental-faq-item-1-body",
        type: "text",
        props: { content: "La primera valoración tiene un costo de $450 MXN, e incluye revisión general y radiografía si es necesaria. El monto se descuenta si continúas con el tratamiento." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-faq-item-2": {
        id: "dental-faq-item-2",
        type: "accordion-item",
        props: { label: "¿Trabajan con aseguradoras?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["dental-faq-item-2-body"],
      },
      "dental-faq-item-2-body": {
        id: "dental-faq-item-2-body",
        type: "text",
        props: { content: "Sí, trabajamos con las principales aseguradoras del país. Trae tu póliza a la primera cita y verificamos tu cobertura sin costo." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-faq-item-3": {
        id: "dental-faq-item-3",
        type: "accordion-item",
        props: { label: "¿Qué debo esperar en mi primera visita?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["dental-faq-item-3-body"],
      },
      "dental-faq-item-3-body": {
        id: "dental-faq-item-3-body",
        type: "text",
        props: { content: "Una revisión completa, una charla sobre tus necesidades y un plan de tratamiento claro con opciones y tiempos antes de decidir." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "dental-faq-item-4": {
        id: "dental-faq-item-4",
        type: "accordion-item",
        props: { label: "¿Atienden a niños?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["dental-faq-item-4-body"],
      },
      "dental-faq-item-4-body": {
        id: "dental-faq-item-4-body",
        type: "text",
        props: { content: "Sí, contamos con un área de odontopediatría pensada para que los niños se sientan cómodos desde su primera cita." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Formulario de cita — banda alt ------------------------------------
      "dental-appointment": {
        id: "dental-appointment",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["dental-appointment-inner"],
      },
      "dental-appointment-inner": {
        id: "dental-appointment-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(24px, 4vw, 40px)" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 320px) 1fr" } } },
        },
        children: ["dental-appointment-info", "dental-appointment-card"],
      },
      "dental-appointment-info": {
        id: "dental-appointment-info",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["dental-appointment-title", "dental-appointment-sub"],
      },
      "dental-appointment-title": {
        id: "dental-appointment-title",
        type: "text",
        props: { content: "<strong>Agenda tu cita</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.15",
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "dental-appointment-sub": {
        id: "dental-appointment-sub",
        type: "text",
        props: { content: "Cuéntanos qué necesitas y te confirmamos horario disponible por teléfono o correo." },
        style: {
          base: {
            typography: { fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "dental-appointment-card": {
        id: "dental-appointment-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" },
            spacing: { padding: "20px" },
            size: { minHeight: "64px", width: "100%" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderColor: { token: "colors.border" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        children: ["dental-form"],
      },
      "dental-form": {
        id: "dental-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: [
          "dental-field-name",
          "dental-field-email",
          "dental-field-treatment",
          "dental-field-message",
          "dental-submit",
        ],
      },
      "dental-field-name": {
        id: "dental-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["dental-label-name", "dental-input-name"],
      },
      "dental-label-name": {
        id: "dental-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "dental-input-name" },
        style: defaultStyleFor("label"),
      },
      "dental-input-name": {
        id: "dental-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre completo", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "dental-field-email": {
        id: "dental-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["dental-label-email", "dental-input-email"],
      },
      "dental-label-email": {
        id: "dental-label-email",
        type: "label",
        props: { text: "Correo electrónico", for: "dental-input-email" },
        style: defaultStyleFor("label"),
      },
      "dental-input-email": {
        id: "dental-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "tu@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "dental-field-treatment": {
        id: "dental-field-treatment",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["dental-label-treatment", "dental-select-treatment"],
      },
      "dental-label-treatment": {
        id: "dental-label-treatment",
        type: "label",
        props: { text: "Tratamiento de interés", for: "dental-select-treatment" },
        style: defaultStyleFor("label"),
      },
      "dental-select-treatment": {
        id: "dental-select-treatment",
        type: "select",
        props: {
          name: "tratamiento",
          placeholder: "Elige una opción…",
          ariaLabel: "Tratamiento de interés",
          options: [
            { label: "Limpieza y prevención", value: "limpieza" },
            { label: "Ortodoncia", value: "ortodoncia" },
            { label: "Odontopediatría", value: "odontopediatria" },
            { label: "Otro / no estoy seguro", value: "otro" },
          ],
        },
        style: defaultStyleFor("select"),
      },
      "dental-field-message": {
        id: "dental-field-message",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["dental-label-message", "dental-textarea-message"],
      },
      "dental-label-message": {
        id: "dental-label-message",
        type: "label",
        props: { text: "Cuéntanos brevemente qué necesitas", for: "dental-textarea-message" },
        style: defaultStyleFor("label"),
      },
      "dental-textarea-message": {
        id: "dental-textarea-message",
        type: "textarea",
        props: { name: "mensaje", placeholder: "Ej. Me duele una muela desde ayer…", rows: 4, required: false, disabled: false },
        style: defaultStyleFor("textarea"),
      },
      "dental-submit": {
        id: "dental-submit",
        type: "button-submit",
        props: { label: "Solicitar cita", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(15,23,42,0.2)",
            },
          },
          states: {
            hover: {
              appearance: { boxShadow: "0 16px 40px rgba(15,23,42,0.28)" },
            },
          },
        },
      },

      // --- Footer — banda oscura -------------------------------------------------
      "dental-footer": {
        id: "dental-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            size: { width: "100%" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: {
              background: { token: "colors.text" },
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { spacing: { padding: "64px 40px" } } },
        },
        children: ["dental-footer-address", "dental-footer-hours", "dental-footer-social", "dental-footer-copyright"],
      },
      "dental-footer-address": {
        id: "dental-footer-address",
        type: "text",
        props: { content: "Calle Real 88, Col. Chapalita, Guadalajara, Jalisco" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "dental-footer-hours": {
        id: "dental-footer-hours",
        type: "text",
        props: { content: "Lunes a viernes 9:00–19:00 · Sábados 9:00–14:00" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "dental-footer-social": {
        id: "dental-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "dental-footer-copyright": {
        id: "dental-footer-copyright",
        type: "text",
        props: { content: "© 2026 Clínica Dental Sonrisa Plena. Todos los derechos reservados." },
        style: {
          base: {
            size: { width: "100%" },
            spacing: { padding: "16px 0 0 0" },
            typography: { textAlign: "center", fontSize: { token: "typography.sizes.sm" } },
            appearance: {
              color: "inherit",
              borderColor: "rgba(255,255,255,0.16)",
              borderWidth: "1px 0 0 0",
              borderStyle: "solid",
            },
          },
        },
      },
    },
  };

  const translations: Record<string, NodeTranslations> = {
    "dental-topbar-phone": {
      en: { content: "24h emergencies: +52 33 1122 3344" },
      it: { content: "Urgenze 24h: +52 33 1122 3344" },
    },
    "dental-navbar-brand": {
      en: { content: "<strong>Sonrisa Plena Dental Clinic</strong>" },
      it: { content: "<strong>Clinica Dentale Sonrisa Plena</strong>" },
    },
    "dental-hero-badge": {
      en: { label: "We accept insurance" },
      it: { label: "Accettiamo assicurazioni" },
    },
    "dental-hero-title": {
      en: { content: "<strong>Dental care close to home, for the whole family</strong>" },
      it: { content: "<strong>Cure dentali vicino a te, per tutta la famiglia</strong>" },
    },
    "dental-hero-sub": {
      en: {
        content:
          "A modern office, a warm team and clear treatment plans, with options to pay through your dental insurance.",
      },
      it: {
        content:
          "Uno studio moderno, un team accogliente e piani di trattamento chiari, con opzioni di pagamento tramite la tua assicurazione dentale.",
      },
    },
    "dental-hero-cta": {
      en: { label: "Book my appointment" },
      it: { label: "Prenota il mio appuntamento" },
    },
    "dental-treatments-title": {
      en: { content: "<strong>Our treatments</strong>" },
      it: { content: "<strong>I nostri trattamenti</strong>" },
    },
    "dental-treatment-1-icon": {
      en: { title: "Dental cleaning" },
      it: { title: "Igiene dentale" },
    },
    "dental-treatment-1-media": {
      en: { alt: "Dental hygienist performing a cleaning" },
      it: { alt: "Igienista dentale durante una pulizia" },
    },
    "dental-treatment-1-title": {
      en: { content: "<strong>Cleaning & prevention</strong>" },
      it: { content: "<strong>Igiene e prevenzione</strong>" },
    },
    "dental-treatment-1-text": {
      en: { content: "Check-ups and professional cleaning to keep your oral health on track." },
      it: { content: "Controlli e igiene professionale per mantenere la tua salute orale sempre in ordine." },
    },
    "dental-treatment-2-icon": {
      en: { title: "Orthodontics" },
      it: { title: "Ortodonzia" },
    },
    "dental-treatment-2-media": {
      en: { alt: "Clear dental aligners" },
      it: { alt: "Allineatori dentali trasparenti" },
    },
    "dental-treatment-2-title": {
      en: { content: "<strong>Orthodontics</strong>" },
      it: { content: "<strong>Ortodonzia</strong>" },
    },
    "dental-treatment-2-text": {
      en: { content: "Traditional braces and clear aligners, with a payment plan that fits you." },
      it: { content: "Apparecchi tradizionali e allineatori trasparenti, con un piano di pagamento su misura." },
    },
    "dental-treatment-3-icon": {
      en: { title: "Pediatric dentistry" },
      it: { title: "Odontoiatria pediatrica" },
    },
    "dental-treatment-3-media": {
      en: { alt: "Little girl smiling at the dental office" },
      it: { alt: "Bambina che sorride nello studio dentistico" },
    },
    "dental-treatment-3-title": {
      en: { content: "<strong>Pediatric dentistry</strong>" },
      it: { content: "<strong>Odontoiatria pediatrica</strong>" },
    },
    "dental-treatment-3-text": {
      en: { content: "Care designed for little ones, in a relaxed and friendly environment." },
      it: { content: "Cure pensate per i più piccoli, in un ambiente rilassato e accogliente." },
    },
    "dental-alert": {
      en: {
        message: "Need an urgent appointment? We see same-day cases subject to availability — please call before coming in.",
      },
      it: {
        message: "Hai bisogno di una visita urgente? Riceviamo casi lo stesso giorno in base alla disponibilità: chiama prima di venire.",
      },
    },
    "dental-team-title": {
      en: { content: "<strong>Meet our team</strong>" },
      it: { content: "<strong>Conosci il nostro team</strong>" },
    },
    "dental-team-member-1-avatar": {
      en: { alt: "Portrait of Dr. Camila Reyes" },
      it: { alt: "Ritratto della Dott.ssa Camila Reyes" },
    },
    "dental-team-member-1-name": {
      en: { content: "<strong>Dr. Camila Reyes</strong>" },
      it: { content: "<strong>Dott.ssa Camila Reyes</strong>" },
    },
    "dental-team-member-1-role": {
      en: { content: "Clinical director & general dentistry" },
      it: { content: "Direttrice clinica e odontoiatria generale" },
    },
    "dental-team-member-2-avatar": {
      en: { alt: "Portrait of Dr. Andrés Molina" },
      it: { alt: "Ritratto del Dott. Andrés Molina" },
    },
    "dental-team-member-2-name": {
      en: { content: "<strong>Dr. Andrés Molina</strong>" },
      it: { content: "<strong>Dott. Andrés Molina</strong>" },
    },
    "dental-team-member-2-role": {
      en: { content: "Orthodontics" },
      it: { content: "Ortodonzia" },
    },
    "dental-team-member-3-avatar": {
      en: { alt: "Portrait of Dr. Sofía Liévano" },
      it: { alt: "Ritratto della Dott.ssa Sofía Liévano" },
    },
    "dental-team-member-3-name": {
      en: { content: "<strong>Dr. Sofía Liévano</strong>" },
      it: { content: "<strong>Dott.ssa Sofía Liévano</strong>" },
    },
    "dental-team-member-3-role": {
      en: { content: "Pediatric dentistry" },
      it: { content: "Odontoiatria pediatrica" },
    },
    "dental-testimonial": {
      en: {
        quote:
          "I used to be really afraid of the dentist, but at Sonrisa Plena they explained every step and I never felt pressured. Now I come to my check-ups without any anxiety.",
        name: "Lorena Castillo",
        role: "Patient since 2023",
      },
      it: {
        quote:
          "Avevo molta paura del dentista, ma da Sonrisa Plena mi hanno spiegato ogni passaggio e non mi sono mai sentita sotto pressione. Ora vengo ai controlli senza ansia.",
        name: "Lorena Castillo",
        role: "Paziente dal 2023",
      },
    },
    "dental-faq-title": {
      en: { content: "<strong>Frequently asked questions</strong>" },
      it: { content: "<strong>Domande frequenti</strong>" },
    },
    "dental-faq-item-1": {
      en: { label: "How much does a first assessment cost?" },
      it: { label: "Quanto costa una prima valutazione?" },
    },
    "dental-faq-item-1-body": {
      en: {
        content:
          "The first assessment costs $450 MXN, and includes a general check-up and an X-ray if needed. The amount is deducted if you continue with treatment.",
      },
      it: {
        content:
          "La prima valutazione costa $450 MXN e comprende un controllo generale e una radiografia se necessaria. L'importo viene scontato se prosegui con il trattamento.",
      },
    },
    "dental-faq-item-2": {
      en: { label: "Do you work with insurance companies?" },
      it: { label: "Lavorate con le assicurazioni?" },
    },
    "dental-faq-item-2-body": {
      en: {
        content:
          "Yes, we work with the country's main insurance providers. Bring your policy to your first visit and we'll check your coverage at no cost.",
      },
      it: {
        content:
          "Sì, collaboriamo con le principali assicurazioni del paese. Porta la tua polizza alla prima visita e verificheremo la tua copertura senza costi.",
      },
    },
    "dental-faq-item-3": {
      en: { label: "What should I expect on my first visit?" },
      it: { label: "Cosa devo aspettarmi alla prima visita?" },
    },
    "dental-faq-item-3-body": {
      en: {
        content:
          "A full check-up, a conversation about your needs, and a clear treatment plan with options and timelines before you decide.",
      },
      it: {
        content:
          "Un controllo completo, una conversazione sulle tue esigenze e un piano di trattamento chiaro con opzioni e tempistiche prima di decidere.",
      },
    },
    "dental-faq-item-4": {
      en: { label: "Do you treat children?" },
      it: { label: "Trattate anche i bambini?" },
    },
    "dental-faq-item-4-body": {
      en: {
        content: "Yes, we have a pediatric dentistry area designed to make children feel comfortable from their very first visit.",
      },
      it: {
        content: "Sì, disponiamo di un'area di odontoiatria pediatrica pensata per far sentire i bambini a proprio agio dalla prima visita.",
      },
    },
    "dental-appointment-title": {
      en: { content: "<strong>Book your appointment</strong>" },
      it: { content: "<strong>Prenota il tuo appuntamento</strong>" },
    },
    "dental-appointment-sub": {
      en: { content: "Tell us what you need and we'll confirm an available time by phone or email." },
      it: { content: "Dicci di cosa hai bisogno e ti confermeremo un orario disponibile per telefono o email." },
    },
    "dental-label-name": {
      en: { text: "Full name" },
      it: { text: "Nome completo" },
    },
    "dental-input-name": {
      en: { placeholder: "Your full name" },
      it: { placeholder: "Il tuo nome completo" },
    },
    "dental-label-email": {
      en: { text: "Email" },
      it: { text: "Email" },
    },
    "dental-input-email": {
      en: { placeholder: "you@email.com" },
      it: { placeholder: "tu@email.com" },
    },
    "dental-label-treatment": {
      en: { text: "Treatment of interest" },
      it: { text: "Trattamento di interesse" },
    },
    "dental-select-treatment": {
      en: {
        placeholder: "Choose an option…",
        ariaLabel: "Treatment of interest",
        options: [
          { label: "Cleaning & prevention", value: "limpieza" },
          { label: "Orthodontics", value: "ortodoncia" },
          { label: "Pediatric dentistry", value: "odontopediatria" },
          { label: "Other / not sure", value: "otro" },
        ],
      },
      it: {
        placeholder: "Scegli un'opzione…",
        ariaLabel: "Trattamento di interesse",
        options: [
          { label: "Igiene e prevenzione", value: "limpieza" },
          { label: "Ortodonzia", value: "ortodoncia" },
          { label: "Odontoiatria pediatrica", value: "odontopediatria" },
          { label: "Altro / non sono sicuro", value: "otro" },
        ],
      },
    },
    "dental-label-message": {
      en: { text: "Briefly tell us what you need" },
      it: { text: "Raccontaci brevemente di cosa hai bisogno" },
    },
    "dental-textarea-message": {
      en: { placeholder: "E.g. I've had a toothache since yesterday…" },
      it: { placeholder: "Es. Ho mal di denti da ieri…" },
    },
    "dental-submit": {
      en: { label: "Request appointment" },
      it: { label: "Richiedi appuntamento" },
    },
    "dental-footer-copyright": {
      en: { content: "© 2026 Sonrisa Plena Dental Clinic. All rights reserved." },
      it: { content: "© 2026 Clinica Dentale Sonrisa Plena. Tutti i diritti riservati." },
    },
    "dental-footer-address": {
      en: { content: "88 Real Street, Chapalita, Guadalajara, Jalisco" },
      it: { content: "Calle Real 88, Chapalita, Guadalajara, Jalisco" },
    },
    "dental-footer-hours": {
      en: { content: "Monday to Friday 9:00–19:00 · Saturdays 9:00–14:00" },
      it: { content: "Lunedì-venerdì 9:00–19:00 · Sabato 9:00–14:00" },
    },
  };

  fragment.translations = translations;
  return fragment;
}
