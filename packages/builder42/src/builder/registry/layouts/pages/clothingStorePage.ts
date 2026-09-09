import type { NodeFragment } from "../../../model/tree";
import type { NodeTranslations } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { NAVBAR_BRAND_STYLE } from "../../components/Navbar";
import { darkBandStyleFor } from "../helpers";

/**
 * Página "Tienda de ropa / boutique" — plantilla de página completa con
 * contenido real (negocio ficticio "Nordika Studio") para una boutique de
 * ropa: topbar de envío gratis + `language-nav`, navbar, hero de colección de
 * temporada, catálogo de productos en `tabs` de categoría con grid denso
 * (`repeat(auto-fit, minmax(240px, 1fr))`), franja de beneficios con `icon`,
 * `logo-cloud` de marcas, newsletter con descuento, `accordion` de FAQ y
 * footer con redes. Multilingüe es/en/it desde el propio fragmento
 * (`translations`), mismo patrón que `landingProduct.ts`/`blogList.ts`.
 *
 * Arquetipo A4 — Catálogo denso (docs/48 §2, re-tematizado en F2): el grid de
 * productos ya no fija columnas por breakpoint (`1fr` → `repeat(2,…)` →
 * `repeat(4,…)`) sino que usa un patrón FLUIDO (`auto-fit`/`minmax`) que
 * añade/quita columnas según el ancho disponible sin declarar breakpoints
 * explícitos, y el catálogo se organiza en pestañas por categoría (`tabs`)
 * en vez de un único grid plano. Tema "Atelier" (hueso/tinta, tipografía
 * Jost) vía `LayoutTheme` en `layoutRegistry.ts`.
 *
 * Lenguaje visual (docs/43): raíz full-bleed sin `maxWidth`, bandas alternando
 * fondo (oscuro del topbar → hero con foto+scrim → claro → alt → claro →
 * degradado de acento de newsletter → claro → oscuro del footer), cada una
 * con su `inner` centrado a `1200px`. Tipografía fluida con `clamp()` en
 * título/subtítulo de hero y títulos de sección. Tarjetas de producto con
 * radio+sombra+hover e imagen con alto por breakpoint.
 */
