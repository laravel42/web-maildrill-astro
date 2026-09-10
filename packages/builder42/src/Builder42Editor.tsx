/**
 * Builder42Editor — entrada de librería (docs/52 F7, D1/D4).
 *
 * Componente montable dentro de otra app (hoy: `web-maildrill-astro` como
 * creador de landing pages, D4/D9) sin perder el modo standalone (`pnpm dev`,
 * `main.tsx`) ni ninguno de los principios de `AGENTS.md §2`.
 *
 * Resuelve los acoplamientos globales listados en `docs/52` §3 (I1–I10):
 *  - I6 `themeMode`: `"host"` no escribe `data-theme` en `<html>` — lo LEE del
 *    host (que ya gestiona su propio `data-theme`/`md-theme`), vía la misma
 *    capa semántica de tokens (`chrome/dark.css` reacciona a
 *    `[data-theme="dark"]` sin importar quién lo puso). Cualquier otro valor
 *    (`"system" | "light" | "dark"`) usa `useThemeMode` normal, igual que
 *    standalone.
 *  - I7/D7 `locale`: instancia de i18next PROPIA (`createEditorI18n`), nunca
 *    el singleton global de `main.tsx` — dos inicializaciones se pisarían.
 *  - I8 `site`: se recibe por prop en vez de `bootstrapDemoSite()`. Acepta un
 *    `BuilderSite` ya parseado o un JSON string (mismo contrato que
 *    `parseSiteJson`/`loadSiteFromValue` usan en el resto del editor). Sin
 *    `site`, monta un sitio mínimo vacío (nunca el sitio de ejemplo — ese es
 *    solo para desarrollo local, ver `store/exampleSite/index.ts`).
 *  - I9/D8 `adapters`: IA/Unsplash/publicación se inyectan vía
 *    `setApiAdapters` (`services/apiAdapters.ts`) en vez de asumir el Express
 *    de este repo. Se limpian al desmontar.
 *  - I2/I3/I4/I5 (CSS): el consumidor importa `./style.css` (barrel
 *    `chrome-embedded.css`, F6) en vez de `chrome.css` — omite las reglas de
 *    página completa que no aplican dentro de otra app.
 *
 * `onSave` es la única forma de persistir: el editor nunca hace red por su
 * cuenta salvo los adapters explícitos de arriba (P1: el JSON es la única
 * fuente de verdad, y el host decide cómo y cuándo se guarda).
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { I18nextProvider } from "react-i18next";
import { MotionConfig } from "framer-motion";
import { Sidebar } from "@/app/layout/Sidebar";
import { Canvas } from "@/app/layout/Canvas";
import { Inspector } from "@/app/layout/Inspector";
import { TokensStyle } from "@/app/layout/TokensStyle";
import { BehaviorsStyle } from "@/app/layout/BehaviorsStyle";
import { ComponentsStyle } from "@/app/layout/ComponentsStyle";
import { HostCanvasToolbar } from "@/app/layout/HostToolbar";
import { EmbeddedChromeContext } from "@/app/EmbeddedChrome";
import { useUndoRedoShortcuts } from "@/builder/store/useTemporalStore";
import { useDocumentStore } from "@/builder/store/documentStore";
import { readConfig, useLocalConfig, writeConfig } from "@/hooks/useLocalConfig";
import { applyTheme, setThemeHostControlled, type ThemeMode } from "@/hooks/useThemeMode";
import { createEditorI18n } from "@/i18n";
import { setApiAdapters, type ApiAdapters } from "@/services/apiAdapters";
import { loadSiteFromValue } from "@/builder/model/persist";
import { createEmptyDocument, createSiteFromDocument } from "@/builder/model/site";
import type { BuilderSite } from "@/builder/model/types";

export interface Builder42EditorProps {
  /** Sitio inicial: `BuilderSite` ya parseado, o su JSON serializado (I8). */
  site?: BuilderSite | string;
  /** Persiste el sitio. Única acción de guardado — el editor no hace red por su cuenta. */
  onSave: (site: BuilderSite) => Promise<void> | void;
  /** Notifica que el host debe cerrar/desmontar el editor (ej. botón "Volver" del host). */
  onClose?: () => void;
  /**
   * Modo de tema del CHROME (I6). `"host"` (default en modo embebido): no
   * escribe `data-theme`, lo lee del host. `"system" | "light" | "dark"`:
   * mismo comportamiento que en standalone (persiste en `localStorage`).
   */
  themeMode?: "host" | ThemeMode;
  /** Idioma del CHROME del editor (I7/D7) — no confundir con `editingLocale` (idioma de contenido, docs/12 §B). */
  locale?: string;
  /** Adapters inyectables para IA/Unsplash/publicación (I9/D8). Todos opcionales. */
  adapters?: ApiAdapters;
  /** Notifies the host that the working document (or site meta) changed. */
  onDirty?: () => void;
}

