import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import auth from 'auth-astro';

import { siteConfig } from './src/config/site';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const appSrc = path.resolve(rootDir, 'src');
const waStudioSrc = path.resolve(rootDir, 'packages/wa-template-studio/src');

/**
 * Every Astro CLI pass runs its own Vite dep optimizer, and that optimizer
 * REWRITES the cacheDir it is handed — deleting the chunk files a running
 * `astro dev` daemon is still serving from. The daemon's in-memory metadata
 * then points at files that no longer exist, the lazily-discovered deps
 * (WhatsApp studio, email builder) 504 with "Outdated Optimize Dep", and only
 * a server restart recovers — page reloads can't. `astro build` was the first
 * offender found (320 -> 163 files); `astro sync` does the same (337 -> 190
 * files, verified 2026-08-17) and it runs on every `astro check`, i.e. on
 * every `pnpm check` / `pnpm typecheck`. So the shared `node_modules/.vite`
 * belongs to the dev server alone and every other command gets its own
 * directory. NODE_ENV can't drive this split: the root `.env` pins
 * NODE_ENV=development.
 */
const astroCommand = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
const isDevServer = astroCommand === 'dev';
const cacheDirSuffix = astroCommand && /^[a-z][a-z-]*$/.test(astroCommand) ? astroCommand : 'cli';

const RESOLVE_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

