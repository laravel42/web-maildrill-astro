import * as React from 'react';

import {
  buildSubscriberFieldOptions,
  type SubscriberCustomField,
  type SubscriberFieldOption,
} from '@/core/subscriber-fields';

/**
 * Load workspace custom fields from the host BFF (`/api/v1/custom-fields`) and
 * merge them with the core subscriber fields (name, email, phone).
 */
export function useSubscriberFields(): SubscriberFieldOption[] {
  const [customFields, setCustomFields] = React.useState<SubscriberCustomField[]>([]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/v1/custom-fields');
        if (!res.ok) return;
        const json = (await res.json()) as { data?: SubscriberCustomField[] };
        if (alive && Array.isArray(json.data)) setCustomFields(json.data);
      } catch {
        // No session or API unreachable — core fields still work.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return React.useMemo(() => buildSubscriberFieldOptions(customFields), [customFields]);
}
