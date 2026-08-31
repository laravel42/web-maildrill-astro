/**
 * Enhancers del micro-runtime `ui.js` (tier 1, docs/15 Â§1) â€” lÃ³gica PURA, sin
 * side-effects de mÃ³dulo. Separado de `ui.ts` (el entry point del output, que
 * auto-ejecuta al cargar) para que el EDITOR pueda importar los enhancers en el
 * Preview (`usePreviewUIRuntime`) SIN disparar el escaneo global del documento.
 *
 * Contrato de hidrataciÃ³n (docs/15 Â§1.5): un elemento con `data-pb-ui="<type>"`
 * recibe el enhancer registrado bajo esa clave. Devuelve un `cleanup` opcional
 * (para desmontar listeners en el Preview del editor).
 *
 * Regla dura (P8): no importa nada de `src/builder/`.
 */

/** Un enhancer aplica listeners a UN elemento; devuelve cleanup opcional. */
export type UIEnhancer = (el: HTMLElement) => (() => void) | void;

/**
 * Detecta si las custom properties de tokens CSS estÃ¡n cargadas resolviendo
 * `var(--colors-surface-default)` en el elemento. Si el valor computado es la
 * variable sin resolver (i.e. el browser no encontrÃ³ la custom property), los
 * estilos del output no estÃ¡n cargados â€” ocurre en el Preview del editor donde
 * el canvas tiene sus propias variables de chrome.
 *
 * En el output del sitio publicado las variables siempre estÃ¡n cargadas (tokens.css).
 * En el editor el canvas tambiÃ©n las tiene (TokensStyle inyecta las variables).
 * Solo devuelve false cuando se carga el script ui.js en un entorno sin el CSS.
 */
function cssTokensLoaded(el: HTMLElement): boolean {
  const val = getComputedStyle(el).getPropertyValue("--colors-surface-default").trim();
  // Si estÃ¡ vacÃ­o, la var no existe; si empieza por "var(", no se resolviÃ³.
  return val !== "" && !val.startsWith("var(");
}

