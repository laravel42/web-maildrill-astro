# Plan — Pulido de secciones del builder (Builder42)

Estado: propuesto, pendiente de implementación.
Alcance: `packages/builder42/src/builder/registry/layouts/sections/*` + registro en
`layoutRegistry.ts` + claves i18n en `sidebar.json` (es/en/it).

## Contexto

El panel "Plantillas" (`TemplatesPanel.tsx`) tiene dos categorías: `page` (páginas
completas, con imágenes reales de Unsplash, ya de buen nivel — ver
`layouts/pages/creativeAgencyPage.ts`) y `section` (piezas pequeñas para
arrastrar/insertar). Las secciones actuales son de calidad "ejemplo": copy
genérico fuera de contexto de producto, sin fotografía real salvo un
`assetId: "asset-demo"` inexistente, y varios helpers ya disponibles
(`testimonialFragment`, `quoteFragment`, componente `logo-cloud`) sin ninguna
sección que los use.

Regla acordada: **no se deja ninguna sección "tal cual"**. Cada una de las 11
existentes se pule (copy, layout, imagen si amerita) o se elimina si no aporta
nada distinto tras el rediseño. Se agregan secciones nuevas para cerrar huecos
de catálogo.

## Restricciones técnicas (verificadas en código)

- `SectionLayoutDefinition.build()` es **síncrono** (se arrastra en DnD) — nada
  de `import()` dinámico, a diferencia de `page`.
- Solo `BASE_TOKENS`; ningún hex suelto salvo dentro de un `LayoutTheme`
  declarativo opcional.
- Máx. **3 tipos de behavior únicos** por plantilla individual
  (`catalogCoverage.helper.ts`, docs/48 §5.3).
- Reusar los helpers compuestos ya existentes en `layouts/helpers.ts`:
  `statFragment`, `pricingCardFragment`, `testimonialFragment`, `quoteFragment`
  — generan el mismo árbol de nodos hijo que produce el editor al crear el
  componente desde cero, con ids deterministas.
- Imagen real = `props.source: { kind: "url", url: "<unsplash-url>" }` +
  `alt` descriptivo (mismo patrón que las `pages`), nunca un `assetId`
  inventado.
- Cada sección nueva o renombrada necesita `labelKey`/`descriptionKey` nuevas en
  `i18n/locales/{es,en,it}/sidebar.json` y su entrada en `layoutRegistry.ts`.
- Copy debe hablar de mensajería/campañas (contexto Maildrill: email, SMS,
  WhatsApp, voz), no de "diseña tu página" genérico.

## Decisión por sección existente

| # | Sección | Decisión | Justificación / cambios |
|---|---|---|---|
| 1 | `heroSection` | **Pulir** | Pasa de texto centrado plano a 2 columnas: copy (contexto Maildrill) + foto real de Unsplash (equipo trabajando / dashboard). |
| 2 | `features3Col` | **Pulir** | Las 3 tarjetas usan `container` genérico con fondo alterno; subir a icono (`icon`) + título + body por tarjeta, copy de producto (automatización, deliverability, multicanal). Sin imagen — es contenido de texto+icono, meter foto sería ruido. |
| 3 | `statsStrip` | **Pulir (copy solo)** | Estructura (icono + `stat`) ya es sólida y no se repite en ninguna otra sección. Solo cambia el copy: métricas de mensajería en vez de "países con usuarios activos". |
| 4 | `pricingSection` | **Pulir (copy solo)** | Ya usa `pricingCardFragment` correctamente. Cambia el copy de planes a algo consistente con el pricing real de Maildrill (créditos/campañas/contactos) en vez de genérico SaaS. |
| 5 | `ctaBanner` | **Pulir** | Fondo plano `colors.primary.default` → variante con foto real de fondo + overlay oscuro (`linear-gradient(...), url(...)`, mismo patrón que `creativeAgencyPage.ts`). Copy orientado a conversión de campaña. |
| 6 | `faqAccordion` | **Pulir (copy solo)** | Estructura correcta (composite `accordion`/`accordion-item`), sin imagen porque no la necesita. Preguntas genéricas de suscripción → preguntas reales de producto (canales, límites de envío, deliverability). |
| 7 | `breadcrumbHeader` | **Eliminar** | Tras revisión: es la sección más débil — un breadcrumb + título no es una "sección de marketing", es navegación de página interior. No amerita estar en la misma galería que hero/pricing/testimonios. Se elimina en vez de forzar un pulido cosmético que no cambia su utilidad real. |
| 8 | `videoShowcase` | **Pulir (copy solo)** | Ya tiene video real embebido (no le falta foto). Copy → demo de producto Maildrill en vez de genérico. |
| 9 | `teamGrid` | **Pulir** | Los 3 `avatar` tienen `url: ""` (caen a iniciales) — se reemplaza por fotos reales de personas (retratos Unsplash), y nombres/roles alineados a un equipo de producto/soporte. |
| 10 | `tabsFeatures` | **Pulir** | Las 3 pestañas usan `assetId: "asset-demo"` (no existe) — se reemplaza por `source: { kind: "url" }` con capturas/fotos reales de Unsplash por pestaña. Copy de las 3 pestañas → funcionalidades reales (automatización, reportes, integraciones), ya alineado; solo se ajusta ligeramente. |
| 11 | `newsletterModalTrigger` | **Pulir (copy solo)** | Único uso del componente `modal` en la galería, patrón de disparo externo correcto y no duplicado. Copy → suscripción a producto/roadmap en vez de "newsletter" genérico. Sin imagen (modal de formulario). |

