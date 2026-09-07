import type { NodeFragment } from "../../../model/tree";
import type { NodeTranslations } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, testimonialFragment } from "../helpers";

/**
 * Página "Hotel boutique" — plantilla de negocio real (una sola página,
 * multilingüe es/en/it). Topbar (check-in/check-out + `language-nav`),
 * navbar, hero con foto + CTA "Reservar", habitaciones en `carousel`
 * (Embla) — el eje estructural de la página, no una sección más — amenidades
 * en fila de iconos, galería con `lightbox` en cada foto, testimonio de
 * huésped, FAQ (`accordion`), formulario de reserva y footer con dirección
 * en banda oscura.
 *
 * Arquetipo A9 — Carrusel-céntrico (docs/48 §2, re-tematizado en F2): el
 * grid de habitaciones se reemplaza por un `container` con el behavior
 * `carousel` (Embla, `slideSize` fluido con `minWidth`/`maxWidth` de
 * respaldo para el fallback sin runtime en Edit) y cada foto de la galería
 * abre en pantalla completa con `lightbox`. Tema "Boutique" (arena/oliva,
 * tipografía Cormorant Garamond).
 *
 * Reestilizado (docs/43): bandas full-bleed con ritmo de fondos (claro / alt /
 * degradado de acento / oscuro), tipografía fluida con `clamp()`, tarjetas con
 * sombra + hover, mobile-first real. El contenido, ids, copy y traducciones
 * originales NO cambian — solo `style`, behaviors y la envoltura estructural.
 * Todos los ids con prefijo `hotel-` (sin colisión con otras plantillas).
 */
