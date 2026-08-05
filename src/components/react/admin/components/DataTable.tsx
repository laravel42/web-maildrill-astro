import { useMemo, useState } from 'react';
import { fmtInt } from '@/lib/app/admin-data';
import type { Column } from '../types';
import styles from '../AppAdmin.module.css';

export function DataTable<T>({
  columns,
  rows,
  onRow,
  minWidth,
  pageSize,
  emptyText = 'No results match your filters.',
}: {
  columns: Column<T>[];
  rows: T[];
  onRow?: (row: T) => void;
  minWidth?: number;
  pageSize?: number;
  emptyText?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, dir, columns]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const clamped = Math.min(page, pageCount - 1);
  const view = pageSize ? sorted.slice(clamped * pageSize, clamped * pageSize + pageSize) : sorted;

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    if (sortKey === col.key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(col.key);
      setDir('desc');
    }
  };

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table} style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.align === 'right' ? styles.th_right : ''}${
                    c.sortValue ? ` ${styles.thSort}` : ''
                  }`}
                  style={{ minWidth: c.minWidth }}
                  onClick={() => toggleSort(c)}
                >
                  {c.header}
                  {sortKey === c.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((row, i) => (
              <tr key={i} onClick={onRow ? () => onRow(row) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? styles.td_right : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className={styles.empty}>{emptyText}</div>}
      {pageSize && rows.length > pageSize && (
        <div className={styles.pager}>
          <span className="tnum">
            {clamped * pageSize + 1}–{Math.min(sorted.length, (clamped + 1) * pageSize)} of{' '}
            {fmtInt(sorted.length)}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="sbtn"
              style={{ padding: '6px 10px' }}
              disabled={clamped === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="sbtn"
              style={{ padding: '6px 10px' }}
              disabled={clamped >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