Resultado: **10 secciones pulidas + 1 eliminada** (`breadcrumbHeader`).

## Secciones nuevas (cierran huecos de catálogo)

Los helpers `testimonialFragment` y `quoteFragment`, y el componente
`logo-cloud`, existen en el registro pero **ninguna sección los usa hoy** —
hueco real, no relleno de cuota.

| # | Sección nueva | Usa | Imagen real | Notas |
|---|---|---|---|---|
| 12 | `testimonialSpotlight` | `testimonialFragment` | Sí — foto/avatar real del cliente | Una columna, cita grande + avatar + nombre/rol, distinta del grid de `teamGrid` (un solo testimonio destacado, no una grilla de equipo). |
| 13 | `logoCloudStrip` | componente `logo-cloud` (hijos `image`) | Sí — logos reales o placeholders neutros de marca | "Confían en nosotros": fila de logos de clientes. Primera sección que usa `logo-cloud`. |
| 14 | `aboutSplit` | `image` + `text` en 2 columnas | Sí — foto real (equipo/oficina) | Variante de `videoShowcase` pero con foto fija en vez de video; layout "quiénes somos" / historia de producto. |
| 15 | `quoteStrip` | `quoteFragment` | No — banda de color, no foto | Cita destacada a ancho completo sobre banda enfática (`colors.band.dark` + `darkBandStyleFor`, mismo patrón ya usado en `pages` para bandas oscuras). Primera sección que usa `quoteFragment`. |

## Catálogo final propuesto (14 secciones)

1. Hero (pulida, con foto)
2. Features 3 columnas (pulida, icono+texto)
3. Stats strip (copy)
4. Pricing (copy)
5. CTA banner (pulida, con foto de fondo)
6. FAQ accordion (copy)
7. Video showcase (copy)
8. Team grid (pulida, fotos reales)
9. Tabs features (pulida, fotos reales)
10. Newsletter modal trigger (copy)
11. **Testimonial spotlight** (nueva)
12. **Logo cloud strip** (nueva)
13. **About split** (nueva)
14. **Quote strip** (nueva)

`breadcrumbHeader` queda eliminada del registro y de i18n.

## Ronda 2 — corrección de diseño (impeccable: craft-floor + polish)

Tras la primera implementación, feedback: las secciones se veían básicas/pobres.
Se aplicaron las reglas de `impeccable` (modo Persuade — landing/marketing, la
sección misma es el producto). Diagnóstico contra el craft-floor:

- `testimonialSpotlight` duplicaba el componente `testimonial` ya suelto en la
  paleta (`registry/components/Testimonial.tsx`) — no era una "sección
  completa" distinta, solo el mismo componente envuelto. **Eliminada** del
  catálogo, del registro y de los 3 locales i18n.
