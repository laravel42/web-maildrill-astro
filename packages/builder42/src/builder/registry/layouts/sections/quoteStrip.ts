import type { NodeFragment } from "../../../model/tree";
import { darkBandStyleFor, quoteFragment } from "../helpers";

/**
 * Cita destacada a ancho completo sobre una banda enfática oscura (docs/43
 * §3, docs/48 §3.2): el `section` raíz lleva `appearance.background` al
 * token `colors.band.dark` y el `quote` interior usa `darkBandStyleFor` para
 * que su texto siga siendo legible sobre el fondo oscuro. Atribuida a un
 * caso de uso real de Maildrill (recuperación de campañas con alta tasa de
 * apertura vía multicanal).
 *
 * Impacto visual (ronda de mejora visual del catálogo): la banda se veía
 * plana — tipografía de tamaño fijo (`typography.sizes.lg`, sin escalar),
 * ancho de lectura sin límite (la cita se estiraba a todo el `section` en
 * viewports anchos) y un padding vertical (`spacing.lg`) más de franja que
 * de sección de impacto. Ahora:
 *   - el `quote` sube a `clamp(1.25rem, 3vw, 1.75rem)` (escala con el
 *     viewport sin desbordar en `base` angosto, donde 3vw de 375px ≈ el
 *     mínimo del clamp) y limita `size.maxWidth: "65ch"` con
 *     `spacing.margin: "0 auto"` para que el bloque de texto quede
 *     centrado y legible en pantallas anchas.
 *   - el `section` raíz sube su padding vertical (`24px` en `base` →
 *     `56px`/`96px` en `sm`/`md`) para que la banda se sienta como un
 *     quiebre de sección, no una franja angosta.
 * `darkBandStyleFor("quote")` sigue siendo la base (color `colors.band.on`
 * sobre el fondo oscuro) — se mergea campo a campo con los overrides de
 * tamaño/tipografía de esta sección para no perder ese contraste.
 */
export function buildQuoteStripFragment(): NodeFragment {
  const quoteBandStyle = darkBandStyleFor("quote");

  return {
    rootId: "quote-strip-root",
    nodes: {
      "quote-strip-root": {
        id: "quote-strip-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center" },
            spacing: { padding: "24px 20px" },
            appearance: { background: { token: "colors.band.dark" } },
          },
          overrides: {
            sm: { spacing: { padding: "56px 32px" } },
            md: { spacing: { padding: "96px 20px" } },
          },
        },
        children: ["quote-strip-quote"],
      },
      ...quoteFragment(
        "quote-strip-quote",
        {
          content:
            "Cuando movimos nuestras campañas de reactivación a Maildrill, combinar email y WhatsApp en el mismo flujo triplicó la tasa de apertura en menos de un mes.",
          attribution: "Diego Salcedo, Growth Lead en Cursor Fintech",
        },
        {
          ...quoteBandStyle,
          base: {
            ...quoteBandStyle.base,
            size: { maxWidth: "65ch" },
            spacing: { ...quoteBandStyle.base.spacing, margin: "0 auto" },
            typography: {
              ...quoteBandStyle.base.typography,
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              lineHeight: "1.4",
            },
          },
        },
      ),
    },
  };
}
