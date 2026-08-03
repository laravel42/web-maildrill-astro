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
        ticket: { type: 'text' },
      },
      authorize: async (creds, request) => {
        const base =
          process.env.API_BASE_URL ?? import.meta.env.API_BASE_URL ?? 'http://localhost:3001';
        // Real browser context for the session registry: nginx/Cloudflare set
        // x-forwarded-for; the UA is the browser's own header.
        const fwd = request?.headers?.get?.('x-forwarded-for') ?? '';
        const clientHeaders: Record<string, string> = { 'content-type': 'application/json' };
        const ip = fwd.split(',')[0]?.trim();
        if (ip) clientHeaders['x-client-ip'] = ip;
        const ua = request?.headers?.get?.('user-agent');
        if (ua) clientHeaders['x-client-ua'] = ua;

        const shapeUser = (data: {
          user: { id: string; email: string; name: string | null; phone?: string | null };
          workspaces: Array<{ tenantId: string; role: string; workspaceName: string }>;
          session?: { id: string; amr: string[] };
        }) => {
          const active = data.workspaces[0];
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? undefined,
            phone: data.user.phone ?? null,
            workspaces: data.workspaces,
            activeTenantId: active?.tenantId ?? null,
            role: active?.role ?? null,
            sessionId: data.session?.id ?? null,
            amr: data.session?.amr ?? ['code'],
          };
        };

        // Path 1 — one-time login ticket minted by the BFF sign-in flow
        // (pre-verified code, completed 2FA challenge, or passkey assertion).
        const ticket = typeof creds?.ticket === 'string' ? creds.ticket : null;
        if (ticket) {
          const res = await fetch(`${base}/v1/auth/ticket/exchange`, {
            method: 'POST',
            headers: clientHeaders,
            body: JSON.stringify({ ticket }),
          });
          if (!res.ok) return null;
          return shapeUser(await res.json());
        }

        // Path 2 — direct email + code (magic-link landing, e2e setup). Fails
        // closed for accounts with 2FA enabled: the service answers with a
        // challenge shape instead of an identity, and no session is created.
        const email = typeof creds?.email === 'string' ? creds.email : null;
        const code = typeof creds?.code === 'string' ? creds.code : null;
        // Sign-up sends the captured name + phone; verify stamps them on a
        // newly created user.
        const name =
          typeof creds?.name === 'string' && creds.name.trim() ? creds.name.trim() : null;
        const phone =
          typeof creds?.phone === 'string' && creds.phone.trim() ? creds.phone.trim() : null;
        if (!email || !code) return null;
        // A trusted device lets a 2FA account through this path (the cookie is
        // HttpOnly; only its hash ever leaves this server).
        const cookies = request?.headers?.get?.('cookie') ?? '';
        const tdMatch = /(?:^|;\s*)md_td=([^;]+)/.exec(cookies);
        const res = await fetch(`${base}/v1/auth/code/verify`, {
          method: 'POST',
          headers: clientHeaders,
          body: JSON.stringify({
            email,
            code,
            ...(name ? { name } : {}),
            ...(phone ? { phone } : {}),
            ...(tdMatch?.[1] ? { trustedDeviceToken: decodeURIComponent(tdMatch[1]) } : {}),
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as
          Parameters<typeof shapeUser>[0] | { requiresSecondFactor: true };
        if ('requiresSecondFactor' in data) return null;
        return shapeUser(data);
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
          sessionId?: string | null;
          amr?: string[] | null;
        };
        token.userId = u.id;
        token.workspaces = u.workspaces;
        token.activeTenantId = u.activeTenantId;
        token.role = u.role;
        token.phone = u.phone;
        // Server-side session row id — lets one session be revoked without
        // touching the others, despite the JWT being stateless.
        token.sid = u.sessionId ?? null;
        token.amr = u.amr ?? null;
        // Capture login instant for "sign out everywhere" (compare to sessionsRevokedAt).
        token.authTime = Math.floor(Date.now() / 1000);
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
        authTime?: number | null;
        sid?: string | null;
        amr?: string[] | null;
      };
      s.activeTenantId = (token.activeTenantId as string | null) ?? null;
      s.role = (token.role as string | null) ?? null;
      s.workspaces = token.workspaces;
      s.authTime =
        typeof token.authTime === 'number'
          ? token.authTime
          : typeof token.iat === 'number'
            ? token.iat
            : null;
      s.sid = (token.sid as string | null) ?? null;
      s.amr = (token.amr as string[] | null) ?? null;
      return session;
    },
  },
});
