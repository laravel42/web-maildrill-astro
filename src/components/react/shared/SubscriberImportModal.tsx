import SubscriberEditorModal, {
  type SubscriberEditorValues,
} from '../SubscriberEditorModal';
import { ApiError } from '@/lib/app/api';
import { createSubscriber, importSubscribers } from '@/lib/app/subscriber-write';
import type { ApiSubscriber } from '@/lib/app/subscriber-map';
import type { SubscriberImportOutcome } from '@/lib/app/subscriber-import';

type Props = {
  lists: { id: string; name: string }[];
  customFieldKeys?: string[];
  /** `file` skips the method picker (list-detail Import button). */
  initialStep?: 'method' | 'file';
  /** Lists pre-checked on the single-add form. */
  initialListIds?: string[];
  /** Lists pre-checked on the import mapping step. */
  initialImportListIds?: string[];
  /** Hide the list picker — the caller already chose the destination list. */
  hideImportLists?: boolean;
  /** Demo/fixture mode — no API writes. */
  live?: boolean;
  onClose: () => void;
  /** After a file import lands (or a demo toast-only run). */
  onImported?: (outcome: SubscriberImportOutcome, newFields: string[]) => void | Promise<void>;
  /** After a single-person create. `created` is null in demo mode. */
  onCreated?: (
    created: ApiSubscriber | null,
    values: SubscriberEditorValues,
  ) => void | Promise<void>;
  onError?: (message: string) => void;
};

/**
 * Wired create / import wizard shared by Subscribers and list detail.
 * The UI lives in SubscriberEditorModal; this owns the API calls so both
 * screens stay in lockstep.
 */
export default function SubscriberImportModal({
  lists,
  customFieldKeys = [],
  initialStep = 'method',
  initialListIds = [],
  initialImportListIds = [],
  hideImportLists = false,
  live = true,
  onClose,
  onImported,
  onCreated,
  onError,
}: Props) {
  return (
    <SubscriberEditorModal
      mode="create"
      initialStep={initialStep}
      initialListIds={initialListIds}
      initialImportListIds={initialImportListIds}
      hideImportLists={hideImportLists}
      lists={lists}
      customFieldKeys={customFieldKeys}
      onClose={onClose}
      onImport={async (payload) => {
        if (!live) {
          const outcome = { created: payload.rows.length, updated: 0, failed: 0 };
          await onImported?.(outcome, payload.newFields);
          return outcome;
        }
        const outcome = await importSubscribers(payload);
        await onImported?.(outcome, payload.newFields);
        return outcome;
      }}
      onSave={async (values) => {
        try {
          if (!live) {
            await onCreated?.(null, values);
            onClose();
            return;
          }
          const created = await createSubscriber(values);
          await onCreated?.(created, values);
          onClose();
        } catch (e) {
          onError?.(e instanceof ApiError ? e.message : 'Could not add subscriber');
        }
      }}
    />
  );
}
