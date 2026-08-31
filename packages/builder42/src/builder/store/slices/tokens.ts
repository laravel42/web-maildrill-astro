/**
 * Tokens del sitio (docs/08): valores base (colores, radios, espaciados, …),
 * tipografía y assets binarios subidos por el usuario. Editar un token
 * propaga a todos los nodos que lo referencian (se refleja al instante en el
 * canvas vía `TokensStyle`). Distinto del sistema de `themes` (docs/11), que
 * puede remapear estos tokens por tema — esa slice vive aparte.
 */
import { newAssetId } from "../../model/assets";
import { isBaseToken } from "../../model/tokens";
import type { TokenGroup, TypographyScalarGroup } from "../../model/tokens";
import type { AssetAttribution, TokenFontFamily, OverrideBreakpoint, ResponsiveTokenValue } from "../../model/types";
import type { SliceCreator } from "./types";

export interface TokensSlice {
  // Tokens del sitio (docs/08). Editar un token propaga a todos los nodos que
  // lo referencian (se refleja al instante en el canvas vía TokensStyle).
  setToken: (group: TokenGroup, key: string, value: string) => void;
  // Borra un token del grupo (CRUD, docs/08 §5). No-op si no existe.
  removeToken: (group: TokenGroup, key: string) => void;

  // Tokens de tipografía (docs/08 §6). Los escalares (sizes/weights/lineHeights)
  // son Record<string,string>; las familias son `TokenFontFamily` (stack + webFont).
  //
  // `sizes`/`lineHeights` (docs/49) admiten variar por breakpoint: `breakpoint`
  // opcional, ausente/`"base"` escribe/borra el valor `base` (retrocompat total
  // con la firma anterior — un `string` plano sin overrides sigue siendo válido).
  // Un breakpoint `sm`/`md`/`lg`/`xl` escribe/borra SOLO ese override, sin tocar
  // `base` ni los demás — mismo criterio mobile-first que `setStyleProp`/
  // `resetStyleProp` para `NodeStyle.overrides`. `weights` no admite breakpoint
  // (fuera de alcance, docs/49 §1: cambiar de peso por breakpoint no está pedido).
  setTypographyToken: (
    sub: TypographyScalarGroup,
    key: string,
    value: string,
    breakpoint?: OverrideBreakpoint,
  ) => void;
  removeTypographyToken: (
    sub: TypographyScalarGroup,
    key: string,
    breakpoint?: OverrideBreakpoint,
  ) => void;
  setFontFamily: (key: string, family: TokenFontFamily) => void;
  removeFontFamily: (key: string) => void;

  // Assets del sitio (docs/07 §4). Sube un binario (data URL) y devuelve su id.
  // `attribution` opcional (docs/35 §2 Fase D): metadata del proveedor cuando
  // el asset proviene de un banco de imágenes (ej. Unsplash).
  addAsset: (
    fileName: string,
    mimeType: string,
    dataUrl: string,
    attribution?: AssetAttribution,
  ) => string;
}

/** `true` si el subgrupo escalar de tipografía admite valores responsive (docs/49 §1). */
function isResponsiveSub(sub: TypographyScalarGroup): boolean {
  return sub === "sizes" || sub === "lineHeights";
}

