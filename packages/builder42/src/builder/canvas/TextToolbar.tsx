/**
 * TextToolbar — toolbar flotante de formato para el bloque `text` en edición
 * (docs/12 §B.11). Se posiciona ENCIMA del bloque (o debajo si no hay espacio
 * arriba dentro del frame), sin empujar el layout de los demás componentes —
 * es chrome de edición, nunca sale al HTML exportado (P8), igual que
 * `SelectionHandle`.
 *
 * Mismo patrón de medición que `dnd/SelectionHandle.tsx`: mide el rect del
 * nodo en edición (`data-node-id`) contra el `frameRef` del Canvas con
 * `ResizeObserver`, y se reposiciona en cada resize/cambio de breakpoint.
 *
 * No conoce a `TextEditingView` directamente: lee `activeTiptapEditor` del
 * store (publicado por `Text.stub.tsx` vía `onReady`/`onDestroy` de
 * `TiptapEditor`) y ejecuta comandos sobre esa instancia
 * (`editor.chain().focus().toggleBold().run()`). Los botones reflejan el
 * estado activo de la selección (`editor.isActive('bold')`) vía
 * `useEditorState` para no re-renderizar en cada tecleo salvo que el estado
 * relevante cambie.
 *
 * Botón de idioma (docs/12 §B, Fase 19.g/19.j): reutiliza
 * `LocaleQuickAccess` TAL CUAL (mismo componente que usa `PropField`) — es
 * autocontenido (lee `editingLocale`/`site.meta.i18n` del store por su
 * cuenta, sin props) y ya se auto-oculta si el sitio no es multilingüe, así
 * que no hace falta duplicar esa lógica ni extraer un hook. Se monta DENTRO
 * del contenedor `data-text-toolbar` (separado visualmente con un separador
 * y `margin-left:auto`, "fuera de la caja del texto" pero no fuera del
 * marcador que ya excluye clicks del listener global de "click fuera cierra
 * edición", `Text.stub.tsx` `TextEditingView`) — evita extender ese
 * `closest()` con un segundo marcador. La única adaptación es visual: el CSS
 * de `.pbx-locale-quick` asume el panel claro del Inspector; dentro de la
 * toolbar oscura flotante se sobreescriben sus tokens de color (ver
 * `chrome/canvas-nodes.css`), el componente en sí no cambia.
 *
 * Popover de enlace (D-F21.1…D-F21.6, reemplaza el `window.prompt` que tenía
 * esta toolbar): montado sobre `Popover` de c42, NO sobre `Dropdown` — un
 * pase de navegador (F21-T3c) midió que `Dropdown` es la primitiva
 * equivocada para un formulario de un campo, por diseño y no por accidente:
 * es un MENÚ (`role="menu"`, foco por flechas entre `[data-c42-dropdown-
 * item]`) cuyo controlador cierra el panel ante cualquier click que
 * coincida con ese selector, SIN mirar si la acción tuvo éxito
 * (`onMenuClick`: `closeOnSelect` cierra siempre) — así que un intento de
 * aplicar una URL inválida cerraba el popover con el mensaje de error ya
 * pintado pero invisible, y además cierra el panel con Tab
 * (`onMenuKeydown` caso `"Tab"`), una trampa de teclado para llegar al
 * botón Aplicar. `Popover` es un DIALOG (`role="dialog"`, sin manejo de
 * flechas ni cierre en Tab): solo cierra por Escape, un `pointerdown` fuera,
 * o el propio `click` de alternancia del trigger — un click DENTRO del
 * contenido no cierra nada, así que el error de validación se queda
 * visible. Igual que el `Dropdown` que sustituye, se monta EN LÍNEA (sin
 * portal, posicionado con floating-ui, `placement="bottom-start"`), con su
 * botón `[data-c42-popover-trigger]` y su panel `[data-c42-popover-content]`
 * dentro de `data-text-toolbar` — sigue cubierto por los mismos dos guards
 * que ya cubrían el `Dropdown`: el `stopPropagation` del contenedor y el
 * `closest("[data-text-toolbar]")` de `Text.stub.tsx`. Si el panel viviera
 * en un portal (o un `SimpleModal`), ningún guard lo alcanzaría y elegir/
 * aplicar un enlace volvería a cerrar la sesión de edición (el mismo bug que
 * ya se corrigió dos veces para otros controles de esta toolbar). El campo
 * de URL y los controles Aplicar/Quitar viven dentro de ese panel; ya NO
 * llevan `data-c42-dropdown-item` (ese marcador no existe para `Popover`,
 * que no cierra por click dentro del contenido bajo ningún caso) — el cierre
 * en un apply/remove EXITOSO se dispara a mano, con un click programático
 * sobre el propio trigger (ver el comentario junto al `useRef` del botón y
 * junto a `applyLink`), y tras ese click se hace `editor.chain().focus()`
 * para que la sesión de edición del texto siga viva y se pueda seguir
 * escribiendo (D-F21.3, el motivo de esta toolbar entera). `autoFocus`
 * (default `true` en `Popover`) enfoca el campo de URL al abrir — ya no hace
 * falta un `focus()` manual para eso, y de regalo se corrige el otro defecto
 * medido en el `Dropdown` (el foco se quedaba en el botón disparador). La
 * validación de la URL (esquemas aceptados, normalización de un dominio
 * pelado, mensaje cuando no aplica) vive en el módulo puro `linkHref.ts`,
 * sin importar nada de este archivo ni de React — es la única forma de
 * testearla sin jsdom en este paquete (ver el doc-comment de ese archivo).
 */

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useEditorState } from "@tiptap/react";
import { Popover } from "@josecortez1/c42-react";
import { useDocumentStore } from "../store/documentStore";
import { LocaleQuickAccess } from "../inspector/controls/LocaleQuickAccess";
import { ColorPicker } from "@/components";
import { effectiveResolvedTokens } from "../model/theme";
import { normalizeLinkHref } from "./linkHref";

