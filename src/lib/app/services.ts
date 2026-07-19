/**
 * Marketing-form stand-ins (sign-up, password reset, contact). The workspace
 * data services that used to live here were removed — the app reads/writes the
 * real API via the /api/v1 BFF proxy (see lib/app/api.ts and lib/server).
 */
const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockSignUp(_input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  await delay(500);
  return { ok: true };
}

export async function mockResetPassword(_email: string): Promise<{ ok: true }> {
  await delay(400);
  return { ok: true };
}

export async function mockContactSubmit(_input: {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  message: string;
}): Promise<{ ok: true }> {
  await delay(500);
  return { ok: true };
}
