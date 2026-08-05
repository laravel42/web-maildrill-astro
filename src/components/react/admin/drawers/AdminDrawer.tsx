import type { Selection } from '../types';
import { WorkspaceDrawer } from './WorkspaceDrawer';
import { GenericDrawer } from './GenericDrawer';
import styles from '../AppAdmin.module.css';

export function AdminDrawer({
  selection,
  onClose,
}: {
  selection: Selection;
  onClose: () => void;
}) {
  return (
    <>
      <button type="button" className={styles.overlay} aria-label="Close" onClick={onClose} />
      {selection.kind === 'workspace' ? (
        <WorkspaceDrawer key={selection.data.id} w={selection.data} onClose={onClose} />
      ) : (
        <GenericDrawer s={selection} onClose={onClose} />
      )}
    </>
  );
}
