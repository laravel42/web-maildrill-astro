import { createContext, useContext } from "react";

/**
 * True only under `Builder42Editor` (Maildrill embed). Standalone `App` does
 * not provide a value, so chrome that is unique to the host wrapper (second
 * header, Tokens, zip export, Code view) stays available there.
 */
export const EmbeddedChromeContext = createContext(false);

export function useEmbeddedChrome(): boolean {
  return useContext(EmbeddedChromeContext);
}

/** Center slot of the 50px canvas bar: Edit/Preview + viewport. */
export const HOST_VIEWS_ID = "md-landing-editor-views";

/** Right slot of the 50px canvas bar: undo/redo. */
export const HOST_HISTORY_ID = "md-landing-editor-history";
