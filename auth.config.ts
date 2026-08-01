import Credentials from '@auth/core/providers/credentials';
import { defineConfig } from 'auth-astro';

// The standalone Node server doesn't load .env at runtime — Astro only inlines
// import.meta.env at build time, so process.env is empty in production unless the
// daemon injects it. Load ./.env here (Node's built-in parser) so runtime reads
// like AUTH_SECRET, JWT_SECRET, API_BASE_URL and SMTP_* resolve. Skipped when the
// environment already provides them; a missing file or older Node is ignored.
if (!process.env.AUTH_SECRET && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    /* no ./.env — rely on the real process environment */
  }
}

/**
 * Auth.js (auth-astro) with a single "magic-link" Credentials provider. The
 * actual magic-link issue/verify lives in workers; here we only
 * exchange a verified token for a session. Stateless JWT sessions — the frontend
 * keeps no DB.
 */
export default defineConfig({
  // Astro loads .env into import.meta.env (not process.env), so pass the secret
  // explicitly. trustHost is required for @auth/core behind a dev/proxy host.
  secret: import.meta.env.AUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt' },
  // Use our branded pages instead of Auth.js's default /api/auth/signin & error.
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      // Must be 'credentials' — auth-astro's client only routes this id to the
      // callback endpoint (which runs authorize); any other id hits /signin/*.
      id: 'credentials',
      name: 'Login code',
      credentials: {
        email: { type: 'text' },
        code: { type: 'text' },
        name: { type: 'text' },
        phone: { type: 'text' },
      },
      authorize: async (creds) => {
        const email = typeof creds?.email === 'string' ? creds.email : null;
        const code = typeof creds?.code === 'string' ? creds.code : null;
        // Sign-up sends the captured name + phone; verify stamps them on a
        // newly created user.
        const name = typeof creds?.name === 'string' && creds.name.trim() ? creds.name.trim() : null;
        const phone =
          typeof creds?.phone === 'string' && creds.phone.trim() ? creds.phone.trim() : null;
        if (!email || !code) return null;
        const base =
          process.env.API_BASE_URL ?? import.meta.env.API_BASE_URL ?? 'http://localhost:3001';
        const res = await fetch(`${base}/v1/auth/code/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            code,
            ...(name ? { name } : {}),
            ...(phone ? { phone } : {}),
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          user: { id: string; email: string; name: string | null; phone?: string | null };
          workspaces: Array<{ tenantId: string; role: string; workspaceName: string }>;
        };
        const active = data.workspaces[0];
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name ?? undefined,
          phone: data.user.phone ?? null,
          workspaces: data.workspaces,
          activeTenantId: active?.tenantId ?? null,
          role: active?.role ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          workspaces?: unknown;
          activeTenantId?: string | null;
          role?: string | null;
          phone?: string | null;
        };
        token.userId = u.id;
        token.workspaces = u.workspaces;
        token.activeTenantId = u.activeTenantId;
        token.role = u.role;
        token.phone = u.phone;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string;
        (session.user as { phone?: string | null }).phone = (token.phone as string | null) ?? null;
      }
      const s = session as typeof session & {
        activeTenantId?: string | null;
        role?: string | null;
        workspaces?: unknown;
      };
      s.activeTenantId = (token.activeTenantId as string | null) ?? null;
      s.role = (token.role as string | null) ?? null;
      s.workspaces = token.workspaces;
      return session;
    },
  },
});