interface TextToolbarProps {
  /** Frame del canvas: sistema de coordenadas y `offsetParent` de la toolbar. */
  frameRef: RefObject<HTMLElement | null>;
}

interface Box {
  top: number;
  left: number;
  /** true = la toolbar se posiciona DEBAJO del bloque (no cupo arriba). */
  below: boolean;
}

/** Subconjunto de `editor.isActive(...)` que la toolbar necesita reflejar. */
interface EditorFormatState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  link: boolean;
  heading1: boolean;
  heading2: boolean;
  heading3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  /** Color de texto de la selección (`textStyle`), o `null` si no tiene. */
  color: string | null;
  /** Color de fondo de la selección (`textStyle`), o `null` si no tiene. */
  backgroundColor: string | null;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

const TOOLBAR_HEIGHT_ESTIMATE = 40; // px — suficiente para decidir arriba/abajo antes de medir la toolbar en sí.

export function TextToolbar({ frameRef }: TextToolbarProps) {
  const { t } = useTranslation("canvas");
  const editingTextNodeId = useDocumentStore((s) => s.editingTextNodeId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const editor = useDocumentStore((s) => s.activeTiptapEditor);
  // Mismo criterio de auto-ocultado que `LocaleQuickAccess` (sitio
  // monolingüe = sin selector) — se consulta aquí también, y no solo dentro
  // de `LocaleQuickAccess`, únicamente para decidir si el separador visual
  // se muestra (el propio componente ya retorna `null` sin él).
  const i18n = useDocumentStore((s) => s.site.meta.i18n);
  const isMultilingual = !!i18n && i18n.locales.length > 1;

  const [box, setBox] = useState<Box | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editorState = useEditorState({
    editor: editor ?? null,
    selector: (ctx): EditorFormatState | null => {
      const e = ctx.editor;
      if (!e) return null;
      // `textStyle` es el mark que sostiene ambos colores (`Color` y
      // `BackgroundColor` de `@tiptap/extension-text-style` le añaden un
      // atributo cada una, ver `model/richtext.ts`); `getAttributes` devuelve
      // `{}` si la selección no lo tiene.
      const textStyle = e.getAttributes("textStyle") as {
        color?: string | null;
        backgroundColor?: string | null;
      };
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        strike: e.isActive("strike"),
        link: e.isActive("link"),
        heading1: e.isActive("heading", { level: 1 }),
        heading2: e.isActive("heading", { level: 2 }),
        heading3: e.isActive("heading", { level: 3 }),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        color: textStyle.color ?? null,
        backgroundColor: textStyle.backgroundColor ?? null,
      };
    },
  });

  // Swatches de acceso rápido: los tokens `colors.*` del tema activo, ya
  // resueltos a valores concretos (`effectiveResolvedTokens` es el mismo
  // atajo que consumen canvas y export). Lo que se quiere al colorear un
  // fragmento de texto es casi siempre un color de la marca, no un hex
  // arbitrario; el picker sigue aceptando cualquiera. Se filtran los que no
  // son hex de 6 dígitos porque `ColorPicker` solo sabe pintar esos como
  // pill (un `color-mix()` o un `oklch()` quedaría como pill transparente).
  const siteTokens = useDocumentStore((s) => s.site.meta.tokens);
  const siteThemes = useDocumentStore((s) => s.site.meta.themes);
  const activeThemeId = useDocumentStore((s) => s.activeThemeId);
  const colorSwatches = useMemo(() => {
    const resolved = effectiveResolvedTokens(siteTokens, siteThemes, activeThemeId ?? undefined);
    const out: Record<string, string> = {};
    for (const [path, value] of Object.entries(resolved)) {
      if (path.startsWith("colors.") && HEX6.test(value)) out[path] = value;
    }
    return out;
  }, [siteTokens, siteThemes, activeThemeId]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!editingTextNodeId || !frame) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = frame.querySelector<HTMLElement>(`[data-node-id="${editingTextNodeId}"]`);
      if (!el) {
        setBox(null);
        return;
      }
      const nr = el.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      const spaceAbove = nr.top - fr.top;
      const below = spaceAbove < TOOLBAR_HEIGHT_ESTIMATE;
      setBox({
        top: below ? nr.bottom - fr.top : nr.top - fr.top,
        left: nr.left - fr.left,
        below,
      });
    };
    measure();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(frame);
    const el = frame.querySelector<HTMLElement>(`[data-node-id="${editingTextNodeId}"]`);
    if (el) ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [editingTextNodeId, activeBreakpoint, frameRef]);

  // Borrador de URL del popover de enlace (D-F21.1…D-F21.4). Tienen que vivir
  // AQUÍ, junto a los demás hooks, y no más abajo: este componente retorna
  // `null` en el guard de la siguiente línea, así que un `useState` declarado
  // después de ese `return` se vuelve condicional y viola las reglas de los
  // hooks — no es una preocupación teórica, así se rompió en el navegador
  // (React error #310, "rendered more hooks than during the previous
  // render") en cuanto un nodo `text` entraba en edición, y con ello la
  // toolbar entera dejaba de montarse.
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  // Ref al botón disparador del popover de enlace (D-F21.5/D-F21.6). Va aquí,
  // con los demás hooks y antes del guard de abajo, por la misma razón que
  // `linkDraft`/`linkError`: un hook declarado después de un `return`
  // condicional revienta con React error #310 en cuanto cambia si se
  // renderiza o no (ver el comentario de arriba). Se usa para cerrar el
  // `Popover` a mano tras un apply/remove EXITOSO — `Popover` no expone
  // ningún cierre imperativo a React, y su único cierre externo es el propio
  // `click` de alternancia sobre `[data-c42-popover-trigger]`
  // (`@josecortez1/c42-core/dist/shared/popover.js`, método `toggle`), así
  // que simular ese click es la única forma de cerrarlo desde aquí.
  const linkTriggerRef = useRef<HTMLButtonElement>(null);

  if (!editingTextNodeId || !editor || !box) return null;

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    // No perder el foco del editor al clickear un botón de la toolbar.
    e.preventDefault();
    fn();
  };

  // Activación por TECLADO. Un `<button>` pulsado con Enter/Espacio dispara
  // `click`, nunca `mousedown`, así que con los comandos colgados solo de
  // `onMouseDown` la toolbar entera era inoperable con el teclado: se podía
  // tabular hasta un botón, pulsar Enter y no ocurría nada (medido: foco en
  // "Strikethrough", Enter, cero marcas aplicadas) — y los botones se anuncian
  // con `aria-label`/`aria-pressed`, así que prometían ser operables.
  // `detail === 0` distingue el click sintetizado por el teclado del click de
  // puntero (que trae `detail >= 1` y ya se atendió en `mousedown`); sin ese
  // guard el comando se ejecutaría dos veces por click y se anularía a sí mismo.
  const runKeyboard = (fn: () => void) => (e: React.MouseEvent) => {
    if (e.detail !== 0) return;
    e.preventDefault();
    fn();
  };

  const btn = (
    active: boolean,
    label: string,
    onClick: () => void,
    content: React.ReactNode,
  ) => (
    <button
      type="button"
      className={["pbx-text-toolbar__btn", active ? "pbx-text-toolbar__btn--active" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={run(onClick)}
      onClick={runKeyboard(onClick)}
    >
      {content}
    </button>
  );

  // Popover de enlace (D-F21.1…D-F21.6): borrador de URL en estado local,
  // igual de patrón que el borrador de color de `ColorPicker` — el campo es
  // controlado y solo se comitea al editor cuando el usuario aplica, no en
  // cada tecla. `onOpen` de `Popover` (evento `popover:open` de su
  // controlador, ver `@josecortez1/c42-core/dist/shared/popover.js`) resetea
  // el borrador desde el href actual de la selección cada vez que el popover
  // abre, para no arrastrar el valor tecleado en una apertura anterior sobre
  // una selección distinta. `Popover` ya enfoca el campo por su cuenta
  // (`autoFocus`, default `true` — el propio controlador busca el primer
  // elemento enfocable dentro de `[data-c42-popover-content]`), así que este
  // handler no necesita — y no debe — llamar `.focus()` sobre el campo.
  // (Los `useState` de `linkDraft`/`linkError` y el `useRef` del trigger
  // viven arriba, junto a los demás hooks — ver el comentario en ese punto.)
  const currentLinkHref = (editor.getAttributes("link").href as string | undefined) ?? null;

  const openLinkPopover = () => {
    setLinkDraft(currentLinkHref ?? "");
    setLinkError(null);
  };

  // Cierra el popover a mano tras un apply/remove EXITOSO (D-F21.3/D-F21.6).
  // `Popover` no expone ningún cierre imperativo a React (no hay un
  // `close()` en las props, a diferencia de un modal con `open`/`onClose`
  // controlado) — su único cierre externo es el propio `click` de
  // alternancia sobre el trigger (`toggle()` en el controlador, disparado
  // por el listener `click` que `init()` cuelga de
  // `[data-c42-popover-trigger]`), así que simular ese click es la única
  // manera de cerrarlo desde este código. Por eso existe `linkTriggerRef`:
  // sin él esto leería como un hack ("¿por qué se clickea un botón que no
  // hizo nada?") en vez de la única API disponible.
  const closeLinkPopover = () => {
    linkTriggerRef.current?.click();
  };

  // Aplica el borrador actual contra la selección. Se usa desde el botón
  // Aplicar y desde Enter en el campo — ninguno de los dos lleva ya
  // `data-c42-dropdown-item` (ese marcador no existe para `Popover`: no
  // cierra nada por click dentro del contenido, a propósito, para que un
  // intento REFUSADO se quede visible en vez de cerrarse con el mensaje ya
  // pintado — el defecto que tenía el `Dropdown`, ver el doc-comment del
  // módulo). El cierre en el caso de ÉXITO es responsabilidad de quien llama
  // (el botón Aplicar y el `onKeyDown` del campo), no de `applyLink`, porque
  // Quitar también necesita el mismo cierre y no pasa por esta función.
  //
  // `editor.chain().focus()` sigue siendo necesario tras cerrar: el click
  // programático sobre el trigger que hace `closeLinkPopover` le devuelve el
  // foco a ESE botón (así se comporta cualquier `<button>` tras un `click`),
  // no al texto — sin este `focus()` explícito la sesión de edición se vería
  // "colgada" aunque técnicamente sigue viva (D-F21.3, el motivo de esta
  // toolbar entera).
  const applyLink = (): boolean => {
    const result = normalizeLinkHref(linkDraft);
    if (!result.ok) {
      if (result.reason === "empty") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        setLinkError(null);
        closeLinkPopover();
        editor.chain().focus().run();
        return true;
      }
      setLinkError(t("textToolbar.linkInvalid"));
      return false;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: result.href }).run();
    setLinkError(null);
    closeLinkPopover();
    editor.chain().focus().run();
    return true;
  };

  // Enter en el campo: aplica igual que el botón Aplicar (incluye el mismo
  // cierre en caso de éxito, dentro de `applyLink`). Si la validación
  // REFUSA el valor, `applyLink` deja `linkError` puesto y no llama a
  // `closeLinkPopover` — el popover se queda abierto con el mensaje visible
  // (D-F21.4) y el documento no se toca, así que se puede seguir corrigiendo
  // la URL sin perder la selección de texto.
  const handleLinkFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyLink();
    }
    // Escape: ahora es responsabilidad de `Popover` (cierra sin aplicar y
    // devuelve el foco al trigger, D-F21.3) — su listener está en la RAÍZ
    // del controlador, así que funciona aunque el Escape se pulse dentro de
    // este `<input>`; no hace falta manejarlo aquí.
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t("textToolbar.ariaLabel")}
      data-text-toolbar
      className={[
        "pbx-text-toolbar",
        box.below ? "pbx-text-toolbar--below" : "pbx-text-toolbar--above",
      ].join(" ")}
      style={{ top: box.top, left: box.left }}
      // La toolbar vive fuera del nodo `text` (montada en Canvas junto al
      // frame): un click aquí no debe burbujear al `onClick` de deselección
      // del Canvas ni perder el foco del editor.
      //
      // Hacen falta LOS DOS handlers, y durante un tiempo solo estuvo el de
      // `mousedown`: `stopPropagation` en `mousedown` evita que el navegador
      // mueva el foco/colapse la selección, pero NO impide que el `click`
      // (que se dispara después del `mouseup`) siga burbujeando hasta
      // `main.pbx-canvas`, cuyo `onClick` llama `select(null)` — y `select`
      // limpia `editingTextNodeId`/`activeTiptapEditor` (store/slices/ui.ts).
      // Resultado medido: el comando SÍ se aplicaba y acto seguido la sesión
      // de edición se cerraba, así que no se podía aplicar un segundo estilo
      // ni seguir escribiendo. Se detiene en el contenedor, no en cada botón,
      // para que valga también para `LocaleQuickAccess` y para cualquier
      // control que se añada aquí después.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {btn(!!editorState?.bold, t("textToolbar.bold"), () => editor.chain().focus().toggleBold().run(), (
        <strong>B</strong>
      ))}
      {btn(!!editorState?.italic, t("textToolbar.italic"), () => editor.chain().focus().toggleItalic().run(), (
        <em>I</em>
      ))}
      {btn(!!editorState?.strike, t("textToolbar.strike"), () => editor.chain().focus().toggleStrike().run(), (
        <s>S</s>
      ))}

      {/* Popover de enlace (D-F21.1…D-F21.6): mismo patrón EN LÍNEA que los
          dos `ColorPicker` de abajo, pero sobre `Popover` de c42 (un DIALOG),
          no sobre `Dropdown` (un MENÚ) — ver el doc-comment del módulo para
          el porqué. Botón disparador `[data-c42-popover-trigger]` con la
          misma clase `pbx-text-toolbar__btn` que el resto de controles de
          esta toolbar (para que se vea y active igual, en vez de un botón
          nuevo con estilo propio), y panel `[data-c42-popover-content]` que
          se queda DENTRO de `data-text-toolbar` — lo cubren los mismos dos
          guards que ya cubren el color (ver comentario del módulo). `onOpen`
          resetea el borrador de URL al href actual de la selección cada vez
          que se abre; `autoFocus` (default `true`) enfoca el campo sin que
          este código tenga que pedirlo. */}
      <span className="pbx-text-toolbar__link">
        <Popover placement="bottom-start" onOpen={openLinkPopover}>
          <button
            type="button"
            ref={linkTriggerRef}
            data-c42-popover-trigger
            className={[
              "pbx-text-toolbar__btn",
              editorState?.link ? "pbx-text-toolbar__btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={t("textToolbar.link")}
            aria-pressed={!!editorState?.link}
            title={t("textToolbar.link")}
          >
            🔗
          </button>
          <div data-c42-popover-content className="pbx-text-toolbar__link-popover">
            <label className="pbx-text-toolbar__link-field-label" htmlFor="pbx-text-toolbar-link-field">
              {t("textToolbar.linkFieldLabel")}
            </label>
            <input
              id="pbx-text-toolbar-link-field"
              type="text"
              className="pbx-text-toolbar__link-field"
              value={linkDraft}
              placeholder={t("textToolbar.linkFieldPlaceholder")}
              onChange={(e) => {
                setLinkDraft(e.target.value);
                setLinkError(null);
              }}
              onKeyDown={handleLinkFieldKeyDown}
              // El campo vive DENTRO del contenido del `Popover`; un click
              // aquí no cierra nada por diseño (a diferencia del `Dropdown`
              // anterior, `Popover` no tiene un equivalente a
              // `[data-c42-dropdown-item]` que cierre al click), pero sí
              // conviene evitar que el `mousedown` le quite el foco al
              // propio campo.
              onMouseDown={(e) => e.stopPropagation()}
            />
            {linkError ? (
              <p className="pbx-text-toolbar__link-error" role="alert">
                {linkError}
              </p>
            ) : null}
            <div className="pbx-text-toolbar__link-actions">
              <button
                type="button"
                className="pbx-text-toolbar__link-apply"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyLink()}
              >
                {t("textToolbar.linkApply")}
              </button>
              {/* Afordancia condicional (D-F21.3): igual criterio que el
                  botón "Quitar colores" más abajo en esta misma toolbar — no
                  ocupa un hueco permanente para una acción que no aplica
                  cuando la selección no lleva enlace. Cierra el popover a
                  mano igual que un apply exitoso (D-F21.6) — ver
                  `closeLinkPopover` — porque Quitar no pasa por `applyLink`. */}
              {editorState?.link ? (
                <button
                  type="button"
                  className="pbx-text-toolbar__link-remove"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().extendMarkRange("link").unsetLink().run();
                    setLinkError(null);
                    closeLinkPopover();
                    editor.chain().focus().run();
                  }}
                >
                  {t("textToolbar.linkRemove")}
                </button>
              ) : null}
            </div>
          </div>
        </Popover>
      </span>

      <span className="pbx-text-toolbar__sep" aria-hidden="true" />

      {btn(
        !!editorState?.heading1,
        t("textToolbar.heading1"),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        "H1",
      )}
      {btn(
        !!editorState?.heading2,
        t("textToolbar.heading2"),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        "H2",
      )}
      {btn(
        !!editorState?.heading3,
        t("textToolbar.heading3"),
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        "H3",
      )}

      <span className="pbx-text-toolbar__sep" aria-hidden="true" />

      {btn(
        !!editorState?.bulletList,
        t("textToolbar.bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        "•",
      )}
      {btn(
        !!editorState?.orderedList,
        t("textToolbar.orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        "1.",
      )}

      <span className="pbx-text-toolbar__sep" aria-hidden="true" />

      {/* Color de tipografía y de fondo (edición fina de un fragmento, no del
          nodo entero — eso vive en el Inspector). Se reutiliza `ColorPicker`
          TAL CUAL, igual que `LocaleQuickAccess`: es el mismo control que el
          resto del chrome y, lo que importa aquí, su popover es un `Dropdown`
          de c42 que se renderiza EN LÍNEA (sin portal), así que el panel de
          color sigue estando DENTRO de `[data-text-toolbar]` — lo cubren los
          dos guards que ya tiene la toolbar (el `stopPropagation` de arriba y
          el `closest("[data-text-toolbar]")` del listener de "click fuera
          cierra edición" en `Text.stub.tsx`). Si algún día ese popover pasa a
          portal, ambos guards dejan de alcanzarlo y volver a fallar el mismo
          bug: cerrar la edición al elegir un color.

          Solo `onChangeEnd` aplica el comando: `onChange` se dispara en cada
          frame del drag y cada transacción de Tiptap comitea `setProp`, así
          que engancharlo ahí sería un paso de undo por frame. */}
      <span className="pbx-text-toolbar__color">
        <ColorPicker
          value={editorState?.color ?? "#000000"}
          onChange={() => {}}
          onChangeEnd={(hex) => editor.chain().focus().setColor(hex).run()}
          themeSwatches={colorSwatches}
          label={t("textToolbar.textColor")}
          swatchClassName="pbx-text-toolbar__color-swatch"
        />
      </span>
      <span className="pbx-text-toolbar__color">
        <ColorPicker
          value={editorState?.backgroundColor ?? "#ffffff"}
          onChange={() => {}}
          onChangeEnd={(hex) => editor.chain().focus().setBackgroundColor(hex).run()}
          themeSwatches={colorSwatches}
          label={t("textToolbar.backgroundColor")}
          swatchClassName="pbx-text-toolbar__color-swatch pbx-text-toolbar__color-swatch--bg"
        />
      </span>
      {/* Salida del callejón: sin esto, un fragmento coloreado no puede volver
          al color del tema (no hay "ningún color" que elegir en un picker).
          Solo aparece cuando la selección lleva alguno de los dos, para no
          ocupar un hueco permanente en una toolbar flotante. */}
      {editorState?.color || editorState?.backgroundColor
        ? btn(
            false,
            t("textToolbar.clearColors"),
            () => editor.chain().focus().unsetColor().unsetBackgroundColor().run(),
            "⌫",
          )
        : null}

      {/* Botón de idioma flotante (docs/12 §B, Fase 19.g/19.j): anclado a la
          derecha de la MISMA toolbar, separado visualmente con un separador
          — sigue dentro de `data-text-toolbar` (ver comentario del módulo),
          así que un click aquí no dispara "click fuera cierra edición".
          Solo si el sitio es multilingüe (mismo check que `LocaleQuickAccess`
          hace internamente para auto-ocultarse). */}
      {isMultilingual ? (
        <>
          <span className="pbx-text-toolbar__sep" aria-hidden="true" />
          <span className="pbx-text-toolbar__locale">
            <LocaleQuickAccess />
          </span>
        </>
      ) : null}
    </div>
  );
}