export function buildClothingStorePageFragment(): NodeFragment {
  const translations: Record<string, NodeTranslations> = {
    // --- Topbar ----------------------------------------------------------
    "clothing-topbar-text": { es: { content: "Envío gratis en pedidos superiores a 50 € · Devoluciones en 30 días" }, it: { content: "Spedizione gratuita per ordini oltre 50 € · Resi entro 30 giorni" } },
    // --- Navbar brand ------------------------------------------------------
    "clothing-navbar-brand-text": { es: { content: "<strong>Nordika Studio</strong>" }, it: { content: "<strong>Nordika Studio</strong>" } },
    // --- Hero ------------------------------------------------------------
    "clothing-hero-title": { es: { content: "<strong>La colección Otoño/Invierno 2026</strong>" }, it: { content: "<strong>La collezione Autunno/Inverno 2026</strong>" } },
    "clothing-hero-sub": { es: { content: "Prendas atemporales, tejidos sostenibles y un calce pensado para el uso diario." }, it: { content: "Capi intramontabili, tessuti sostenibili e una vestibilità pensata per ogni giorno." } },
    "clothing-hero-cta": { es: { label: "Ver la colección" }, it: { label: "Scopri la collezione" } },
    // --- Productos ---------------------------------------------------------
    "clothing-products-title": { es: { content: "<strong>Los más vendidos</strong>" }, it: { content: "<strong>I più venduti</strong>" } },
    "clothing-tab-outerwear": { es: { label: "Abrigos" }, it: { label: "Capispalla" } },
    "clothing-tab-bottoms": { es: { label: "Pantalones" }, it: { label: "Pantaloni" } },
    "clothing-tab-knitwear": { es: { label: "Punto y calzado" }, it: { label: "Maglieria e scarpe" } },
    "clothing-product-1-name": { es: { content: "Abrigo oversize de mezcla de lana" }, it: { content: "Cappotto oversize in misto lana" } },
    "clothing-product-1-img": { es: { alt: "Abrigo oversize beige de lana sobre una modelo" }, it: { alt: "Cappotto oversize beige in lana su una modella" } },
    "clothing-product-1-price": { es: { label: "129,00 €" }, it: { label: "€129.00" } },
    "clothing-product-1-cta": { es: { label: "Añadir al carrito" }, it: { label: "Aggiungi al carrello" } },
    "clothing-product-2-name": { es: { content: "Jeans rectos de tiro alto" }, it: { content: "Jeans dritti a vita alta" } },
    "clothing-product-2-img": { es: { alt: "Modelo con jeans rectos de tiro alto" }, it: { alt: "Modella con jeans dritti a vita alta" } },
    "clothing-product-2-price": { es: { label: "69,00 €" }, it: { label: "€69.00" } },
    "clothing-product-2-cta": { es: { label: "Añadir al carrito" }, it: { label: "Aggiungi al carrello" } },
    "clothing-product-3-name": { es: { content: "Suéter de cuello alto en lana merino" }, it: { content: "Maglione a collo alto in lana merino" } },
    "clothing-product-3-img": { es: { alt: "Suéter de cuello alto en lana merino color crudo" }, it: { alt: "Maglione a collo alto in lana merino color crema" } },
    "clothing-product-3-price": { es: { label: "79,00 €" }, it: { label: "€79.00" } },
    "clothing-product-3-cta": { es: { label: "Añadir al carrito" }, it: { label: "Aggiungi al carrello" } },
    "clothing-product-4-name": { es: { content: "Botines de cuero" }, it: { content: "Stivaletti in pelle" } },
    "clothing-product-4-img": { es: { alt: "Botines de cuero color marrón" }, it: { alt: "Stivaletti in pelle marrone" } },
    "clothing-product-4-price": { es: { label: "149,00 €" }, it: { label: "€149.00" } },
    "clothing-product-4-cta": { es: { label: "Añadir al carrito" }, it: { label: "Aggiungi al carrello" } },
    // --- Beneficios --------------------------------------------------------
    "clothing-benefit-1-title": { es: { content: "<strong>Envío gratis</strong>" }, it: { content: "<strong>Spedizione gratuita</strong>" } },
    "clothing-benefit-1-body": { es: { content: "En todos los pedidos superiores a 50 €, entrega en 24–48h." }, it: { content: "Su tutti gli ordini oltre 50 €, consegna in 24–48h." } },
    "clothing-benefit-1-icon": { es: { title: "Envíos" }, it: { title: "Spedizione" } },
    "clothing-benefit-2-title": { es: { content: "<strong>Devoluciones en 30 días</strong>" }, it: { content: "<strong>Resi entro 30 giorni</strong>" } },
    "clothing-benefit-2-body": { es: { content: "¿Cambiaste de opinión? Devoluciones gratuitas hasta 30 días después de la compra." }, it: { content: "Cambio idea? Resi gratuiti entro 30 giorni dall'acquisto." } },
    "clothing-benefit-2-icon": { es: { title: "Devoluciones" }, it: { title: "Resi" } },
    "clothing-benefit-3-title": { es: { content: "<strong>Pago seguro</strong>" }, it: { content: "<strong>Pagamento sicuro</strong>" } },
    "clothing-benefit-3-body": { es: { content: "Tarjeta, PayPal o transferencia, siempre cifrado." }, it: { content: "Carta, PayPal o bonifico, sempre criptato." } },
    "clothing-benefit-3-icon": { es: { title: "Pago seguro" }, it: { title: "Pagamento sicuro" } },
    // --- Logo cloud --------------------------------------------------------
    "clothing-logos-title": { es: { content: "<strong>Tejidos con los que trabajamos</strong>" }, it: { content: "<strong>Tessuti con cui lavoriamo</strong>" } },
    "clothing-logo-1": { es: { alt: "Woolmark certified fabric logo" }, it: { alt: "Logo tessuto certificato Woolmark" } },
    "clothing-logo-2": { es: { alt: "GOTS organic cotton certification logo" }, it: { alt: "Logo certificazione cotone biologico GOTS" } },
    "clothing-logo-3": { es: { alt: "OEKO-TEX certification logo" }, it: { alt: "Logo certificazione OEKO-TEX" } },
    "clothing-logo-4": { es: { alt: "Fair Wear Foundation logo" }, it: { alt: "Logo Fair Wear Foundation" } },
    // --- Newsletter ----------------------------------------------------
    "clothing-newsletter-title": { es: { content: "<strong>Obtén 10% de descuento en tu primer pedido</strong>" }, it: { content: "<strong>Ottieni il 10% di sconto sul primo ordine</strong>" } },
    "clothing-newsletter-sub": { es: { content: "Suscríbete a nuestra newsletter y sé el primero en enterarte de novedades y rebajas." }, it: { content: "Iscriviti alla newsletter e scopri in anteprima le novità e le offerte." } },
    "clothing-newsletter-input": { es: { placeholder: "tucorreo@ejemplo.com" }, it: { placeholder: "tua@email.com" } },
    "clothing-newsletter-submit": { es: { label: "Obtener mi descuento" }, it: { label: "Ottieni lo sconto" } },
    // --- FAQ (accordion) -----------------------------------------------
    "clothing-faq-1": { es: { label: "¿Cómo encuentro mi talla?" }, it: { label: "Come trovo la mia taglia?" } },
    "clothing-faq-1-text": { es: { content: "<p>Consulta la guía de tallas en cada página de producto: incluye medidas de pecho, cintura y cadera para cada talla.</p>" }, it: { content: "<p>Consulta la guida alle taglie in ogni pagina prodotto: include le misure di petto, vita e fianchi per ogni taglia.</p>" } },
    "clothing-faq-2": { es: { label: "¿Puedo cambiar una prenda por otra talla?" }, it: { label: "Posso cambiare un articolo con un'altra taglia?" } },
    "clothing-faq-2-text": { es: { content: "<p>Sí, cambios gratuitos hasta 30 días después de la entrega, siempre que la prenda no esté usada y conserve sus etiquetas originales.</p>" }, it: { content: "<p>Sì, cambi gratuiti entro 30 giorni dalla consegna, purché l'articolo non sia stato indossato e conservi le etichette originali.</p>" } },
    "clothing-faq-3": { es: { label: "¿Cuánto tarda el envío?" }, it: { label: "Quanto tempo richiede la spedizione?" } },
    "clothing-faq-3-text": { es: { content: "<p>Los pedidos nacionales llegan en 24–48h. Los envíos internacionales tardan entre 3 y 7 días hábiles.</p>" }, it: { content: "<p>Gli ordini nazionali arrivano in 24–48h. Le spedizioni internazionali richiedono 3–7 giorni lavorativi.</p>" } },
    // --- Footer ------------------------------------------------------------
    "clothing-footer-about-title": { es: { content: "<strong>Nordika Studio</strong>" }, it: { content: "<strong>Nordika Studio</strong>" } },
    "clothing-footer-about-body": { es: { content: "Ropa sostenible para el día a día, diseñada en Barcelona desde 2015." }, it: { content: "Abbigliamento sostenibile per tutti i giorni, disegnato a Barcellona dal 2015." } },
    "clothing-footer-contact-title": { es: { content: "<strong>Atención al cliente</strong>" }, it: { content: "<strong>Servizio clienti</strong>" } },
    "clothing-footer-contact-body": { es: { content: "hello@nordikastudio.com<br/>+34 933 456 789" }, it: { content: "hello@nordikastudio.com<br/>+34 933 456 789" } },
    "clothing-footer-copyright": { es: { content: "© 2026 Nordika Studio. Todos los derechos reservados." }, it: { content: "© 2026 Nordika Studio. Tutti i diritti riservati." } },
  };

  const CARD_SHADOW = "0 12px 32px rgba(15,23,42,0.08)";
  const CARD_SHADOW_HOVER = "0 18px 40px rgba(15,23,42,0.16)";

  const productCard = (
    n: 1 | 2 | 3 | 4,
    name: string,
    alt: string,
    price: string,
    imageUrl: string,
  ) => ({
    [`clothing-product-${n}`]: {
      id: `clothing-product-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          ...defaultStyleFor("card").base,
          appearance: {
            ...defaultStyleFor("card").base.appearance,
            borderRadius: "18px",
            boxShadow: CARD_SHADOW,
          },
        },
        states: {
          hover: { appearance: { boxShadow: CARD_SHADOW_HOVER, borderColor: { token: "colors.primary.default" } } },
        },
      },
      children: [
        `clothing-product-${n}-img`,
        `clothing-product-${n}-name`,
        `clothing-product-${n}-row`,
      ],
    },
    [`clothing-product-${n}-img`]: {
      id: `clothing-product-${n}-img`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover" },
      style: {
        base: {
          size: { width: "100%", height: "220px" },
          appearance: { borderRadius: { token: "radii.md" } },
        },
        overrides: {
          md: { size: { height: "300px" } },
          lg: { size: { height: "360px" } },
        },
      },
    },
    [`clothing-product-${n}-name`]: {
      id: `clothing-product-${n}-name`,
      type: "text",
      props: { content: name },
      style: {
        base: {
          typography: { fontSize: "1.125rem", lineHeight: "1.3" },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`clothing-product-${n}-row`]: {
      id: `clothing-product-${n}-row`,
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } } },
      },
      children: [`clothing-product-${n}-price`, `clothing-product-${n}-cta`],
    },
    [`clothing-product-${n}-price`]: {
      id: `clothing-product-${n}-price`,
      type: "badge",
      props: { label: price },
      style: defaultStyleFor("badge"),
    },
    [`clothing-product-${n}-cta`]: {
      id: `clothing-product-${n}-cta`,
      type: "button",
      props: { label: "Add to cart", link: { kind: "external", href: "#" } },
      style: {
        base: {
          ...defaultStyleFor("button").base,
          spacing: { padding: "14px 22px" },
        },
        states: { hover: { appearance: { boxShadow: CARD_SHADOW } } },
      },
    },
  });

  const benefit = (
    n: 1 | 2 | 3,
    iconName: string,
    iconTitle: string,
    title: string,
    body: string,
  ) => ({
    [`clothing-benefit-${n}`]: {
      id: `clothing-benefit-${n}`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } },
          spacing: { padding: "20px" },
          typography: { textAlign: "center" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderRadius: "18px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            boxShadow: CARD_SHADOW,
          },
        },
        overrides: { md: { spacing: { padding: "28px" } } },
        states: {
          hover: { appearance: { boxShadow: CARD_SHADOW_HOVER, borderColor: { token: "colors.primary.default" } } },
        },
      },
      children: [`clothing-benefit-${n}-icon`, `clothing-benefit-${n}-title`, `clothing-benefit-${n}-body`],
    },
    [`clothing-benefit-${n}-icon`]: {
      id: `clothing-benefit-${n}-icon`,
      type: "icon",
      props: { name: iconName, pressedName: "", title: iconTitle },
      style: {
        base: {
          layout: { display: "inline-block" },
          size: { width: "32px", height: "32px" },
          appearance: { color: { token: "colors.primary.default" } },
        },
      },
    },
    [`clothing-benefit-${n}-title`]: {
      id: `clothing-benefit-${n}-title`,
      type: "text",
      props: { content: title },
      style: { base: { appearance: { color: { token: "colors.text" } } } },
    },
    [`clothing-benefit-${n}-body`]: {
      id: `clothing-benefit-${n}-body`,
      type: "text",
      props: { content: body },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
  });

  const logo = (n: 1 | 2 | 3 | 4, label: string, alt: string) => ({
    [`clothing-logo-${n}`]: {
      id: `clothing-logo-${n}`,
      type: "image",
      props: { source: { kind: "url", url: `https://placehold.co/160x60?text=${encodeURIComponent(label)}` }, alt, objectFit: "contain" },
      style: {
        base: { size: { width: "100%", maxWidth: "140px", height: "48px" } },
        overrides: { md: { size: { height: "56px" } } },
      },
    },
  });

  return {
    rootId: "clothing-root",
    translations,
    nodes: {
      // Raíz full-bleed: SIN maxWidth, cada banda hija pinta su propio fondo
      // de borde a borde (docs/43 §1).
      "clothing-root": {
        id: "clothing-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: [
          "clothing-topbar",
          "clothing-navbar",
          "clothing-hero",
          "clothing-products-section",
          "clothing-benefits",
          "clothing-logos-section",
          "clothing-newsletter",
          "clothing-faq-section",
          "clothing-footer",
        ],
      },

      // --- Topbar: banda oscura, envío gratis + language-nav -------------
      "clothing-topbar": {
        id: "clothing-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" }, alignItems: "center" },
            spacing: { padding: "12px 20px" },
            typography: { fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.text" }, color: { token: "colors.primary.on" } },
          },
          overrides: {
            md: {
              layout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
            },
          },
        },
        children: ["clothing-topbar-text", "clothing-topbar-lang"],
      },
      "clothing-topbar-text": {
        id: "clothing-topbar-text",
        type: "text",
        props: { content: "Free shipping on orders over €50 · 30-day returns" },
        style: { base: { appearance: { color: { token: "colors.primary.on" } } } },
      },
      "clothing-topbar-lang": {
        id: "clothing-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "codes", showCurrent: true, ariaLabel: "Idioma" },
        style: {
          base: {
            layout: { display: "inline-block" },
            appearance: { color: { token: "colors.primary.on" } },
          },
        },
      },

      // --- Navbar --------------------------------------------------------
      "clothing-navbar": {
        id: "clothing-navbar",
        type: "navbar",
        props: { hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
        children: ["clothing-navbar-brand"],
      },
      "clothing-navbar-brand": {
        id: "clothing-navbar-brand",
        type: "container",
        props: {},
        style: NAVBAR_BRAND_STYLE,
        children: ["clothing-navbar-brand-text"],
      },
      "clothing-navbar-brand-text": {
        id: "clothing-navbar-brand-text",
        type: "text",
        props: { content: "<strong>Nordika Studio</strong>" },
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

      // --- Hero: colección de temporada, foto + scrim ---------------------
      "clothing-hero": {
        id: "clothing-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: { token: "spacing.md" } },
            spacing: { padding: "64px 20px" },
            size: { width: "100%", minHeight: "420px" },
            typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(15,23,42,0.40)), url('https://images.unsplash.com/photo-1603400521630-9f2de124b33b?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.surface.default" },
            },
          },
          overrides: {
            md: { size: { minHeight: "520px" }, spacing: { padding: "128px 20px" } },
          },
        },
        children: ["clothing-hero-title", "clothing-hero-sub", "clothing-hero-cta"],
      },
      "clothing-hero-title": {
        id: "clothing-hero-title",
        type: "text",
        props: { content: "<strong>The Autumn/Winter 2026 collection</strong>" },
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
          overrides: {
            md: { size: { maxWidth: "26ch" } },
          },
        },
      },
      "clothing-hero-sub": {
        id: "clothing-hero-sub",
        type: "text",
        props: { content: "Timeless pieces, sustainable fabrics and a fit made for everyday wear." },
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
      "clothing-hero-cta": {
        id: "clothing-hero-cta",
        type: "button",
        props: { label: "Shop the collection", link: { kind: "anchor", nodeId: "clothing-products-section" } },
        style: {
          base: {
            ...defaultStyleFor("button").base,
            spacing: { padding: "16px 28px" },
            appearance: {
              ...defaultStyleFor("button").base.appearance,
              boxShadow: CARD_SHADOW,
            },
          },
          states: {
            hover: { appearance: { boxShadow: CARD_SHADOW_HOVER } },
          },
        },
      },

      // --- Banda 1 (claro): catálogo en tabs de categoría + grid denso -----
      "clothing-products-section": {
        id: "clothing-products-section",
        type: "section",
        props: {},
        style: {
          base: {
            spacing: { padding: "48px 20px" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["clothing-products-inner"],
      },
      "clothing-products-inner": {
        id: "clothing-products-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "24px" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["clothing-products-title", "clothing-products-tabs"],
      },
      "clothing-products-title": {
        id: "clothing-products-title",
        type: "text",
        props: { content: "<strong>Best sellers</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.15",
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      // Arquetipo A4 (docs/48 §2): catálogo organizado por categoría en
      // `tabs`, cada pestaña con su propio grid FLUIDO/denso
      // (`repeat(auto-fit, minmax(240px, 1fr))`) — la cuadrícula añade o
      // quita columnas según el ancho disponible sin declarar breakpoints
      // explícitos por columna (a diferencia del A1 anterior).
      "clothing-products-tabs": {
        id: "clothing-products-tabs",
        type: "tabs",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("tabs").base,
            layout: { display: "flex", flexDirection: "column", gap: "16px" },
            typography: { fontFamily: { token: "typography.families.sans" } },
          },
          overrides: { md: { layout: { gap: "24px" } } },
          states: {
            selected: {
              spacing: { padding: "10px 20px" },
              appearance: {
                background: { token: "colors.primary.default" },
                borderRadius: "999px",
                color: { token: "colors.primary.on" },
              },
            },
          },
        },
        behaviors: [{ type: "tabs", options: { duration: 220 } }],
        children: ["clothing-tab-outerwear", "clothing-tab-bottoms", "clothing-tab-knitwear"],
      },
      "clothing-tab-outerwear": {
        id: "clothing-tab-outerwear",
        type: "tab",
        props: { label: "Outerwear" },
        style: defaultStyleFor("tab"),
        children: ["clothing-products-grid-outerwear"],
      },
      "clothing-products-grid-outerwear": {
        id: "clothing-products-grid-outerwear",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" },
          },
          overrides: { md: { layout: { gap: "32px" } } },
        },
        children: ["clothing-product-1"],
      },
      "clothing-tab-bottoms": {
        id: "clothing-tab-bottoms",
        type: "tab",
        props: { label: "Bottoms" },
        style: defaultStyleFor("tab"),
        children: ["clothing-products-grid-bottoms"],
      },
      "clothing-products-grid-bottoms": {
        id: "clothing-products-grid-bottoms",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" },
          },
          overrides: { md: { layout: { gap: "32px" } } },
        },
        children: ["clothing-product-2"],
      },
      "clothing-tab-knitwear": {
        id: "clothing-tab-knitwear",
        type: "tab",
        props: { label: "Knitwear & shoes" },
        style: defaultStyleFor("tab"),
        children: ["clothing-products-grid-knitwear"],
      },
      "clothing-products-grid-knitwear": {
        id: "clothing-products-grid-knitwear",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" },
          },
          overrides: { md: { layout: { gap: "32px" } } },
        },
        children: ["clothing-product-3", "clothing-product-4"],
      },
      ...productCard(
        1,
        "Wool blend oversized coat",
        "Beige oversized wool coat on a model",
        "129,00 €",
        "https://images.unsplash.com/photo-1601379327928-bedfaf9da2d0?w=600&q=80&auto=format&fit=crop",
      ),
      ...productCard(
        2,
        "High-waist straight jeans",
        "Model wearing high-waist straight jeans",
        "69,00 €",
        "https://images.unsplash.com/photo-1637069585336-827b298fe84a?w=600&q=80&auto=format&fit=crop",
      ),
      ...productCard(
        3,
        "Merino wool turtleneck sweater",
        "Cream merino wool turtleneck sweater",
        "79,00 €",
        "https://images.unsplash.com/photo-1580331451062-99ff652288d7?w=600&q=80&auto=format&fit=crop",
      ),
      ...productCard(
        4,
        "Leather ankle boots",
        "Brown leather ankle boots",
        "149,00 €",
        "https://images.unsplash.com/photo-1626432424546-104e5fdbe556?w=600&q=80&auto=format&fit=crop",
      ),

      // --- Banda 2 (alt): franja de beneficios -----------------------------
      "clothing-benefits": {
        id: "clothing-benefits",
        type: "section",
        props: {},
        style: {
          base: {
            spacing: { padding: "48px 20px" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["clothing-benefits-inner"],
      },
      "clothing-benefits-inner": {
        id: "clothing-benefits-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "20px" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "32px" } } },
        },
        children: ["clothing-benefit-1", "clothing-benefit-2", "clothing-benefit-3"],
      },
      ...benefit(1, "Truck", "Shipping", "<strong>Free shipping</strong>", "On all orders over €50, delivered in 24–48h."),
      ...benefit(2, "RotateCcw", "Returns", "<strong>30-day returns</strong>", "Changed your mind? Free returns within 30 days of purchase."),
      ...benefit(3, "ShieldCheck", "Secure payment", "<strong>Secure payment</strong>", "Card, PayPal or bank transfer, always encrypted."),

      // --- Banda 3 (claro): logo cloud de marcas/certificaciones -----------
      "clothing-logos-section": {
        id: "clothing-logos-section",
        type: "section",
        props: {},
        style: {
          base: {
            spacing: { padding: "48px 20px" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["clothing-logos-inner"],
      },
      "clothing-logos-inner": {
        id: "clothing-logos-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
            typography: { textAlign: "center" },
          },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["clothing-logos-title", "clothing-logos"],
      },
      "clothing-logos-title": {
        id: "clothing-logos-title",
        type: "text",
        props: { content: "<strong>Fabrics we work with</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "clothing-logos": {
        id: "clothing-logos",
        type: "logo-cloud",
        props: {},
        // El default del componente fija `gap:"40px"` (>32px, docs/48 §5.2);
        // se sobreescribe con un valor fluido sin tocar el resto del estilo.
        style: {
          ...defaultStyleFor("logo-cloud"),
          base: { ...defaultStyleFor("logo-cloud").base, layout: { ...defaultStyleFor("logo-cloud").base.layout, gap: "20px" } },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["clothing-logo-1", "clothing-logo-2", "clothing-logo-3", "clothing-logo-4"],
      },
      ...logo(1, "Woolmark", "Logo de tejido certificado Woolmark"),
      ...logo(2, "GOTS", "Logo de certificación de algodón orgánico GOTS"),
      ...logo(3, "OEKO-TEX", "Logo de certificación OEKO-TEX"),
      ...logo(4, "Fair Wear", "Logo de Fair Wear Foundation"),

      // --- Banda 4 (degradado de acento): newsletter con descuento --------
      "clothing-newsletter": {
        id: "clothing-newsletter",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center" },
            spacing: { padding: "48px 20px" },
            typography: { textAlign: "center" },
            appearance: {
              background: "linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))",
            },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["clothing-newsletter-inner"],
      },
      "clothing-newsletter-inner": {
        id: "clothing-newsletter-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" }, alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "640px" },
          },
        },
        children: ["clothing-newsletter-title", "clothing-newsletter-sub", "clothing-newsletter-form"],
      },
      "clothing-newsletter-title": {
        id: "clothing-newsletter-title",
        type: "text",
        props: { content: "<strong>Get 10% off your first order</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "clothing-newsletter-sub": {
        id: "clothing-newsletter-sub",
        type: "text",
        props: { content: "Subscribe to our newsletter and be the first to know about new arrivals and sales." },
        style: {
          base: {
            size: { maxWidth: "62ch" },
            typography: { fontSize: "clamp(1rem, 1.6vw, 1.125rem)", lineHeight: { token: "typography.lineHeights.normal" } },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "clothing-newsletter-form": {
        id: "clothing-newsletter-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          base: {
            ...defaultStyleFor("form").base,
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            size: { width: "100%", maxWidth: "480px" },
            spacing: { padding: "20px", margin: "0 auto" },
            appearance: {
              ...defaultStyleFor("form").base.appearance,
              background: { token: "colors.surface.default" },
              borderRadius: "18px",
              boxShadow: CARD_SHADOW_HOVER,
            },
          },
          overrides: {
            md: { layout: { flexDirection: "row" }, spacing: { padding: "28px", margin: "0 auto" } },
          },
        },
        children: ["clothing-newsletter-input", "clothing-newsletter-submit"],
        behaviors: [{ type: "form-validation", options: {} }],
      },
      "clothing-newsletter-input": {
        id: "clothing-newsletter-input",
        type: "input",
        props: { name: "email", placeholder: "your@email.com", type: "email", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "clothing-newsletter-submit": {
        id: "clothing-newsletter-submit",
        type: "button-submit",
        props: { label: "Get my discount", disabled: false },
        style: {
          base: {
            ...defaultStyleFor("button-submit").base,
            spacing: { padding: "16px 22px" },
          },
          states: { hover: { appearance: { boxShadow: CARD_SHADOW } } },
        },
      },

      // --- Banda 5 (claro): FAQ (accordion) --------------------------------
      "clothing-faq-section": {
        id: "clothing-faq-section",
        type: "section",
        props: {},
        style: {
          base: {
            spacing: { padding: "48px 20px" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["clothing-faq-inner"],
      },
      "clothing-faq-inner": {
        id: "clothing-faq-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "800px" },
          },
          overrides: { lg: { size: { maxWidth: "900px" } } },
        },
        children: ["clothing-faq"],
      },
      "clothing-faq": {
        id: "clothing-faq",
        type: "accordion",
        props: {},
        style: defaultStyleFor("accordion"),
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["clothing-faq-1", "clothing-faq-2", "clothing-faq-3"],
      },
      "clothing-faq-1": {
        id: "clothing-faq-1",
        type: "accordion-item",
        props: { label: "How do I find my size?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["clothing-faq-1-text"],
      },
      "clothing-faq-1-text": {
        id: "clothing-faq-1-text",
        type: "text",
        props: { content: "<p>Check our size guide on each product page — it includes chest, waist and hip measurements for every size.</p>" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "clothing-faq-2": {
        id: "clothing-faq-2",
        type: "accordion-item",
        props: { label: "Can I exchange an item for a different size?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["clothing-faq-2-text"],
      },
      "clothing-faq-2-text": {
        id: "clothing-faq-2-text",
        type: "text",
        props: { content: "<p>Yes, free exchanges within 30 days of delivery, as long as the item is unworn and has its original tags.</p>" },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "clothing-faq-3": {
        id: "clothing-faq-3",
        type: "accordion-item",
        props: { label: "How long does shipping take?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["clothing-faq-3-text"],
      },
      "clothing-faq-3-text": {
        id: "clothing-faq-3-text",
        type: "text",
        props: { content: "<p>Orders within the country arrive in 24–48h. International shipping takes 3–7 business days.</p>" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Footer (banda oscura) ------------------------------------------
      "clothing-footer": {
        id: "clothing-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("footer").base,
            spacing: { padding: "40px 20px" },
            appearance: {
              ...defaultStyleFor("footer").base.appearance,
              background: { token: "colors.text" },
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { spacing: { padding: "64px 20px" } } },
        },
        children: ["clothing-footer-inner", "clothing-footer-copyright"],
      },
      "clothing-footer-copyright": {
        id: "clothing-footer-copyright",
        type: "text",
        props: { content: "© 2026 Nordika Studio. All rights reserved." },
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
      "clothing-footer-inner": {
        id: "clothing-footer-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "1200px" },
          },
        },
        children: ["clothing-footer-cols", "clothing-footer-social"],
      },
      "clothing-footer-cols": {
        id: "clothing-footer-cols",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } } },
          overrides: { md: { layout: { flexDirection: "row", justifyContent: "space-between" } } },
        },
        children: ["clothing-footer-about-col", "clothing-footer-contact-col"],
      },
      "clothing-footer-about-col": {
        id: "clothing-footer-about-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["clothing-footer-about-title", "clothing-footer-about-body"],
      },
      "clothing-footer-about-title": {
        id: "clothing-footer-about-title",
        type: "text",
        props: { content: "<strong>Nordika Studio</strong>" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "clothing-footer-about-body": {
        id: "clothing-footer-about-body",
        type: "text",
        props: { content: "Sustainable everyday clothing, designed in Barcelona since 2015." },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "clothing-footer-contact-col": {
        id: "clothing-footer-contact-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["clothing-footer-contact-title", "clothing-footer-contact-body"],
      },
      "clothing-footer-contact-title": {
        id: "clothing-footer-contact-title",
        type: "text",
        props: { content: "<strong>Customer service</strong>" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "clothing-footer-contact-body": {
        id: "clothing-footer-contact-body",
        type: "text",
        props: { content: "hello@nordikastudio.com<br/>+34 933 456 789" },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "clothing-footer-social": {
        id: "clothing-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },
  };
}
