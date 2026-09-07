import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, testimonialFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Registro" — REESCRITA (docs/48 §2 fila 11, F4) como plantilla de
 * sector: academia online / captación de estudiantes ("Núcleo", academia de
 * programación y datos 100% online). Conserva su `id` ("signup-page") — un
 * sitio guardado que la referencie sigue funcionando — pero el contenido, el
 * arquetipo y el tema son enteramente nuevos.
 *
 * Arquetipo A5 (docs/48 §2) — Conversión mono-columna: secciones ESTRECHAS
 * (`maxWidth` ~640-680px) y centradas, apiladas verticalmente sin ninguna
 * banda de 2+ columnas — a diferencia de A7/A7b (aside+main) o A6 (tabs +
 * pricing en fila), aquí no hay ningún grid multicolumna: la página entera es
 * una sola columna de lectura, deliberadamente sin distracción, para llevar
 * al visitante hacia el formulario de inscripción.
 *
 * Tema "Campus" (azul/ámbar, docs/48 §2): tipografía Figtree — sans geométrica
 * y legible, común en productos educativos.
 *
 * Showcase funcional: `form-validation` (validación en tiempo real del
 * formulario de inscripción), `select` (curso de interés), `alert`
 * informativo (disponibilidad limitada de la próxima cohorte — sin lenguaje
 * de urgencia agresivo: se informa una fecha y un cupo, no una cuenta atrás
 * ni presión artificial).
 *
 * Anatomía: navbar · hero de propuesta de valor · beneficios breves ·
 * testimonios de alumnos · FAQ (`accordion`) · alert informativo de cohorte ·
 * formulario de inscripción (`form` + `select` + `form-validation`) · footer
 * oscuro.
 *
 * Todos los ids con prefijo `academy-` (sin colisión con otras plantillas).
 */

const SHADOW_CARD = "0 12px 32px rgba(15,32,64,0.10)";
const BAND_PADDING = "56px 20px";
const NARROW_MAX = "640px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, padding: string = BAND_PADDING): NodeStyle {
  return {
    base: { spacing: { padding }, appearance: { background } },
    overrides: { md: { spacing: { padding: "96px 20px" } } },
  };
}

/** A5: inner SIEMPRE angosto y centrado — ninguna banda supera `NARROW_MAX`. */
function inner(maxWidth: string = NARROW_MAX, gap = "20px"): NodeStyle {
  return {
    base: {
      layout: { display: "flex", flexDirection: "column", gap, alignItems: "center" },
      spacing: { margin: "0 auto" },
      size: { width: "100%", maxWidth },
    },
    overrides: { sm: { spacing: { padding: "0 8px" } }, md: { layout: { gap: "32px" } } },
  };
}

function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1.6rem, 4vw, 2.25rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.15",
        textAlign: "center",
      },
      appearance: { color },
    },
  };
}

function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "56ch"): NodeStyle {
  return {
    base: {
      size: { maxWidth },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
        lineHeight: { token: "typography.lineHeights.normal" },
        textAlign: "center",
      },
      appearance: { color },
    },
  };
}