/** Enhancers por tipo de `data-pb-ui`. */
export const uiEnhancers: Record<string, UIEnhancer> = {
  /**
   * Select: convierte el `<details>/<summary>` en un combobox ARIA completo.
   *
   * El markup base (sin JS) es ya funcional y estilizado gracias al fallback
   * `<details>`: el usuario puede abrir/cerrar con click y seleccionar opciones.
   * Con JS mejoramos la accesibilidad (roles ARIA, navegaciÃ³n por teclado,
   * sincronizaciÃ³n con el `<select>` nativo para submit de form) y aÃ±adimos
   * comportamientos imposibles con CSS puro (cerrar al hacer click fuera,
   * typeahead, selecciÃ³n con Enter).
   *
   * DetecciÃ³n de estilos (docs/15 Â§1): si `var(--colors-surface-default)` no
   * estÃ¡ resuelta, los tokens CSS del componente no estÃ¡n cargados. En ese
   * caso NO activamos el combobox custom (el fallback `<details>` ya funciona)
   * para evitar un UI sin estilo. Solo activamos cuando los estilos estÃ¡n cargados.
   *
   * Progressive enhancement (docs/15 Â§1.7):
   * - Sin JS: `<details>` nativo funciona, opciones visibles con los tokens CSS.
   * - Con JS + CSS cargado: combobox ARIA con teclado completo.
   */
  select(el) {
    const detailsEl = el as HTMLDetailsElement;
    const summaryEl = el.querySelector<HTMLElement>(".pb-select__summary");
    const listboxEl = el.querySelector<HTMLElement>(".pb-select__listbox");
    const nativeEl = el.querySelector<HTMLSelectElement>(".pb-select__native");
    if (!summaryEl || !listboxEl || !nativeEl) return;

    // Si los tokens CSS no estÃ¡n cargados, no activar el custom UI.
    // El fallback <details> ya funciona correctamente en ese caso.
    if (!cssTokensLoaded(el)) return;

    // --- Activar el combobox ARIA ---
    const details: HTMLDetailsElement = detailsEl;
    const summary: HTMLElement = summaryEl;
    const listbox: HTMLElement = listboxEl;
    const native: HTMLSelectElement = nativeEl;

    el.classList.add("pb-select--enhanced");

    // AÃ±adir roles ARIA al summary para convertirlo en combobox
    summary.setAttribute("role", "button");
    summary.setAttribute("aria-haspopup", "listbox");
    summary.setAttribute("aria-expanded", "false");

    // Cerrar el <details> y controlar apertura via aria-expanded
    details.open = false;
    listbox.hidden = true;

    let highlightedIndex = -1;

    const options = (): HTMLElement[] =>
      Array.from(listbox.querySelectorAll<HTMLElement>(".pb-select__option"));

    const isOpen = (): boolean => summary.getAttribute("aria-expanded") === "true";

    function open() {
      details.open = true;
      listbox.hidden = false;
      summary.setAttribute("aria-expanded", "true");
      const opts = options();
      const selectedIdx = opts.findIndex((o) => o.getAttribute("aria-selected") === "true");
      highlight(selectedIdx >= 0 ? selectedIdx : 0);
    }

    function close() {
      details.open = false;
      listbox.hidden = true;
      summary.setAttribute("aria-expanded", "false");
      highlight(-1);
    }

    function highlight(index: number) {
      options().forEach((o, i) => {
        if (i === index) {
          o.classList.add("pb-select__option--highlighted");
          o.scrollIntoView({ block: "nearest" });
        } else {
          o.classList.remove("pb-select__option--highlighted");
        }
      });
      highlightedIndex = index;
    }

    function selectOption(index: number) {
      const opts = options();
      const opt = opts[index];
      if (!opt) return;
      const value = opt.dataset.value ?? "";
      const label = opt.textContent ?? "";

      opts.forEach((o) => o.setAttribute("aria-selected", "false"));
      opt.setAttribute("aria-selected", "true");

      const labelEl = summary.querySelector(".pb-select__trigger-label");
      if (labelEl) {
        labelEl.textContent = label;
        labelEl.classList.remove("pb-select__trigger-label--placeholder");
      }

      native.value = value;
      native.dispatchEvent(new Event("change", { bubbles: true }));

      close();
      summary.focus();
    }

    // Typeahead
    let typeaheadBuffer = "";
    let typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

    function typeahead(char: string) {
      typeaheadBuffer += char.toLowerCase();
      if (typeaheadTimer !== null) clearTimeout(typeaheadTimer);
      typeaheadTimer = setTimeout(() => { typeaheadBuffer = ""; }, 500);
      const match = options().findIndex((o) =>
        (o.textContent ?? "").toLowerCase().startsWith(typeaheadBuffer)
      );
      if (match >= 0) highlight(match);
    }

    // Interceptar el toggle nativo del <details> para controlar nosotros la apertura
    const onToggle = (e: Event) => {
      e.preventDefault();
      // El browser ya cambiÃ³ details.open; revertir y gestionar nosotros
      if (details.open && !isOpen()) {
        details.open = false;
        open();
      } else if (!details.open && isOpen()) {
        close();
      }
    };

    const onSummaryClick = (e: MouseEvent) => {
      e.preventDefault();
      if (isOpen()) close(); else open();
    };

    const onSummaryKeydown = (e: KeyboardEvent) => {
      const opts = options();
      const count = opts.length;
      if (count === 0) return;
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (isOpen()) { if (highlightedIndex >= 0) selectOption(highlightedIndex); }
          else open();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen()) open();
          highlight(highlightedIndex < count - 1 ? highlightedIndex + 1 : 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!isOpen()) open();
          highlight(highlightedIndex > 0 ? highlightedIndex - 1 : count - 1);
          break;
        case "Home": e.preventDefault(); if (!isOpen()) open(); highlight(0); break;
        case "End": e.preventDefault(); if (!isOpen()) open(); highlight(count - 1); break;
        case "Escape": e.preventDefault(); close(); break;
        case "Tab": close(); break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (!isOpen()) open();
            typeahead(e.key);
          }
      }
    };

    const onListboxClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(".pb-select__option");
      if (!target) return;
      const idx = options().indexOf(target);
      if (idx >= 0) selectOption(idx);
    };

    const onListboxMousemove = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(".pb-select__option");
      if (!target) return;
      const idx = options().indexOf(target);
      if (idx >= 0 && idx !== highlightedIndex) highlight(idx);
    };

    const onDocumentPointerdown = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) close();
    };

    // Inicializar label del trigger
    const placeholder = native.querySelector<HTMLOptionElement>("option[disabled][hidden]");
    const selectedOpt = native.options[native.selectedIndex];
    const labelEl = summary.querySelector(".pb-select__trigger-label");
    if (labelEl) {
      if (selectedOpt && selectedOpt.value !== "") {
        labelEl.textContent = selectedOpt.text;
        const matchIdx = options().findIndex((o) => o.dataset.value === selectedOpt.value);
        if (matchIdx >= 0) options()[matchIdx]!.setAttribute("aria-selected", "true");
      } else if (placeholder) {
        labelEl.textContent = placeholder.text;
        labelEl.classList.add("pb-select__trigger-label--placeholder");
      }
    }

    details.addEventListener("toggle", onToggle);
    summary.addEventListener("click", onSummaryClick);
    summary.addEventListener("keydown", onSummaryKeydown);
    listbox.addEventListener("click", onListboxClick);
    listbox.addEventListener("mousemove", onListboxMousemove);
    document.addEventListener("pointerdown", onDocumentPointerdown, true);

    return () => {
      details.removeEventListener("toggle", onToggle);
      summary.removeEventListener("click", onSummaryClick);
      summary.removeEventListener("keydown", onSummaryKeydown);
      listbox.removeEventListener("click", onListboxClick);
      listbox.removeEventListener("mousemove", onListboxMousemove);
      document.removeEventListener("pointerdown", onDocumentPointerdown, true);
      close();
      el.classList.remove("pb-select--enhanced");
      summary.removeAttribute("role");
      summary.removeAttribute("aria-expanded");
      listbox.hidden = false; // restaurar para el fallback <details>
      if (typeaheadTimer !== null) clearTimeout(typeaheadTimer);
    };
  },
};

/**
 * Aplica el enhancer correspondiente a UN elemento segÃºn su `data-pb-ui`.
 * Devuelve el cleanup del enhancer (o undefined si no hay match). Usado por el
 * Preview del editor (`usePreviewUIRuntime`) sobre el elemento del nodo.
 */
export function enhanceUIElement(el: HTMLElement): (() => void) | void {
  const type = el.dataset.pbUi;
  if (type && uiEnhancers[type]) return uiEnhancers[type](el);
}

/**
 * Escanea `root` y aplica el enhancer de cada `[data-pb-ui]` descendiente.
 * Usado por el output (`ui.ts`). Nota: `querySelectorAll` NO matchea `root`
 * mismo, solo descendientes â€” en el output el script corre sobre `document`,
 * asÃ­ que los wrappers de select (que llevan `data-pb-ui`) sÃ­ se encuentran.
 */
export function runUIEnhancements(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-pb-ui]").forEach((el) => enhanceUIElement(el));
}
