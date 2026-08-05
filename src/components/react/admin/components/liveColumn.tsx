import type { Column } from '../types';
import type { LiveToggles } from '../useLiveToggles';
import { Toggle } from './Primitives';

/** Builds a right-aligned "Live" toggle column for CMS-style tables. */
export function liveColumn<T extends { live: boolean }>(
  toggles: LiveToggles,
  keyOf: (row: T) => string,
  header = 'Live',
): Column<T> {
  return {
    key: 'live',
    header,
    align: 'right',
    render: (row) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Toggle
          on={toggles.isLive(keyOf(row), row.live)}
          onClick={() => toggles.toggleLive(keyOf(row), row.live)}
        />
      </div>
    ),
  };
}
