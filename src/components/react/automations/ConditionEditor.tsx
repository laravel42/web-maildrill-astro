import Icon from '../Icon';
import {
  OPERATOR_GROUPS,
  OPERATOR_LABELS,
  SINGLE_VALUE_OPERATORS,
  type BranchCondition,
  type BranchOperator,
  type ConditionGroups,
} from '@/lib/app/automation-flow';
import styles from './ConditionEditor.module.css';

/**
 * Condition builder for a branch path.
 *
 * The nesting reads the way the engine evaluates it: rows inside a group are ANDed, groups
 * are ORed. Making that visible ("and" between rows, an explicit "or" divider between
 * groups) is the difference between a rule people trust and one they guess at.
 */
export default function ConditionEditor({
  value,
  onChange,
  onInsertData,
}: {
  value: ConditionGroups;
  onChange: (next: ConditionGroups) => void;
  /** Opens the data picker bound to a specific field. */
  onInsertData?: (apply: (expression: string) => void) => void;
}) {
  const groups = value.length > 0 ? value : [[]];

  const patch = (groupIndex: number, rowIndex: number, next: Partial<BranchCondition>) => {
    const copy = groups.map((group) => group.map((row) => ({ ...row })));
    const row = copy[groupIndex]?.[rowIndex];
    if (!row) return;
    Object.assign(row, next);
    onChange(copy);
  };

  const addRow = (groupIndex: number) => {
    const copy = groups.map((group) => group.map((row) => ({ ...row })));
    copy[groupIndex]?.push({ firstValue: '', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '' });
    onChange(copy);
  };

  const removeRow = (groupIndex: number, rowIndex: number) => {
    const copy = groups.map((group) => group.map((row) => ({ ...row })));
    copy[groupIndex]?.splice(rowIndex, 1);
    onChange(copy.filter((group) => group.length > 0));
  };

  const addGroup = () => {
    onChange([...groups, [{ firstValue: '', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '' }]]);
  };

  return (
    <div className={styles.wrap}>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {groupIndex > 0 ? <div className={styles.or}>or</div> : null}
          <div className={styles.group}>
            {group.length === 0 ? (
              <p className={styles.hint}>No conditions yet — this path will never be taken.</p>
            ) : null}
            {group.map((row, rowIndex) => {
              const singleValue = SINGLE_VALUE_OPERATORS.includes(row.operator);
              return (
                <div key={rowIndex} className={styles.row}>
                  {rowIndex > 0 ? <span className={styles.and}>and</span> : null}
                  <div className={styles.fields}>
                    <div className={styles.fieldWithButton}>
                      <input
                        type="text"
                        className={styles.input}
                        value={row.firstValue}
                        placeholder="{{trigger.subscriber.email}}"
                        aria-label="Value to test"
                        onChange={(e) =>
                          patch(groupIndex, rowIndex, { firstValue: e.target.value })
                        }
                      />
                      {onInsertData ? (
                        <button
                          type="button"
                          className={styles.insert}
                          aria-label="Insert data"
                          onClick={() =>
                            onInsertData((expression) =>
                              patch(groupIndex, rowIndex, {
                                firstValue: `${row.firstValue}${expression}`,
                              }),
                            )
                          }
                        >
                          <Icon name="variable" size={14} />
                        </button>
                      ) : null}
                    </div>
                    <select
                      className={styles.select}
                      value={row.operator}
                      aria-label="Comparison"
                      onChange={(e) =>
                        patch(groupIndex, rowIndex, { operator: e.target.value as BranchOperator })
                      }
                    >
                      {OPERATOR_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.operators.map((operator) => (
                            <option key={operator} value={operator}>
                              {OPERATOR_LABELS[operator]}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {!singleValue ? (
                      <input
                        type="text"
                        className={styles.input}
                        value={row.secondValue ?? ''}
                        placeholder="Compare with…"
                        aria-label="Comparison value"
                        onChange={(e) =>
                          patch(groupIndex, rowIndex, { secondValue: e.target.value })
                        }
                      />
                    ) : (
                      <span className={styles.noValue}>no value needed</span>
                    )}
                    <button
                      type="button"
                      className="kbtn"
                      aria-label="Remove condition"
                      onClick={() => removeRow(groupIndex, rowIndex)}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className={styles.addRow} onClick={() => addRow(groupIndex)}>
              <Icon name="plus" size={13} /> And…
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={styles.addGroup} onClick={addGroup}>
        <Icon name="plus" size={13} /> Or a different set of conditions
      </button>
    </div>
  );
}
