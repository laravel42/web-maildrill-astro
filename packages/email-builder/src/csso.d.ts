// `csso` ships no type declarations. We only use `minify(css, options)`.
declare module 'csso' {
  export function minify(css: string, options?: { restructure?: boolean }): { css: string };
}