/**
 * API imperativa expuesta vía `ref` (D1: el chrome compartido con standalone
 * — `Header.tsx` y sus tests — no gana props nuevas solo para el modo
 * embebido). El host decide DÓNDE vive su propio botón "Guardar"/"Cerrar" en
 * SU chrome (ej. `ChannelEditorShell`) y llama a estos métodos.
 */
export interface Builder42EditorHandle {
  /** Vuelca la copia de trabajo actual y llama `onSave` con el sitio completo. */
  save: () => Promise<void>;
  /** Snapshot síncrono del sitio completo, sin pasar por `onSave`. */
  getSite: () => BuilderSite;
  /**
   * Renombra el sitio (`site.meta.name`) desde el chrome del HOST — el editor
   * no tiene un campo propio para esto (ver `PersistenceSlice.setSiteName`).
   */
  setSiteName: (name: string) => void;
}

function resolveInitialSite(input: Builder42EditorProps["site"]): BuilderSite {
  if (input === undefined) {
    return createSiteFromDocument(createEmptyDocument());
  }
  if (typeof input === "string") {
    const result = loadSiteFromValue(JSON.parse(input));
    if (!result.ok) {
      throw new Error(`Builder42Editor: invalid initial site — ${result.errors.join("; ")}`);
    }
    return result.value;
  }
  return input;
}

