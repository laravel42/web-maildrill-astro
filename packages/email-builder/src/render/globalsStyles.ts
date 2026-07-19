/**
 * Global CSS injected into the exported email `<head>`, alongside the
 * per-block rules emitted by `cleanDocument`. Shared by the editor HTML
 * export and the Node-safe `renderEmailHtml`.
 */
export const globalsStyles = `
  .ql-snow a{
    color: inherit;
  }
  h1,h2,h3,h4,h5,h6{font-size:revert;font-weight:revert;}
  p{margin: 0;}
  ol,ul{list-style:revert;margin:revert;padding:revert;}
`;