function resolveWithExtensions(base: string): string | undefined {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of RESOLVE_EXTS) {
    const file = base + ext;
    if (fs.existsSync(file)) return file;
  }
  for (const ext of RESOLVE_EXTS) {
    const file = path.join(base, `index${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return undefined;
}

/** `@/` means app `src/` here, but wa-template-studio's own `src/` inside the package. */
function resolveAtImport(source: string, importer?: string): string | undefined {
  if (!source.startsWith('@/')) return undefined;
  const subpath = source.slice(2);
  const root = importer?.includes('wa-template-studio') ? waStudioSrc : appSrc;
  return resolveWithExtensions(path.join(root, subpath));
}

/** Resolve wa-template-studio's internal `@/` imports when bundled by Astro/Vite. */
function waTemplateStudioAlias() {
  return {
    name: 'wa-template-studio-alias',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      return resolveAtImport(source, importer) ?? null;
    },
  };
}

// `import.meta.env` isn't populated at config-load time, so read the raw env
// (set at build, e.g. on Cloudflare Pages) with the config default as fallback.
const siteUrl = process.env.PUBLIC_SITE_URL || siteConfig.url;

// Astro 7 ignores X-Forwarded-Proto/Host unless the proxy hosts are listed
// here. Without this, requests proxied by nginx resolve to
// http://localhost:4321, so the CSRF origin check 403s every same-origin form
// POST in production — including the Auth.js credentials callback, which
// breaks login. The proxy must still send X-Forwarded-Proto: https.
// (Typed and hoisted out of defineConfig: inlining it trips TS 2589
// "excessive stack depth" against the deep AstroUserConfig type.)
const security: AstroUserConfig['security'] = {
  allowedDomains: [
    { hostname: 'maildrill.net', protocol: 'https' },
    // Cloudflare tunnel in front of the local dev server (pnpm tunnel).
    { hostname: 'local.maildrill.net', protocol: 'https' },
  ],
};

export default defineConfig({
  site: siteUrl,
  trailingSlash: 'never',
  // Astro 7 changed the `compressHTML` default from `true` to `'jsx'`, which
  // strips whitespace-only text nodes even between inline elements (e.g.
  // `<a>x</a> <a>y</a>` would collapse the gap). Pin the HTML-aware behavior to
  // keep rendered output identical to the pre-upgrade site.
  compressHTML: true,
  // Flat file output (`/pricing.html`) so hosts serve no-trailing-slash URLs
  // with a 200 (matching the canonicals) instead of 308-redirecting to a slash.
  build: { format: 'file' },
  // Marketing pages stay static; the app/auth/api routes opt into on-demand
  // rendering with `export const prerender = false`.
  adapter: node({ mode: 'standalone' }),
  security,
  integrations: [
    react(),
    auth(),
    sitemap({
      filter: (page) =>
        !page.includes('/app/') &&
        !page.includes('/dashboard') &&
        !page.includes('/login') &&
        !page.includes('/signup') &&
        !page.includes('/forgot-password') &&
        // API docs are hidden for now — keep them out of the sitemap too.
        !page.includes('/developers') &&
        // Per-recipient, token-addressed pages. They are `prerender = false`
        // and meaningless without a token, so a crawler reaching them sees an
        // error state — and inviting crawlers to /unsubscribe is worse than
        // useless: that flow exists precisely because scanners prefetch links
        // in mail, which is why its GET only confirms and never acts.
        !page.includes('/unsubscribe') &&
        !page.includes('/view') &&
        !page.includes('/auth/'),
    }),
  ],
  vite: {
    // The dev server owns the shared dep cache; build/sync/check each get
    // their own so they can't clobber it (see isDevServer above).
    cacheDir: isDevServer ? 'node_modules/.vite' : `node_modules/.vite-${cacheDirSuffix}`,
    // `@/` is resolved by waTemplateStudioAlias (resolveId + enforce: 'pre').
    // Do not use resolve.alias.customResolver — deprecated, removed in Vite 9.
    plugins: [waTemplateStudioAlias(), tailwindcss()],
    // The Cloudflare tunnel (scripts/local-tunnel.sh) fronts the dev server
    // with this Host header; Vite rejects non-localhost hosts by default.
    server: {
      allowedHosts: ['local.maildrill.net'],
    },
    // nodemailer is a Node-only CJS dep (used by the SMTP welcome sender) —
    // keep it out of Vite's SSR transform/optimizer so it's required at runtime
    // (avoids a transient 500 on the first request that imports it in dev).
    ssr: {
      external: ['nodemailer'],
    },
    // Deps reachable only through lazy `import()` (voice preview, WhatsApp
    // studio, email builder) are invisible to Vite's default startup scan.
    // Mid-session discovery re-optimizes while the app is in use and can
    // strand the new dep at a never-committed hash — every request then 504s
    // with "Outdated Optimize Dep" until the server restarts. `entries` makes
    // the startup scanner crawl the island sources (following lazy chains and
    // deep subpath imports like @mui/icons-material/*); `include` pins the
    // clusters that bit us, in case a chain ever escapes the scan.
    optimizeDeps: {
      entries: [
        'src/components/react/**/*.{ts,tsx}',
        'packages/email-builder-standalone/src/index.tsx',
        'packages/wa-template-studio/src/index.ts',
        'packages/emoji-picker/src/index.ts',
      ],
      include: [
        'infobip-rtc',
        // Subscriber file import: SheetJS is lazy-loaded on first spreadsheet.
        'xlsx',
        // Emoji picker (every composer, via @md/emoji-picker): lazy-loaded on
        // first open.
        '@md/emoji-picker > @emoji-mart/react',
        '@md/emoji-picker > emoji-mart',
        // Profile security: QR render is lazy-imported; the WebAuthn client
        // rides the statically-imported auth islands.
        'qrcode',
        '@simplewebauthn/browser',
        'wa-template-studio > @dnd-kit/core',
        'wa-template-studio > @dnd-kit/modifiers',
        'wa-template-studio > @dnd-kit/sortable',
        'wa-template-studio > @dnd-kit/utilities',
        'wa-template-studio > @hookform/resolvers/zod',
        'wa-template-studio > @radix-ui/react-dialog',
        'wa-template-studio > @radix-ui/react-dropdown-menu',
        'wa-template-studio > @radix-ui/react-label',
        'wa-template-studio > @radix-ui/react-popover',
        'wa-template-studio > @radix-ui/react-scroll-area',
        'wa-template-studio > @radix-ui/react-select',
        'wa-template-studio > @radix-ui/react-separator',
        'wa-template-studio > @radix-ui/react-slot',
        'wa-template-studio > @radix-ui/react-switch',
        'wa-template-studio > @radix-ui/react-tabs',
        'wa-template-studio > @radix-ui/react-tooltip',
        'wa-template-studio > class-variance-authority',
        'wa-template-studio > clsx',
        'wa-template-studio > framer-motion',
        'wa-template-studio > lucide-react',
        'wa-template-studio > react-hook-form',
        'wa-template-studio > tailwind-merge',
        'wa-template-studio > zod',
        'wa-template-studio > zustand',
        // email-builder-standalone: MUI + tiptap + dnd (lazy-loaded island).
        'email-builder-standalone > @mui/material',
        'email-builder-standalone > @mui/icons-material',
        'email-builder-standalone > @emotion/react',
        'email-builder-standalone > @emotion/styled',
        'email-builder-standalone > @emotion/cache',
        'email-builder-standalone > @tiptap/core',
        'email-builder-standalone > @tiptap/react',
        'email-builder-standalone > @tiptap/react/menus',
        'email-builder-standalone > @tiptap/starter-kit',
        'email-builder-standalone > @tiptap/suggestion',
        'email-builder-standalone > @tiptap/extension-color',
        'email-builder-standalone > @tiptap/extension-placeholder',
        'email-builder-standalone > @tiptap/extension-text-align',
        'email-builder-standalone > @tiptap/extension-text-style',
        'email-builder-standalone > react-dnd',
        'email-builder-standalone > react-dnd-html5-backend',
        'email-builder-standalone > react-colorful',
        'email-builder-standalone > zustand',
        'email-builder-standalone > i18next',
        'email-builder-standalone > react-i18next',
      ],
    },
  },
  redirects: {
    '/privacy-policy': '/legal/privacy',
    '/terms-of-service': '/legal/terms',
    // The workspace moved from /app/* to /dashboard/*; keep old URLs working.
    // Enumerated because Astro dynamic redirects need a matching dynamic
    // destination route, and /dashboard/* are plain file routes.
    '/app': '/dashboard',
    '/app/campaigns': '/dashboard/campaigns',
    '/app/templates': '/dashboard/templates',
    '/app/lists': '/dashboard/lists',
    '/app/subscribers': '/dashboard/subscribers',
    '/app/media': '/dashboard/media',
    '/app/analytics': '/dashboard/analytics',
    '/app/settings': '/dashboard/settings',
  },
});