export const Builder42Editor = forwardRef<Builder42EditorHandle, Builder42EditorProps>(
  function Builder42Editor({ site, onSave, onClose, themeMode = "host", locale, adapters, onDirty }, ref) {
    const i18nInstance = useMemo(() => createEditorI18n(locale), [locale]);
    const loadSite = useDocumentStore((s) => s.loadSite);
    const getFlushedSite = useDocumentStore((s) => s.getFlushedSite);
    const setSiteName = useDocumentStore((s) => s.setSiteName);
    const didInit = useRef(false);

    // Fija el flag ANTES de que se monte cualquier hijo: `ThemeToggle` vive
    // anidado dentro de `Header`, y los efectos de React corren hijos
    // primero — un `useEffect` aquí fijaría el flag DESPUÉS de que el
    // `useEffect` de `ThemeToggle` ya hubiera llamado `applyTheme` una vez.
    // `useMemo` (no `useEffect`) para que corra durante el render, antes de
    // que los hijos monten sus propios efectos; determinístico por
    // `themeMode` como dependencia (React puede re-invocar `useMemo` en
    // concurrent rendering, pero el resultado es idempotente).
    useMemo(() => {
      setThemeHostControlled(themeMode === "host");
    }, [themeMode]);

    // Carga el sitio inicial UNA vez al montar (mismo motivo que
    // `bootstrapDemoSite` en standalone: antes de que el usuario pueda
    // interactuar, después de que el registro de componentes ya resolvió).
    useEffect(() => {
      if (didInit.current) return;
      didInit.current = true;
      loadSite(resolveInitialSite(site));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // I9/D8: publica los adapters del host mientras esta instancia está
    // montada; los retira al desmontar para no dejarlos activos si otra
    // instancia (o el standalone) se monta después sin adapters.
    useEffect(() => {
      setApiAdapters(adapters ?? {});
      return () => setApiAdapters({});
    }, [adapters]);

    // I6: en modo distinto de "host", aplica el tema explícito como en
    // standalone (el flag ya se fijó de forma síncrona arriba).
    useEffect(() => {
      if (themeMode !== "host") applyTheme(themeMode);
      return () => setThemeHostControlled(false);
    }, [themeMode]);

    // Embed defaults to Simple so Tokens / zip / Code stay off the first screen.
    // Do not override an explicit choice already stored from a previous session.
    useMemo(() => {
      if (themeMode === "host" && !readConfig("experienceLevelChosen")) {
        writeConfig("experienceLevel", "simple");
        writeConfig("experienceLevelChosen", true);
      }
    }, [themeMode]);

    useEffect(() => {
      if (!onDirty) return;
      return useDocumentStore.subscribe((state, prev) => {
        if (state.document === prev.document && state.site === prev.site) return;
        onDirty();
      });
    }, [onDirty]);

    useImperativeHandle(
      ref,
      () => ({
        save: async () => {
          await onSave(getFlushedSite());
        },
        getSite: () => getFlushedSite(),
        setSiteName: (name) => setSiteName(name),
      }),
      [onSave, getFlushedSite, setSiteName],
    );

    return <Builder42EditorInner i18nInstance={i18nInstance} onClose={onClose} />;
  },
);

interface Builder42EditorInnerProps {
  i18nInstance: ReturnType<typeof createEditorI18n>;
  onClose?: () => void;
}

/**
 * Split interno: separa el layout (equivalente a `App`) del `useEffect` de
 * inicialización de `Builder42Editor`, para que solo se monte una vez el
 * sitio inicial ya está en el store (evita un frame con el sitio mínimo
 * antes del `site` real de la prop).
 *
 * `onClose` hoy no tiene un punto de anclaje in the shared chrome — the host
 * drives Back/Esc from `ChannelEditorShell`. Edit/Preview, viewport, and
 * undo/redo live in the 50px canvas bar (`HostCanvasToolbar`), matching the
 * email editor's `#ee-editor-header`.
 */
function Builder42EditorInner({ i18nInstance }: Builder42EditorInnerProps) {
  useUndoRedoShortcuts();
  const isPreview = useDocumentStore((s) => s.view === "preview");
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);
  const [sidebarMode] = useLocalConfig("sidebarMode");
  const [inspectorCollapsed] = useLocalConfig("inspectorCollapsed");

  // Code/JSON are standalone export surfaces; the embed never offers them.
  useEffect(() => {
    if (view === "code" || view === "json") setView("edit");
  }, [view, setView]);

  const bodyClasses = ["pbx-body"];
  if (isPreview) bodyClasses.push("pbx-body--preview");
  if (sidebarMode === "compact") bodyClasses.push("pbx-body--sidebar-compact");
  if (inspectorCollapsed) bodyClasses.push("pbx-body--inspector-collapsed");

  return (
    <I18nextProvider i18n={i18nInstance}>
      <MotionConfig reducedMotion="user">
        <EmbeddedChromeContext.Provider value={true}>
          <div className="pbx-app pbx-app--embedded">
            <TokensStyle />
            <BehaviorsStyle />
            <ComponentsStyle />
            <div className={bodyClasses.join(" ")}>
              {isPreview ? null : <Sidebar />}
              <div className="pbx-canvas-col">
                <HostCanvasToolbar />
                <Canvas />
              </div>
              {isPreview ? null : <Inspector />}
            </div>
          </div>
        </EmbeddedChromeContext.Provider>
      </MotionConfig>
    </I18nextProvider>
  );
}
