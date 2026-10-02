/**
 * breakpointIcons — mapeo único "breakpoint → icono de dispositivo", usado
 * por cualquier UI que represente los breakpoints visualmente (dropdown de
 * viewport del `Header`, strip de visibilidad del Inspector, …). Antes vivía
 * SOLO dentro de `ViewportDropdown.tsx` (`viewportIcon`, no exportado); se
 * extrae aquí para que ambos consumidores compartan el mismo criterio
 * icónico y no se desincronicen si el set de breakpoints cambia.
 *
 * Criterio (idéntico al que ya usaba `ViewportDropdown`): `base`/`sm` →
 * teléfono, `md` → tablet, `lg`/`xl` → escritorio. No es una emulación real
 * de dispositivo, solo una pista visual de "más angosto → más ancho".
 */

import { Smartphone, Tablet, Monitor } from "@/components";
import type { Breakpoint } from "./types";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export function viewportIcon(value: Breakpoint): ComponentType<LucideProps> {
  if (value === "base" || value === "sm") return Smartphone;
  if (value === "md") return Tablet;
  return Monitor;
}