export const createTokensSlice: SliceCreator<TokensSlice> = (set) => ({
  // --- Tokens ---------------------------------------------------------
  // `key` puede ser una subruta con puntos (`surface.default`) que se
  // escribe/borra en el árbol anidado del grupo (docs/08 §1).
  setToken: (group, key, value) =>
    set((s) => {
      const meta = s.site.meta;
      const tokens = (meta.tokens ??= {});
      const root = ((tokens as Record<string, Record<string, unknown>>)[group] ??= {});
      const parts = key.split(".");
      let node = root as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i]!;
        if (typeof node[p] !== "object" || node[p] === null) node[p] = {};
        node = node[p] as Record<string, unknown>;
      }
      node[parts[parts.length - 1]!] = value;
    }),

  removeToken: (group, key) =>
    set((s) => {
      if (isBaseToken(group, key)) return; // protegido
      const root = (s.site.meta.tokens as Record<string, Record<string, unknown>> | undefined)?.[
        group
      ];
      if (!root) return;
      const parts = key.split(".");
      const chain: Record<string, unknown>[] = [root as Record<string, unknown>];
      let node = root as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i++) {
        const next = node[parts[i]!];
        if (typeof next !== "object" || next === null) return; // ruta inexistente
        node = next as Record<string, unknown>;
        chain.push(node);
      }
      delete node[parts[parts.length - 1]!];
      // Limpia ramas que quedaron vacías (de la hoja hacia la raíz).
      for (let i = parts.length - 2; i >= 0; i--) {
        const parent = chain[i]!;
        const branch = parent[parts[i]!] as Record<string, unknown> | undefined;
        if (branch && Object.keys(branch).length === 0) delete parent[parts[i]!];
      }
    }),

  setTypographyToken: (sub, key, value, breakpoint) =>
    set((s) => {
      const tokens = (s.site.meta.tokens ??= {});
      const typo = (tokens.typography ??= {});
      const rec = (typo[sub] ??= {}) as Record<string, ResponsiveTokenValue>;
      const current = rec[key];
      if (!breakpoint || !isResponsiveSub(sub)) {
        // Editar el valor BASE (sin breakpoint, o subgrupo que no admite
        // responsive como `weights`): si el token ya tiene overrides propios
        // en otros breakpoints, se PRESERVAN — solo se actualiza `base`. Un
        // token sin overrides sigue colapsando a string plano (retrocompat
        // total con la firma anterior a docs/49). Bug real corregido: antes
        // `rec[key] = value` reemplazaba el objeto {base, overrides} entero
        // por un string, borrando cualquier override que el usuario ya
        // hubiera editado en un breakpoint superior — editar "base" no debe
        // resetear cambios que el usuario ya hizo explícitamente en otra capa.
        if (typeof current === "object" && current !== null && current.overrides) {
          rec[key] = { base: value, overrides: current.overrides };
        } else {
          rec[key] = value;
        }
        return;
      }
      // Con breakpoint: declara/actualiza SOLO ese override, preservando base
      // y los demás overrides existentes (mobile-first, docs/49 §2.1).
      const base = typeof current === "object" && current !== null ? current.base : (current ?? value);
      const overrides = typeof current === "object" && current !== null ? { ...current.overrides } : {};
      overrides[breakpoint] = value;
      rec[key] = { base, overrides };
    }),

  removeTypographyToken: (sub, key, breakpoint) =>
    set((s) => {
      if (isBaseToken(`typography.${sub}`, key)) return; // protegido
      const rec = s.site.meta.tokens?.typography?.[sub] as
        | Record<string, ResponsiveTokenValue>
        | undefined;
      if (!rec) return;
      if (!breakpoint) {
        delete rec[key];
        return;
      }
      // Borra solo el override de ESE breakpoint (docs/49 §2.1): si el token
      // no es responsive (string plano) o no tiene ese override, no-op. Si
      // tras borrarlo no queda ningún override, colapsa a string plano otra
      // vez (limpieza simétrica a cómo se crea en `setTypographyToken`).
      const current = rec[key];
      if (typeof current !== "object" || current === null) return;
      if (!current.overrides || current.overrides[breakpoint] === undefined) return;
      const overrides = { ...current.overrides };
      delete overrides[breakpoint];
      rec[key] = Object.keys(overrides).length > 0 ? { base: current.base, overrides } : current.base;
    }),

  setFontFamily: (key, family) =>
    set((s) => {
      const tokens = (s.site.meta.tokens ??= {});
      const typo = (tokens.typography ??= {});
      const fams = (typo.families ??= {});
      fams[key] = family;
    }),

  removeFontFamily: (key) =>
    set((s) => {
      if (isBaseToken("typography.families", key)) return; // protegido
      const fams = s.site.meta.tokens?.typography?.families;
      if (fams) delete fams[key];
    }),

  // --- Assets ---------------------------------------------------------
  addAsset: (fileName, mimeType, dataUrl, attribution) => {
    const id = newAssetId();
    set((s) => {
      s.site.assets ??= {};
      s.site.assets[id] = {
        id,
        fileName,
        mimeType,
        dataUrl,
        ...(attribution ? { attribution } : {}),
      };
    });
    return id;
  },
});