function benefit(n: 1 | 2 | 3, iconName: string, title: string, text: string) {
  return {
    [`academy-benefit-${n}`]: {
      id: `academy-benefit-${n}`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" },
          size: { width: "100%" },
          spacing: { padding: "16px" },
          typography: { textAlign: "center" },
          appearance: { borderRadius: "16px" },
        },
        states: { hover: { appearance: { background: { token: "colors.surface.alt" } } } },
      },
      children: [`academy-benefit-${n}-icon`, `academy-benefit-${n}-title`, `academy-benefit-${n}-text`],
    },
    [`academy-benefit-${n}-icon`]: {
      id: `academy-benefit-${n}-icon`,
      type: "icon",
      props: { name: iconName, pressedName: "", title },
      style: {
        ...defaultStyleFor("icon"),
        base: { ...defaultStyleFor("icon").base, appearance: { color: { token: "colors.primary.default" } } },
      },
    },
    [`academy-benefit-${n}-title`]: {
      id: `academy-benefit-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: { base: { typography: { fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.text" } } } },
    },
    [`academy-benefit-${n}-text`]: {
      id: `academy-benefit-${n}-text`,
      type: "text",
      props: { content: text },
      style: { base: { size: { maxWidth: "40ch" }, typography: { textAlign: "center" }, appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

function studentTestimonial(n: 1 | 2, quote: string, name: string, role: string, initials: string) {
  return testimonialFragment(`academy-testimonial-${n}`, { quote, name, role, initials }, {
    base: {
      appearance: {
        background: { token: "colors.surface.default" },
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: { token: "colors.border" },
        borderRadius: "16px",
        boxShadow: SHADOW_CARD,
      },
      spacing: { padding: "20px" },
    },
    overrides: { md: { spacing: { padding: "28px" } } },
    states: { hover: { appearance: { boxShadow: "0 18px 40px rgba(15,32,64,0.16)" } } },
  });
}

export function buildSignupPageFragment(): NodeFragment {
  return {
    rootId: "academy-root",
    nodes: {
      "academy-root": {
        id: "academy-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "academy-navbar",
          "academy-hero",
          "academy-benefits",
          "academy-testimonials",
          "academy-faq",
          "academy-cohort-alert",
          "academy-enroll",
          "academy-footer",
        ],
      },

      // --- Navbar ----------------------------------------------------------------
      "academy-navbar": {
        id: "academy-navbar",
        type: "navbar",
        props: { brand: "Núcleo", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero de propuesta de valor — A5: angosto y centrado --------------------
      "academy-hero": {
        id: "academy-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "16px" },
            spacing: { padding: "56px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "112px 20px" } } },
        },
        children: ["academy-hero-inner"],
      },
      "academy-hero-inner": {
        id: "academy-hero-inner",
        type: "container",
        props: {},
        style: inner("560px"),
        children: ["academy-hero-badge", "academy-hero-title", "academy-hero-sub", "academy-hero-cta"],
      },
      "academy-hero-badge": {
        id: "academy-hero-badge",
        type: "badge",
        props: { label: "Próxima cohorte: 100% online" },
        style: defaultStyleFor("badge"),
      },
      "academy-hero-title": {
        id: "academy-hero-title",
        type: "text",
        props: { content: "<strong>Aprende programación y datos, desde cero hasta tu primer trabajo</strong>" },
        style: {
          base: {
            size: { maxWidth: "20ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2rem, 5.5vw, 3.25rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.08",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "academy-hero-sub": {
        id: "academy-hero-sub",
        type: "text",
        props: {
          content:
            "Cursos en vivo con mentoría personalizada, proyectos reales y una comunidad de estudiantes. Sin experiencia previa.",
        },
        style: bodyText(),
      },
      "academy-hero-cta": {
        id: "academy-hero-cta",
        type: "button",
        props: { label: "Ver plan de inscripción", link: { kind: "anchor", nodeId: "academy-enroll" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(15,32,64,0.24)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(15,32,64,0.32)" } } },
        },
      },

      // --- Beneficios breves — banda clara -----------------------------------------
      "academy-benefits": {
        id: "academy-benefits",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["academy-benefits-inner"],
      },
      "academy-benefits-inner": {
        id: "academy-benefits-inner",
        type: "container",
        props: {},
        style: inner("680px"),
        children: ["academy-benefits-grid"],
      },
      "academy-benefits-grid": {
        id: "academy-benefits-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "24px" }, size: { width: "100%" } },
          overrides: { md: { layout: { gap: "36px" } } },
        },
        children: ["academy-benefit-1", "academy-benefit-2", "academy-benefit-3"],
      },
      ...benefit(1, "Users", "Mentoría en vivo", "Sesiones semanales con instructores activos en la industria, no solo videos grabados."),
      ...benefit(2, "Briefcase", "Proyectos reales", "Construyes un portafolio real que puedes mostrar a empleadores desde el primer mes."),
      ...benefit(3, "BadgeCheck", "Bolsa de trabajo", "Acceso a nuestra red de empresas aliadas al terminar el programa."),

      // --- Testimonios de alumnos — banda alt --------------------------------------
      "academy-testimonials": {
        id: "academy-testimonials",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["academy-testimonials-inner"],
      },
      "academy-testimonials-inner": {
        id: "academy-testimonials-inner",
        type: "container",
        props: {},
        style: inner("680px"),
        children: ["academy-testimonials-title", "academy-testimonials-list"],
      },
      "academy-testimonials-title": {
        id: "academy-testimonials-title",
        type: "text",
        props: { content: "<strong>Lo que dicen nuestros egresados</strong>" },
        style: sectionTitle(),
      },
      "academy-testimonials-list": {
        id: "academy-testimonials-list",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "16px" }, size: { width: "100%" } },
          overrides: { md: { layout: { gap: "24px" } } },
        },
        children: ["academy-testimonial-1", "academy-testimonial-2"],
      },
      ...studentTestimonial(
        1,
        "Empecé sin saber nada de código. Ocho meses después tengo mi primer trabajo como desarrolladora junior. La mentoría en vivo hizo toda la diferencia.",
        "Camila Duarte",
        "Egresada, cohorte 2025-B",
        "CD",
      ),
      ...studentTestimonial(
        2,
        "Los proyectos reales me dieron un portafolio con el que pude aplicar a puestos de analista de datos sin experiencia previa formal.",
        "Bruno Sepúlveda",
        "Egresado, cohorte 2025-A",
        "BS",
      ),

      // --- FAQ — banda clara --------------------------------------------------------
      "academy-faq": {
        id: "academy-faq",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        children: ["academy-faq-inner"],
      },
      "academy-faq-inner": {
        id: "academy-faq-inner",
        type: "container",
        props: {},
        style: inner("680px"),
        children: ["academy-faq-title", "academy-accordion"],
      },
      "academy-faq-title": {
        id: "academy-faq-title",
        type: "text",
        props: { content: "<strong>Preguntas frecuentes</strong>" },
        style: sectionTitle(),
      },
      "academy-accordion": {
        id: "academy-accordion",
        type: "accordion",
        props: {},
        style: { ...defaultStyleFor("accordion"), base: { ...defaultStyleFor("accordion").base, size: { width: "100%" } } },
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["academy-faq-item-1", "academy-faq-item-2", "academy-faq-item-3"],
      },
      "academy-faq-item-1": {
        id: "academy-faq-item-1",
        type: "accordion-item",
        props: { label: "¿Necesito experiencia previa en programación?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["academy-faq-item-1-body"],
      },
      "academy-faq-item-1-body": {
        id: "academy-faq-item-1-body",
        type: "text",
        props: { content: "No. El programa está diseñado para empezar desde cero, con acompañamiento paso a paso en las primeras semanas." },
        style: { base: { size: { maxWidth: "56ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "academy-faq-item-2": {
        id: "academy-faq-item-2",
        type: "accordion-item",
        props: { label: "¿Cuánto dura el programa y cuántas horas a la semana requiere?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["academy-faq-item-2-body"],
      },
      "academy-faq-item-2-body": {
        id: "academy-faq-item-2-body",
        type: "text",
        props: { content: "8 meses, con sesiones en vivo dos veces por semana y aproximadamente 8 horas semanales de trabajo autónomo." },
        style: { base: { size: { maxWidth: "56ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "academy-faq-item-3": {
        id: "academy-faq-item-3",
        type: "accordion-item",
        props: { label: "¿Qué pasa si no puedo asistir a una sesión en vivo?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["academy-faq-item-3-body"],
      },
      "academy-faq-item-3-body": {
        id: "academy-faq-item-3-body",
        type: "text",
        props: { content: "Todas las sesiones se graban y quedan disponibles para ver a tu ritmo, sin perder el acceso a la mentoría de la semana." },
        style: { base: { size: { maxWidth: "56ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Alert informativo de cohorte — banda con degradado de acento -----------
      "academy-cohort-alert": {
        id: "academy-cohort-alert",
        type: "section",
        props: {},
        style: band("linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))", "32px 20px"),
        children: ["academy-cohort-alert-inner"],
      },
      "academy-cohort-alert-inner": {
        id: "academy-cohort-alert-inner",
        type: "container",
        props: {},
        style: inner("680px", "0px"),
        children: ["academy-alert"],
      },
      "academy-alert": {
        id: "academy-alert",
        type: "alert",
        props: {
          // Informativo, no manipulador (docs/48 F4 alcance: se comunica una
          // fecha y un cupo reales, sin cuenta atrás ni lenguaje de presión).
          message: "La próxima cohorte comienza el 3 de marzo con 30 lugares disponibles. Las sesiones en vivo son dos veces por semana.",
          variant: "info",
          showIcon: true,
        },
        style: {
          base: {
            ...defaultStyleFor("alert").base,
            size: { width: "100%" },
            appearance: {
              ...defaultStyleFor("alert").base.appearance,
              background: { token: "colors.surface.default" },
              borderRadius: "16px",
              boxShadow: SHADOW_CARD,
            },
          },
        },
      },

      // --- Formulario de inscripción — banda alt (form-validation + select) -------
      "academy-enroll": {
        id: "academy-enroll",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["academy-enroll-inner"],
      },
      "academy-enroll-inner": {
        id: "academy-enroll-inner",
        type: "container",
        props: {},
        style: inner("560px"),
        children: ["academy-enroll-title", "academy-enroll-sub", "academy-enroll-card"],
      },
      "academy-enroll-title": {
        id: "academy-enroll-title",
        type: "text",
        props: { content: "<strong>Reserva tu lugar</strong>" },
        style: sectionTitle(),
      },
      "academy-enroll-sub": {
        id: "academy-enroll-sub",
        type: "text",
        props: { content: "Completa el formulario y un asesor académico te contacta en menos de 24 horas." },
        style: bodyText(),
      },
      "academy-enroll-card": {
        id: "academy-enroll-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px" },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
              borderRadius: "16px",
              boxShadow: SHADOW_CARD,
            },
          },
        },
        children: ["academy-form"],
      },
      "academy-form": {
        id: "academy-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["academy-field-name", "academy-field-email", "academy-field-course", "academy-submit"],
      },
      "academy-field-name": {
        id: "academy-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["academy-label-name", "academy-input-name"],
      },
      "academy-label-name": {
        id: "academy-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "academy-input-name" },
        style: defaultStyleFor("label"),
      },
      "academy-input-name": {
        id: "academy-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre completo", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "academy-field-email": {
        id: "academy-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["academy-label-email", "academy-input-email"],
      },
      "academy-label-email": {
        id: "academy-label-email",
        type: "label",
        props: { text: "Correo electrónico", for: "academy-input-email" },
        style: defaultStyleFor("label"),
      },
      "academy-input-email": {
        id: "academy-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "tu@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "academy-field-course": {
        id: "academy-field-course",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["academy-label-course", "academy-select-course"],
      },
      "academy-label-course": {
        id: "academy-label-course",
        type: "label",
        props: { text: "Curso de interés", for: "academy-select-course" },
        style: defaultStyleFor("label"),
      },
      "academy-select-course": {
        id: "academy-select-course",
        type: "select",
        props: {
          name: "curso",
          placeholder: "Elige un curso…",
          ariaLabel: "Curso de interés",
          options: [
            { label: "Desarrollo web full-stack", value: "web-fullstack" },
            { label: "Análisis de datos", value: "data-analytics" },
            { label: "Ciencia de datos e IA", value: "data-science" },
            { label: "Aún no lo sé, quiero orientación", value: "orientacion" },
          ],
        },
        style: defaultStyleFor("select"),
      },
      "academy-submit": {
        id: "academy-submit",
        type: "button-submit",
        props: { label: "Enviar solicitud", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(15,32,64,0.2)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(15,32,64,0.28)" } } },
        },
      },

      // --- Footer — banda oscura ----------------------------------------------------
      "academy-footer": {
        id: "academy-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "32px 20px" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "48px 20px" } } },
        },
        children: ["academy-footer-social", "academy-footer-copyright"],
      },
      "academy-footer-social": {
        id: "academy-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "academy-footer-copyright": {
        id: "academy-footer-copyright",
        type: "text",
        props: { content: "© 2026 Núcleo Academia. Todos los derechos reservados." },
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

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["academy-hero-badge"] = { en: { label: "Next cohort: 100% online" }, it: { label: "Prossima coorte: 100% online" } };
      t["academy-hero-title"] = {
        en: { content: "<strong>Learn programming and data, from zero to your first job</strong>" },
        it: { content: "<strong>Imparare programmazione e dati, da zero al primo lavoro</strong>" },
      };
      t["academy-hero-sub"] = {
        en: {
          content: "Live courses with personalized mentorship, real projects and a student community. No prior experience needed.",
        },
        it: {
          content: "Corsi dal vivo con mentoring personalizzato, progetti reali e una community di studenti. Nessuna esperienza richiesta.",
        },
      };
      t["academy-hero-cta"] = { en: { label: "See enrollment plan" }, it: { label: "Vedi il piano di iscrizione" } };

      t["academy-benefit-1-icon"] = { en: { title: "Live mentorship" }, it: { title: "Mentoring dal vivo" } };
      t["academy-benefit-1-title"] = { en: { content: "<strong>Live mentorship</strong>" }, it: { content: "<strong>Mentoring dal vivo</strong>" } };
      t["academy-benefit-1-text"] = {
        en: { content: "Weekly sessions with instructors active in the industry, not just recorded videos." },
        it: { content: "Sessioni settimanali con istruttori attivi nel settore, non solo video registrati." },
      };
      t["academy-benefit-2-icon"] = { en: { title: "Real projects" }, it: { title: "Progetti reali" } };
      t["academy-benefit-2-title"] = { en: { content: "<strong>Real projects</strong>" }, it: { content: "<strong>Progetti reali</strong>" } };
      t["academy-benefit-2-text"] = {
        en: { content: "You build a real portfolio you can show employers from the very first month." },
        it: { content: "Costruisci un portfolio reale da mostrare ai datori di lavoro già dal primo mese." },
      };
      t["academy-benefit-3-icon"] = { en: { title: "Job placement network" }, it: { title: "Rete di collocamento" } };
      t["academy-benefit-3-title"] = { en: { content: "<strong>Job placement network</strong>" }, it: { content: "<strong>Rete di collocamento</strong>" } };
      t["academy-benefit-3-text"] = {
        en: { content: "Access to our network of partner companies once you complete the program." },
        it: { content: "Accesso alla nostra rete di aziende partner al termine del programma." },
      };

      t["academy-testimonials-title"] = { en: { content: "<strong>What our graduates say</strong>" }, it: { content: "<strong>Cosa dicono i nostri diplomati</strong>" } };
      t["academy-testimonial-1-quote"] = {
        en: {
          content:
            "<p>I started knowing nothing about code. Eight months later I have my first job as a junior developer. The live mentorship made all the difference.</p>",
        },
        it: {
          content:
            "<p>Ho iniziato senza sapere nulla di codice. Otto mesi dopo ho il mio primo lavoro come sviluppatrice junior. Il mentoring dal vivo ha fatto la differenza.</p>",
        },
      };
      t["academy-testimonial-1-name"] = {
        en: { content: "<strong>Camila Duarte</strong>" },
        it: { content: "<strong>Camila Duarte</strong>" },
      };
      t["academy-testimonial-1-role"] = {
        en: { content: "Graduate, 2025-B cohort" },
        it: { content: "Diplomata, coorte 2025-B" },
      };
      t["academy-testimonial-2-quote"] = {
        en: {
          content:
            "<p>The real projects gave me a portfolio I could use to apply for data analyst roles without prior formal experience.</p>",
        },
        it: {
          content:
            "<p>I progetti reali mi hanno dato un portfolio con cui candidarmi per ruoli di data analyst senza esperienza formale precedente.</p>",
        },
      };
      t["academy-testimonial-2-name"] = {
        en: { content: "<strong>Bruno Sepúlveda</strong>" },
        it: { content: "<strong>Bruno Sepúlveda</strong>" },
      };
      t["academy-testimonial-2-role"] = {
        en: { content: "Graduate, 2025-A cohort" },
        it: { content: "Diplomato, coorte 2025-A" },
      };

      t["academy-faq-title"] = { en: { content: "<strong>Frequently asked questions</strong>" }, it: { content: "<strong>Domande frequenti</strong>" } };
      t["academy-faq-item-1"] = { en: { label: "Do I need prior programming experience?" }, it: { label: "Serve esperienza di programmazione precedente?" } };
      t["academy-faq-item-1-body"] = {
        en: { content: "No. The program is designed to start from zero, with step-by-step support in the first weeks." },
        it: { content: "No. Il programma è pensato per iniziare da zero, con supporto passo dopo passo nelle prime settimane." },
      };
      t["academy-faq-item-2"] = { en: { label: "How long is the program and how many hours per week does it require?" }, it: { label: "Quanto dura il programma e quante ore a settimana richiede?" } };
      t["academy-faq-item-2-body"] = {
        en: { content: "8 months, with live sessions twice a week and about 8 hours per week of independent work." },
        it: { content: "8 mesi, con sessioni dal vivo due volte a settimana e circa 8 ore a settimana di lavoro autonomo." },
      };
      t["academy-faq-item-3"] = { en: { label: "What happens if I can't attend a live session?" }, it: { label: "Cosa succede se non posso partecipare a una sessione dal vivo?" } };
      t["academy-faq-item-3-body"] = {
        en: { content: "All sessions are recorded and available to watch at your own pace, without losing access to that week's mentorship." },
        it: { content: "Tutte le sessioni sono registrate e disponibili da guardare al proprio ritmo, senza perdere l'accesso al mentoring della settimana." },
      };

      t["academy-alert"] = {
        en: { message: "The next cohort starts on March 3rd with 30 seats available. Live sessions are held twice a week." },
        it: { message: "La prossima coorte inizia il 3 marzo con 30 posti disponibili. Le sessioni dal vivo si tengono due volte a settimana." },
      };

      t["academy-enroll-title"] = { en: { content: "<strong>Reserve your spot</strong>" }, it: { content: "<strong>Prenota il tuo posto</strong>" } };
      t["academy-enroll-sub"] = {
        en: { content: "Fill out the form and an academic advisor will contact you within 24 hours." },
        it: { content: "Compila il modulo e un consulente accademico ti contatterà entro 24 ore." },
      };
      t["academy-label-name"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["academy-input-name"] = { en: { placeholder: "Your full name" }, it: { placeholder: "Il tuo nome completo" } };
      t["academy-label-email"] = { en: { text: "Email" }, it: { text: "Email" } };
      t["academy-input-email"] = { en: { placeholder: "you@email.com" }, it: { placeholder: "tu@email.com" } };
      t["academy-label-course"] = { en: { text: "Course of interest" }, it: { text: "Corso di interesse" } };
      t["academy-select-course"] = {
        en: {
          placeholder: "Choose a course…",
          ariaLabel: "Course of interest",
          options: [
            { label: "Full-stack web development", value: "web-fullstack" },
            { label: "Data analytics", value: "data-analytics" },
            { label: "Data science & AI", value: "data-science" },
            { label: "Not sure yet, I want guidance", value: "orientacion" },
          ],
        },
        it: {
          placeholder: "Scegli un corso…",
          ariaLabel: "Corso di interesse",
          options: [
            { label: "Sviluppo web full-stack", value: "web-fullstack" },
            { label: "Analisi dei dati", value: "data-analytics" },
            { label: "Data science e IA", value: "data-science" },
            { label: "Non sono ancora sicuro, vorrei essere guidato", value: "orientacion" },
          ],
        },
      };
      t["academy-submit"] = { en: { label: "Send application" }, it: { label: "Invia richiesta" } };

      t["academy-footer-copyright"] = {
        en: { content: "© 2026 Núcleo Academy. All rights reserved." },
        it: { content: "© 2026 Núcleo Academy. Tutti i diritti riservati." },
      };

      return t;
    })(),
  };
}

export const signupPagePageMeta: LayoutPageMeta = {
  title: "Núcleo · Academia online de programación y datos",
  description:
    "Aprende programación y datos desde cero con mentoría en vivo, proyectos reales y bolsa de trabajo. Próxima cohorte con cupo limitado.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Núcleo · Academia online de programación y datos",
      description: "Mentoría en vivo, proyectos reales y bolsa de trabajo. Reserva tu lugar en la próxima cohorte.",
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Núcleo · Academia online de programación y datos",
      description: "Mentoría en vivo, proyectos reales y bolsa de trabajo. Reserva tu lugar en la próxima cohorte.",
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Núcleo · Online academy for programming and data",
      description: "Learn programming and data from zero with live mentorship, real projects and job placement. Next cohort has limited seats.",
      seo: {
        openGraph: { title: "Núcleo · Online academy for programming and data", description: "Live mentorship, real projects and job placement. Reserve your spot in the next cohort." },
        twitter: { title: "Núcleo · Online academy for programming and data", description: "Live mentorship, real projects and job placement. Reserve your spot in the next cohort." },
      },
    },
    it: {
      title: "Núcleo · Accademia online di programmazione e dati",
      description: "Imparare programmazione e dati da zero con mentoring dal vivo, progetti reali e collocamento lavorativo. Coorte con posti limitati.",
      seo: {
        openGraph: { title: "Núcleo · Accademia online di programmazione e dati", description: "Mentoring dal vivo, progetti reali e collocamento lavorativo. Prenota il tuo posto." },
        twitter: { title: "Núcleo · Accademia online di programmazione e dati", description: "Mentoring dal vivo, progetti reali e collocamento lavorativo. Prenota il tuo posto." },
      },
    },
  },
};