export function buildHotelBoutiquePageFragment(): NodeFragment {
  const room = (
    n: 1 | 2 | 3,
    name: string,
    desc: string,
    price: string,
    imageUrl: string,
  ) => ({
    [`hotel-room-${n}`]: {
      id: `hotel-room-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column" },
          // Slide del carousel de habitaciones (A9, docs/48 §2): ancho fluido
          // con `minWidth` para que la tarjeta siga siendo legible incluso en
          // el fallback sin runtime (flex row + overflow-x, Edit mode).
          size: { width: "85%", minWidth: "260px", maxWidth: "360px" },
          spacing: { padding: "0" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderRadius: { token: "radii.lg" },
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
          },
        },
        states: {
          hover: {
            appearance: {
              boxShadow: "0 20px 40px rgba(15,23,42,0.16)",
              borderColor: { token: "colors.primary.default" },
            },
          },
        },
      },
      children: [`hotel-room-${n}-img`, `hotel-room-${n}-body`],
    },
    [`hotel-room-${n}-img`]: {
      id: `hotel-room-${n}-img`,
      type: "image",
      props: {
        source: { kind: "url", url: imageUrl },
        alt: `Interior de ${name}`,
        objectFit: "cover",
      },
      style: {
        base: {
          size: { width: "100%", height: "220px" },
          appearance: { borderRadius: { token: "radii.lg" } },
        },
        overrides: {
          md: { size: { height: "260px" } },
        },
      },
    },
    [`hotel-room-${n}-body`]: {
      id: `hotel-room-${n}-body`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
          spacing: { padding: "16px" },
        },
        overrides: { md: { spacing: { padding: "24px" } } },
      },
      children: [`hotel-room-${n}-price`, `hotel-room-${n}-title`, `hotel-room-${n}-desc`, `hotel-room-${n}-cta`],
    },
    [`hotel-room-${n}-price`]: {
      id: `hotel-room-${n}-price`,
      type: "badge",
      props: { label: price },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "6px 12px" },
          typography: {
            fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: {
            background: { token: "colors.primary.default" },
            color: { token: "colors.surface.default" },
            borderRadius: { token: "radii.md" },
          },
        },
      },
    },
    [`hotel-room-${n}-title`]: {
      id: `hotel-room-${n}-title`,
      type: "text",
      props: { content: `<strong>${name}</strong>` },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: "1.25rem",
            lineHeight: "1.3",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`hotel-room-${n}-desc`]: {
      id: `hotel-room-${n}-desc`,
      type: "text",
      props: { content: desc },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
    [`hotel-room-${n}-cta`]: {
      id: `hotel-room-${n}-cta`,
      type: "button",
      props: { label: "Reservar", link: { kind: "anchor", nodeId: "hotel-reservation" }, newTab: false },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "14px 22px" },
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontWeight: { token: "typography.weights.bold" },
            textAlign: "center",
            textDecoration: "none",
          },
          appearance: {
            background: { token: "colors.primary.default" },
            color: { token: "colors.surface.default" },
            borderRadius: { token: "radii.md" },
            cursor: "pointer",
          },
        },
        states: {
          hover: {
            appearance: { background: { token: "colors.text" } },
          },
        },
      },
    },
  });

  const amenity = (n: 1 | 2 | 3 | 4, iconName: string, title: string) => ({
    [`hotel-amenity-${n}`]: {
      id: `hotel-amenity-${n}`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } },
          spacing: { padding: "16px" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderRadius: { token: "radii.lg" },
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
          },
        },
        overrides: { md: { spacing: { padding: "24px" } } },
        states: {
          hover: {
            appearance: { boxShadow: "0 16px 32px rgba(15,23,42,0.14)" },
          },
        },
      },
      children: [`hotel-amenity-${n}-icon`, `hotel-amenity-${n}-label`],
    },
    [`hotel-amenity-${n}-icon`]: {
      id: `hotel-amenity-${n}-icon`,
      type: "icon",
      props: { name: iconName, pressedName: "", title },
      style: {
        base: {
          size: { width: "32px", height: "32px" },
          appearance: { color: { token: "colors.primary.default" } },
        },
      },
    },
    [`hotel-amenity-${n}-label`]: {
      id: `hotel-amenity-${n}-label`,
      type: "text",
      props: { content: title },
      style: {
        base: {
          typography: { textAlign: "center" },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
  });

  const galleryImage = (n: 1 | 2 | 3 | 4, label: string, imageUrl: string) => ({
    [`hotel-gallery-${n}`]: {
      id: `hotel-gallery-${n}`,
      type: "image",
      props: {
        source: { kind: "url", url: imageUrl },
        alt: label,
        objectFit: "cover",
      },
      style: {
        base: {
          size: { width: "100%", height: "220px" },
          appearance: { borderRadius: { token: "radii.lg" }, cursor: "pointer" },
        },
        overrides: {
          md: { size: { height: "260px" } },
        },
      },
      // Arquetipo A9 (docs/48 §2): la galería de habitaciones abre en
      // pantalla completa con `lightbox` — behavior que aplica a nodos
      // `image` (docs/44).
      behaviors: [{ type: "lightbox", options: { duration: 180 } }],
    },
  });

  return {
    rootId: "hotel-root",
    nodes: {
      // Raíz full-bleed: SIN maxWidth (docs/43 §1) — cada banda pinta su propio
      // fondo hasta el borde del viewport y limita el ancho en su `inner`.
      "hotel-root": {
        id: "hotel-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
          },
        },
        children: [
          "hotel-topbar",
          "hotel-navbar",
          "hotel-hero",
          "hotel-rooms",
          "hotel-amenities",
          "hotel-gallery",
          "hotel-testimonial",
          "hotel-faq",
          "hotel-reservation",
          "hotel-footer",
        ],
      },

      // --- Topbar: check-in/check-out + language-nav ------------------------
      "hotel-topbar": {
        id: "hotel-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "10px 20px" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
        },
        children: ["hotel-topbar-hours", "hotel-topbar-lang"],
      },
      "hotel-topbar-hours": {
        id: "hotel-topbar-hours",
        type: "text",
        props: { content: "Check-in 15:00 · Check-out 12:00 · 📞 +52 998 456 7890" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "hotel-topbar-lang": {
        id: "hotel-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "icon", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
        style: {
          base: { appearance: { color: { token: "colors.muted" } } },
        },
      },

      // --- Navbar --------------------------------------------------------------
      "hotel-navbar": {
        id: "hotel-navbar",
        type: "navbar",
        props: { brand: "Hotel Casa Coral", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero con foto + CTA "Reservar" ---------------------------------------
      "hotel-hero": {
        id: "hotel-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch" },
            spacing: { padding: "0" },
            size: { width: "100%", minHeight: "420px" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.68), rgba(15,23,42,0.38)), url('https://images.unsplash.com/photo-1692153142524-60285a93c249?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
            },
          },
          overrides: {
            md: { size: { minHeight: "520px" } },
          },
        },
        children: ["hotel-hero-inner"],
      },
      "hotel-hero-inner": {
        id: "hotel-hero-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" }, alignItems: "flex-start" },
            spacing: { padding: "48px 20px" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: {
            md: { spacing: { padding: "96px 20px", margin: "0 auto" } },
          },
        },
        children: ["hotel-hero-title", "hotel-hero-sub", "hotel-hero-cta"],
      },
      "hotel-hero-title": {
        id: "hotel-hero-title",
        type: "text",
        props: { content: "<strong>Un refugio boutique frente al mar en Playa del Carmen</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              lineHeight: "1.05",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "hotel-hero-sub": {
        id: "hotel-hero-sub",
        type: "text",
        props: { content: "12 habitaciones, alberca frente al mar y desayuno incluido. A 5 minutos caminando de la Quinta Avenida." },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "hotel-hero-cta": {
        id: "hotel-hero-cta",
        type: "button",
        props: { label: "Reservar ahora", link: { kind: "anchor", nodeId: "hotel-reservation" }, newTab: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
              textDecoration: "none",
            },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.surface.default" },
              borderRadius: { token: "radii.md" },
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(15,23,42,0.24)",
            },
          },
          states: {
            hover: {
              appearance: { background: { token: "colors.text" } },
            },
          },
        },
      },

      // --- Banda: habitaciones (fondo claro) --------------------------------------
      "hotel-rooms": {
        id: "hotel-rooms",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: ["hotel-rooms-inner"],
      },
      "hotel-rooms-inner": {
        id: "hotel-rooms-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["hotel-rooms-title", "hotel-rooms-grid"],
      },
      "hotel-rooms-title": {
        id: "hotel-rooms-title",
        type: "text",
        props: { content: "<strong>Nuestras habitaciones</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.15",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      // Arquetipo A9 (docs/48 §2) — Carrusel-céntrico: el behavior `carousel`
      // (Embla) es el EJE estructural de la sección de habitaciones, no un
      // grid estático. `slideSize` fija cuánto ocupa cada tarjeta en el eje
      // de scroll; el eje cruzado (alto) sigue las alturas propias de la
      // tarjeta. Mobile-first: en base cada slide ocupa casi todo el ancho
      // (una habitación a la vez), y se ve más compacto desde `md`/`lg`.
      "hotel-rooms-grid": {
        id: "hotel-rooms-grid",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "row", gap: { token: "spacing.md" }, overflowX: "auto" },
          },
        },
        behaviors: [
          { type: "carousel", options: { orientation: "horizontal", loop: false, autoplay: false, gap: "24px", slideSize: "85%", showArrows: true } },
        ],
        children: ["hotel-room-1", "hotel-room-2", "hotel-room-3"],
      },
      ...room(
        1,
        "Habitación Coral",
        "Vista al jardín, cama queen y balcón privado.",
        "$1,850 MXN/noche",
        "https://images.unsplash.com/photo-1711059985570-4c32ed12a12c?w=1600&q=80&auto=format&fit=crop",
      ),
      ...room(
        2,
        "Habitación Arrecife",
        "Vista parcial al mar, cama king y área de lectura.",
        "$2,400 MXN/noche",
        "https://images.unsplash.com/photo-1578898887932-dce23a595ad4?w=800&q=80&auto=format&fit=crop",
      ),
      ...room(
        3,
        "Suite Marina",
        "Vista frontal al mar, terraza privada y tina de hidromasaje.",
        "$3,900 MXN/noche",
        "https://images.unsplash.com/photo-1630660664869-c9d3cc676880?w=800&q=80&auto=format&fit=crop",
      ),

      // --- Banda: amenidades en fila de iconos (fondo alt) ------------------------
      "hotel-amenities": {
        id: "hotel-amenities",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
        },
        children: ["hotel-amenities-inner"],
      },
      "hotel-amenities-inner": {
        id: "hotel-amenities-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: {
            sm: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } },
            lg: { layout: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } },
            md: { spacing: { padding: "96px 20px" } },
          },
        },
        children: ["hotel-amenity-1", "hotel-amenity-2", "hotel-amenity-3", "hotel-amenity-4"],
      },
      ...amenity(1, "Wifi", "Wifi de alta velocidad"),
      ...amenity(2, "Coffee", "Desayuno incluido"),
      ...amenity(3, "Waves", "Alberca frente al mar"),
      ...amenity(4, "PawPrint", "Se aceptan mascotas"),

      // --- Banda: galería, degradado de acento ------------------------------------
      "hotel-gallery": {
        id: "hotel-gallery",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: {
              background: "linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))",
            },
          },
        },
        children: ["hotel-gallery-inner"],
      },
      "hotel-gallery-inner": {
        id: "hotel-gallery-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["hotel-gallery-title", "hotel-gallery-grid"],
      },
      "hotel-gallery-title": {
        id: "hotel-gallery-title",
        type: "text",
        props: { content: "<strong>Galería</strong>" },
        style: {
          base: {
            typography: {
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.15",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "hotel-gallery-grid": {
        id: "hotel-gallery-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" } } },
          overrides: {
            md: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } },
            lg: { layout: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } },
          },
        },
        children: ["hotel-gallery-1", "hotel-gallery-2", "hotel-gallery-3", "hotel-gallery-4"],
      },
      ...galleryImage(1, "Alberca", "https://images.unsplash.com/photo-1549294413-26f195200c16?w=600&q=80&auto=format&fit=crop"),
      ...galleryImage(2, "Terraza", "https://images.unsplash.com/photo-1652699140205-792df2fb740f?w=600&q=80&auto=format&fit=crop"),
      ...galleryImage(3, "Restaurante", "https://images.unsplash.com/photo-1509710398975-6454dcdf049f?w=600&q=80&auto=format&fit=crop"),
      ...galleryImage(4, "Spa", "https://images.unsplash.com/photo-1770573319185-049b29ab0ca9?w=600&q=80&auto=format&fit=crop"),

      // --- Banda: testimonio (fondo claro) -----------------------------------------
      "hotel-testimonial": {
        id: "hotel-testimonial",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: ["hotel-testimonial-inner"],
      },
      "hotel-testimonial-inner": {
        id: "hotel-testimonial-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center" },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["hotel-testimonial-card"],
      },
      ...testimonialFragment(
        "hotel-testimonial-card",
        {
          quote: "El mejor hotel boutique en el que nos hemos quedado. La atención fue impecable y la vista al mar desde la suite valió cada peso.",
          name: "Carolina Fuentes",
          role: "Huésped, viaje de aniversario",
          initials: "CF",
        },
        {
          base: {
            size: { width: "100%", maxWidth: "640px" },
            spacing: { padding: "20px" },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderRadius: { token: "radii.lg" },
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
      ),

      // --- Banda: FAQ (fondo alt) ---------------------------------------------------
      "hotel-faq": {
        id: "hotel-faq",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
        },
        children: ["hotel-faq-inner"],
      },
      "hotel-faq-inner": {
        id: "hotel-faq-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["hotel-faq-title", "hotel-faq-list"],
      },
      "hotel-faq-title": {
        id: "hotel-faq-title",
        type: "text",
        props: { content: "<strong>Preguntas frecuentes</strong>" },
        style: {
          base: {
            typography: {
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.15",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "hotel-faq-list": {
        id: "hotel-faq-list",
        type: "accordion",
        props: {},
        style: defaultStyleFor("accordion"),
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["hotel-faq-item-1", "hotel-faq-item-2", "hotel-faq-item-3", "hotel-faq-item-4"],
      },
      "hotel-faq-item-1": {
        id: "hotel-faq-item-1",
        type: "accordion-item",
        props: { label: "¿A qué hora son el check-in y el check-out?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["hotel-faq-item-1-body"],
      },
      "hotel-faq-item-1-body": {
        id: "hotel-faq-item-1-body",
        type: "text",
        props: { content: "El check-in es a partir de las 15:00 y el check-out hasta las 12:00. Llegadas anticipadas sujetas a disponibilidad." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "hotel-faq-item-2": {
        id: "hotel-faq-item-2",
        type: "accordion-item",
        props: { label: "¿Cuál es la política de cancelación?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["hotel-faq-item-2-body"],
      },
      "hotel-faq-item-2-body": {
        id: "hotel-faq-item-2-body",
        type: "text",
        props: { content: "Cancelación gratuita hasta 48 horas antes de la llegada; después se cobra la primera noche." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "hotel-faq-item-3": {
        id: "hotel-faq-item-3",
        type: "accordion-item",
        props: { label: "¿Aceptan mascotas?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["hotel-faq-item-3-body"],
      },
      "hotel-faq-item-3-body": {
        id: "hotel-faq-item-3-body",
        type: "text",
        props: { content: "Sí, aceptamos mascotas pequeñas y medianas con costo adicional de $350 MXN por noche." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "hotel-faq-item-4": {
        id: "hotel-faq-item-4",
        type: "accordion-item",
        props: { label: "¿Tienen estacionamiento?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["hotel-faq-item-4-body"],
      },
      "hotel-faq-item-4-body": {
        id: "hotel-faq-item-4-body",
        type: "text",
        props: { content: "Contamos con estacionamiento privado sin costo para huéspedes, sujeto a disponibilidad." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Banda: reserva (fondo claro) ---------------------------------------------
      "hotel-reservation": {
        id: "hotel-reservation",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { padding: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: ["hotel-reservation-inner"],
      },
      "hotel-reservation-inner": {
        id: "hotel-reservation-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: "48px 20px", margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["hotel-reservation-title", "hotel-reservation-form"],
      },
      "hotel-reservation-title": {
        id: "hotel-reservation-title",
        type: "text",
        props: { content: "<strong>Reserva tu estancia</strong>" },
        style: {
          base: {
            typography: {
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.15",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "hotel-reservation-form": {
        id: "hotel-reservation-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            size: { width: "100%", maxWidth: "560px" },
            spacing: { padding: "20px" },
            appearance: {
              background: { token: "colors.surface.alt" },
              borderRadius: { token: "radii.lg" },
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        behaviors: [{ type: "form-validation", options: {} }],
        children: [
          "hotel-reservation-name-label",
          "hotel-reservation-name",
          "hotel-reservation-email-label",
          "hotel-reservation-email",
          "hotel-reservation-room-label",
          "hotel-reservation-room",
          "hotel-reservation-submit",
        ],
      },
      "hotel-reservation-name-label": {
        id: "hotel-reservation-name-label",
        type: "label",
        props: { text: "Nombre completo", for: "hotel-reservation-name" },
        style: defaultStyleFor("label"),
      },
      "hotel-reservation-name": {
        id: "hotel-reservation-name",
        type: "input",
        props: { name: "name", type: "text", placeholder: "Ej. Carolina Fuentes", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "hotel-reservation-email-label": {
        id: "hotel-reservation-email-label",
        type: "label",
        props: { text: "Correo electrónico", for: "hotel-reservation-email" },
        style: defaultStyleFor("label"),
      },
      "hotel-reservation-email": {
        id: "hotel-reservation-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "carolina@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "hotel-reservation-room-label": {
        id: "hotel-reservation-room-label",
        type: "label",
        props: { text: "Tipo de habitación", for: "hotel-reservation-room" },
        style: defaultStyleFor("label"),
      },
      "hotel-reservation-room": {
        id: "hotel-reservation-room",
        type: "select",
        props: {
          options: [
            { label: "Habitación Coral", value: "coral" },
            { label: "Habitación Arrecife", value: "arrecife" },
            { label: "Suite Marina", value: "marina" },
          ],
          name: "room",
          placeholder: "Selecciona una habitación",
          ariaLabel: "Tipo de habitación",
        },
        style: defaultStyleFor("select"),
      },
      "hotel-reservation-submit": {
        id: "hotel-reservation-submit",
        type: "button-submit",
        props: { label: "Confirmar reserva", disabled: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
            },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.surface.default" },
              borderRadius: { token: "radii.md" },
              cursor: "pointer",
            },
          },
          states: {
            hover: {
              appearance: { background: { token: "colors.text" } },
            },
          },
        },
      },

      // --- Footer con dirección: banda oscura ---------------------------------------
      "hotel-footer": {
        id: "hotel-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "32px 20px" },
            appearance: {
              background: { token: "colors.text" },
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { spacing: { padding: "56px 20px" } } },
        },
        children: ["hotel-footer-social", "hotel-footer-copyright"],
      },
      "hotel-footer-social": {
        id: "hotel-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "hotel-footer-copyright": {
        id: "hotel-footer-copyright",
        type: "text",
        props: { content: "© 2026 Hotel Casa Coral · Calle 10 Norte 45, Playa del Carmen, Q. Roo. Todos los derechos reservados." },
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

    // -------------------------------------------------------------------------
    // Traducciones (en/it) — cubren TODAS las props translatable con valor.
    // -------------------------------------------------------------------------
    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["hotel-topbar-hours"] = {
        en: { content: "Check-in 3:00 PM · Check-out 12:00 PM · 📞 +52 998 456 7890" },
        it: { content: "Check-in 15:00 · Check-out 12:00 · 📞 +52 998 456 7890" },
      };

      t["hotel-hero-title"] = {
        en: { content: "<strong>A boutique seaside retreat in Playa del Carmen</strong>" },
        it: { content: "<strong>Un rifugio boutique sul mare a Playa del Carmen</strong>" },
      };
      t["hotel-hero-sub"] = {
        en: { content: "12 rooms, an oceanfront pool and breakfast included. A 5-minute walk from Fifth Avenue." },
        it: { content: "12 camere, piscina fronte mare e colazione incluta. A 5 minuti a piedi dalla Quinta Avenida." },
      };
      t["hotel-hero-cta"] = { en: { label: "Book now" }, it: { label: "Prenota ora" } };

      t["hotel-rooms-title"] = { en: { content: "<strong>Our rooms</strong>" }, it: { content: "<strong>Le nostre camere</strong>" } };

      t["hotel-room-1-price"] = { en: { label: "$105 USD/night" }, it: { label: "€97/notte" } };
      t["hotel-room-1-title"] = { en: { content: "<strong>Coral Room</strong>" }, it: { content: "<strong>Camera Corallo</strong>" } };
      t["hotel-room-1-desc"] = { en: { content: "Garden view, queen bed and private balcony." }, it: { content: "Vista giardino, letto queen e balcone privato." } };
      t["hotel-room-1-img"] = { en: { alt: "Interior of Coral Room" }, it: { alt: "Interno della Camera Corallo" } };
      t["hotel-room-1-cta"] = { en: { label: "Book" }, it: { label: "Prenota" } };

      t["hotel-room-2-price"] = { en: { label: "$135 USD/night" }, it: { label: "€125/notte" } };
      t["hotel-room-2-title"] = { en: { content: "<strong>Reef Room</strong>" }, it: { content: "<strong>Camera Barriera</strong>" } };
      t["hotel-room-2-desc"] = { en: { content: "Partial ocean view, king bed and reading nook." }, it: { content: "Vista mare parziale, letto king e angolo lettura." } };
      t["hotel-room-2-img"] = { en: { alt: "Interior of Reef Room" }, it: { alt: "Interno della Camera Barriera" } };
      t["hotel-room-2-cta"] = { en: { label: "Book" }, it: { label: "Prenota" } };

      t["hotel-room-3-price"] = { en: { label: "$220 USD/night" }, it: { label: "€203/notte" } };
      t["hotel-room-3-title"] = { en: { content: "<strong>Marina Suite</strong>" }, it: { content: "<strong>Suite Marina</strong>" } };
      t["hotel-room-3-desc"] = { en: { content: "Front ocean view, private terrace and whirlpool tub." }, it: { content: "Vista mare frontale, terrazza privata e vasca idromassaggio." } };
      t["hotel-room-3-img"] = { en: { alt: "Interior of Marina Suite" }, it: { alt: "Interno della Suite Marina" } };
      t["hotel-room-3-cta"] = { en: { label: "Book" }, it: { label: "Prenota" } };

      t["hotel-amenity-1-icon"] = { en: { title: "High-speed wifi" }, it: { title: "Wifi ad alta velocità" } };
      t["hotel-amenity-1-label"] = { en: { content: "High-speed wifi" }, it: { content: "Wifi ad alta velocità" } };
      t["hotel-amenity-2-icon"] = { en: { title: "Breakfast included" }, it: { title: "Colazione incluta" } };
      t["hotel-amenity-2-label"] = { en: { content: "Breakfast included" }, it: { content: "Colazione incluta" } };
      t["hotel-amenity-3-icon"] = { en: { title: "Oceanfront pool" }, it: { title: "Piscina fronte mare" } };
      t["hotel-amenity-3-label"] = { en: { content: "Oceanfront pool" }, it: { content: "Piscina fronte mare" } };
      t["hotel-amenity-4-icon"] = { en: { title: "Pets welcome" }, it: { title: "Animali ammessi" } };
      t["hotel-amenity-4-label"] = { en: { content: "Pets welcome" }, it: { content: "Animali ammessi" } };

      t["hotel-gallery-title"] = { en: { content: "<strong>Gallery</strong>" }, it: { content: "<strong>Galleria</strong>" } };
      t["hotel-gallery-1"] = { en: { alt: "Pool" }, it: { alt: "Piscina" } };
      t["hotel-gallery-2"] = { en: { alt: "Terrace" }, it: { alt: "Terrazza" } };
      t["hotel-gallery-3"] = { en: { alt: "Restaurant" }, it: { alt: "Ristorante" } };
      t["hotel-gallery-4"] = { en: { alt: "Spa" }, it: { alt: "Spa" } };

      t["hotel-testimonial-card-quote"] = {
        en: { content: "<p>The best boutique hotel we've ever stayed at. The service was flawless and the ocean view from the suite was worth every peso.</p>" },
        it: { content: "<p>Il miglior hotel boutique in cui siamo stati. Il servizio è stato impeccabile e la vista sul mare dalla suite valeva ogni peso.</p>" },
      };
      t["hotel-testimonial-card-name"] = {
        en: { content: "<strong>Carolina Fuentes</strong>" },
        it: { content: "<strong>Carolina Fuentes</strong>" },
      };
      t["hotel-testimonial-card-role"] = {
        en: { content: "Guest, anniversary trip" },
        it: { content: "Ospite, viaggio di anniversario" },
      };

      t["hotel-faq-title"] = { en: { content: "<strong>Frequently asked questions</strong>" }, it: { content: "<strong>Domande frequenti</strong>" } };
      t["hotel-faq-item-1"] = { en: { label: "What time are check-in and check-out?" }, it: { label: "A che ora sono il check-in e il check-out?" } };
      t["hotel-faq-item-1-body"] = {
        en: { content: "Check-in is from 3:00 PM and check-out until 12:00 PM. Early arrivals subject to availability." },
        it: { content: "Il check-in è dalle 15:00 e il check-out fino alle 12:00. Arrivi anticipati soggetti a disponibilità." },
      };
      t["hotel-faq-item-2"] = { en: { label: "What is the cancellation policy?" }, it: { label: "Qual è la politica di cancellazione?" } };
      t["hotel-faq-item-2-body"] = {
        en: { content: "Free cancellation up to 48 hours before arrival; after that, the first night is charged." },
        it: { content: "Cancellazione gratuita fino a 48 ore prima dell'arrivo; dopo si applica il costo della prima notte." },
      };
      t["hotel-faq-item-3"] = { en: { label: "Are pets allowed?" }, it: { label: "Sono ammessi gli animali domestici?" } };
      t["hotel-faq-item-3-body"] = {
        en: { content: "Yes, we welcome small and medium pets for an additional $18 USD per night." },
        it: { content: "Sì, accettiamo animali piccoli e medi con un costo aggiuntivo di €17 a notte." },
      };
      t["hotel-faq-item-4"] = { en: { label: "Do you have parking?" }, it: { label: "Avete un parcheggio?" } };
      t["hotel-faq-item-4-body"] = {
        en: { content: "We offer free private parking for guests, subject to availability." },
        it: { content: "Offriamo un parcheggio privato gratuito per gli ospiti, soggetto a disponibilità." },
      };

      t["hotel-reservation-title"] = { en: { content: "<strong>Book your stay</strong>" }, it: { content: "<strong>Prenota il tuo soggiorno</strong>" } };
      t["hotel-reservation-name-label"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["hotel-reservation-name"] = { en: { placeholder: "E.g. Carolina Fuentes" }, it: { placeholder: "Es. Carolina Fuentes" } };
      t["hotel-reservation-email-label"] = { en: { text: "Email address" }, it: { text: "Indirizzo email" } };
      t["hotel-reservation-email"] = { en: { placeholder: "carolina@email.com" }, it: { placeholder: "carolina@email.com" } };
      t["hotel-reservation-room-label"] = { en: { text: "Room type" }, it: { text: "Tipo di camera" } };
      t["hotel-reservation-room"] = { en: { placeholder: "Select a room" }, it: { placeholder: "Seleziona una camera" } };
      t["hotel-reservation-submit"] = { en: { label: "Confirm booking" }, it: { label: "Confermare la prenotazione" } };

      t["hotel-footer-copyright"] = {
        en: { content: "© 2026 Hotel Casa Coral · Calle 10 Norte 45, Playa del Carmen, Q. Roo. All rights reserved." },
        it: { content: "© 2026 Hotel Casa Coral · Calle 10 Norte 45, Playa del Carmen, Q. Roo. Tutti i diritti riservati." },
      };

      return t;
    })(),
  };
}
