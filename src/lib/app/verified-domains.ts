/** Session cache + broadcast for verified sending domains (campaign wizard From). */

const STORAGE_KEY = 'maildrill:verified-domains';
export const VERIFIED_DOMAINS_EVENT = 'maildrill:verified-domains';

/** Active (verified) domain names, lowercased and sorted for the From select. */
export function verifiedDomainNames(
  domains: ReadonlyArray<{ domainName: string; active: boolean }>,
): string[] {
  return domains
    .filter((d) => d.active)
    .map((d) => d.domainName.toLowerCase())
    .sort();
}

export function readVerifiedDomainsCache(): string[] | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw == null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((d): d is string => typeof d === 'string');
  } catch {
    return undefined;
  }
}

/** Persist and notify listeners (campaigns board, other tabs via `storage`). */
export function writeVerifiedDomainsCache(domains: string[]): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
    } catch {
      /* quota / private mode — in-memory listeners still get the event */
    }
  }
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VERIFIED_DOMAINS_EVENT, { detail: { domains } }));
}

export function subscribeVerifiedDomainsCache(onChange: (domains: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onEvent = (e: Event) => {
    const domains = (e as CustomEvent<{ domains?: string[] }>).detail?.domains;
    if (domains) onChange(domains);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || e.newValue == null) return;
    try {
      const parsed: unknown = JSON.parse(e.newValue);
      if (Array.isArray(parsed)) {
        onChange(parsed.filter((d): d is string => typeof d === 'string'));
      }
    } catch {
      /* ignore corrupt writes */
    }
  };

  window.addEventListener(VERIFIED_DOMAINS_EVENT, onEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(VERIFIED_DOMAINS_EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
  };
}