- El hero en 2 columnas quedaba plano — sin el impacto de portada que sí logra
  el único patrón de hero fuerte que existe en el proyecto (`agency-hero` en
  `layouts/pages/creativeAgencyPage.ts`). **Rediseñado a full-bleed**: mismo
  patrón exacto (`layout: flex-column, justifyContent: flex-end`,
  `size.minHeight` alto, `background: linear-gradient(...), url(...)
  center/cover no-repeat`, tipografía `clamp(2.5rem, 7vw, 5rem)`), con foto de
  fondo distinta a la de `agency-hero` y `cta-banner` para no repetir imagen.
- `videoShowcase` embebía un iframe de YouTube pesado y poco vistoso.
  **Reemplazado por una galería de 3 thumbnails** (foto real recortada 16:9 +
  fila `icon` `CirclePlay` + título, en flujo normal) que abren un `modal`
  compartido con el video real — mismo patrón de disparo que
  `newsletterModalTrigger`, sin inventar un mecanismo nuevo.
- `features3Col`, `teamGrid`, `ctaBanner`: sombras planas → `boxShadow` con
  blur real (offset + blur + spread negativo, no `4px 4px 0` duro); tarjeta
  central de `features3Col` con énfasis para romper la simetría de "3 cajas
  idénticas"; tipografía del `ctaBanner` con `clamp()` en vez de tamaño
  default; botones con estado `hover` explícito.

**Restricción de motor confirmada** (verificada en `builder/model/types.ts`):
`LayoutStyle`/`AppearanceStyle` no declaran `position`/`top`/`left`/`zIndex`/
`transform`. Ningún overlay superpuesto (badge flotante, ícono de play sobre
la imagen) es viable sin extender el modelo — fuera de alcance de un cambio de
contenido de secciones. Todo el "impacto visual" se logra con fondos de imagen
en el propio nodo (`background: url(...)`) y flujo normal, igual que ya
resuelven las `pages` existentes.

## Catálogo final (13 secciones tras la corrección)

1. Hero — full-bleed, foto de fondo + overlay, tipografía de impacto
2. Features 3 columnas — iconos + sombra con blur + énfasis en la tarjeta central
3. Stats strip
4. Pricing
5. CTA banner — foto de fondo + overlay, tipografía `clamp()`, botón con hover
6. FAQ accordion
7. Video showcase — galería de 3 thumbnails + modal con video real
8. Team grid — sombra con blur real, avatares más grandes
9. Tabs features
10. Newsletter modal trigger
11. Logo cloud strip
12. About split
13. Quote strip

## Pasos de implementación

1. Editar los 10 archivos existentes en `layouts/sections/*.ts` según la tabla
   (copy y/o imagen real vía Unsplash).
2. Eliminar `breadcrumbHeader.ts` y su import/entrada en `layoutRegistry.ts` +
   claves `breadcrumbHeader`/`breadcrumbHeaderDesc` de los 3 `sidebar.json`.
3. Crear los 4 archivos nuevos en `layouts/sections/` usando los helpers
   correspondientes.
4. Registrar las 4 nuevas en `layoutRegistry.ts` (import + entrada
   `category: "section"`).
5. Añadir `labelKey`/`descriptionKey` de las 4 nuevas (y actualizar las que
   cambian de copy si su clave de descripción cambia de sentido) en
   `i18n/locales/{es,en,it}/sidebar.json`.
6. Correr las guardas de test existentes que auditan el catálogo de layouts:
   - cobertura de catálogo (`catalogCoverage.helper.ts` — confirma que
     `logo-cloud` y `quote` ya no quedan sin uso)
   - firma estructural (`layoutSignature.helper.ts`)
   - auditoría visual (`visualAudit.helper.ts`)
   - techo de 3 behaviors únicos por plantilla
7. `pnpm typecheck && pnpm lint && pnpm test` en el paquete `builder42`.

## Fuera de alcance de este plan

- No se tocan las plantillas de `page` (ya usan Unsplash correctamente).
- No se cambia el modelo de datos (`NodeFragment`, `LayoutTheme`) ni el panel
  `TemplatesPanel.tsx` — solo contenido de las secciones y su registro.
