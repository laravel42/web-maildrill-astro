/**
 * Sistema de Actualizaciones Granulares - Punto de entrada único
 *
 * Esta arquitectura permite actualizaciones instantáneas y modulares de bloques individuales
 * sin afectar el resto del documento, mejorando significativamente el performance.
 *
 * @example
 * ```tsx
 * import { useBlockPropGranular, atomicUpdateBlockProp } from './granular';
 *
 * function MyComponent({ blockId }) {
 *   // Solo se re-renderiza cuando cambia 'text'
 *   const text = useBlockPropGranular(blockId, 'text');
 *
 *   // Actualización instantánea y atómica
 *   const handleChange = (newText) => {
 *     atomicUpdateBlockProp(blockId, 'text', newText);
 *   };
 *
 *   return <input value={text} onChange={e => handleChange(e.target.value)} />;
 * }
 * ```
 */

// ============================================================================
// SELECTORES - Para leer datos de forma granular
// ============================================================================
export {
  selectBlock,
  selectBlockProps,
  selectBlockProp,
  selectBlockType,
  selectBlockStyles,
  selectBlockStyle,
  selectBlockChildren,
  selectIsBlockSelected,
  selectBlockExists,
  selectBlockTree,
  useBlockSelector,
  isSelectedBlockInColumnsSlot,
} from './blockSelectors';
export type { TreeNode } from './blockSelectors';

// ============================================================================
// ACTUALIZADORES - Para modificar datos de forma atómica
// ============================================================================
export {
  atomicUpdateBlock,
  atomicUpdateBlockProps,
  atomicUpdateBlockProp,
  atomicUpdateBlockStyles,
  atomicUpdateBlockStyle,
  atomicBatchUpdateProps,
  atomicBatchUpdateStyles,
  atomicConditionalUpdate,
  atomicOptimisticUpdate,
} from './blockUpdaters';

// ============================================================================
// HOOKS - Para usar en componentes React
// ============================================================================
export {
  useBlock,
  useBlockPropsGranular,
  useBlockPropGranular,
  useBlockTypeGranular,
  useBlockStylesGranular,
  useBlockStyleGranular,
  useBlockChildrenGranular,
  useIsBlockSelectedGranular,
  useBlockExistsGranular,
  useBlockUpdater,
  useBlockPropWithUpdater,
  useBlockStyleWithUpdater,
  useBlockPropsMultiple,
  useBlockStylesMultiple,
  useBlockObserver,
} from './blockHooks';

// ============================================================================
// GUÍA DE USO
// ============================================================================

/**
 * CUÁNDO USAR CADA HOOK:
 *
 * 1. useBlockPropGranular(blockId, 'propName')
 *    - Cuando necesitas UNA prop específica
 *    - Máxima granularidad, mínimos re-renders
 *    - Ejemplo: const text = useBlockPropGranular(blockId, 'text');
 *
 * 2. useBlockPropsGranular(blockId)
 *    - Cuando necesitas TODAS las props del bloque
 *    - Se re-renderiza cuando cambia cualquier prop
 *    - Ejemplo: const props = useBlockPropsGranular(blockId);
 *
 * 3. useBlockPropsMultiple(blockId, ['prop1', 'prop2'])
 *    - Cuando necesitas VARIAS props específicas
 *    - Un solo re-render cuando cambia cualquiera de ellas
 *    - Ejemplo: const { text, color } = useBlockPropsMultiple(blockId, ['text', 'color']);
 *
 * 4. useBlockPropWithUpdater(blockId, 'propName')
 *    - Cuando necesitas leer Y escribir una prop
 *    - Retorna [value, setValue] como useState
 *    - Ejemplo: const [text, setText] = useBlockPropWithUpdater(blockId, 'text');
 *
 * 5. useBlockUpdater(blockId)
 *    - Cuando solo necesitas funciones de actualización
 *    - No causa re-renders, solo retorna funciones memoizadas
 *    - Ejemplo: const { updateProp, batchUpdateProps } = useBlockUpdater(blockId);
 */

/**
 * CUÁNDO USAR CADA ACTUALIZADOR:
 *
 * 1. atomicUpdateBlockProp(blockId, 'propName', value)
 *    - Para actualizar UNA prop específica
 *    - Más rápido y eficiente
 *    - Ejemplo: atomicUpdateBlockProp(blockId, 'text', 'Hello');
 *
 * 2. atomicBatchUpdateProps(blockId, { prop1: value1, prop2: value2 })
 *    - Para actualizar MÚLTIPLES props a la vez
 *    - Un solo re-render en lugar de múltiples
 *    - Ejemplo: atomicBatchUpdateProps(blockId, { text: 'Hello', color: 'red' });
 *
 * 3. atomicUpdateBlockProps(blockId, (props) => ({ ...props, text: 'Hello' }))
 *    - Para actualizaciones basadas en el valor actual
 *    - Útil para transformaciones complejas
 *    - Ejemplo: atomicUpdateBlockProps(blockId, props => ({ ...props, count: props.count + 1 }));
 *
 * 4. atomicOptimisticUpdate(blockId, updater)
 *    - Para actualizaciones optimistas con rollback
 *    - Útil para operaciones asíncronas
 *    - Ejemplo: const rollback = atomicOptimisticUpdate(blockId, block => ({ ...block, loading: true }));
 */

/**
 * PATRONES RECOMENDADOS:
 *
 * ✅ CORRECTO - Actualización granular:
 * ```tsx
 * const text = useBlockPropGranular(blockId, 'text');
 * const handleChange = (newText) => atomicUpdateBlockProp(blockId, 'text', newText);
 * ```
 *
 * ❌ EVITAR - Actualización completa del documento:
 * ```tsx
 * const document = useDocument();
 * const handleChange = (newText) => {
 *   setDocument({ ...document, [blockId]: { ...document[blockId], data: { ...data, props: { ...props, text: newText } } } });
 * };
 * ```
 *
 * ✅ CORRECTO - Múltiples actualizaciones en batch:
 * ```tsx
 * atomicBatchUpdateProps(blockId, {
 *   text: 'Hello',
 *   color: 'red',
 *   fontSize: 16
 * });
 * ```
 *
 * ❌ EVITAR - Múltiples actualizaciones individuales:
 * ```tsx
 * atomicUpdateBlockProp(blockId, 'text', 'Hello');
 * atomicUpdateBlockProp(blockId, 'color', 'red');
 * atomicUpdateBlockProp(blockId, 'fontSize', 16);
 * ```
 */

/**
 * MIGRACIÓN DESDE LA API ANTIGUA:
 *
 * Antigua API → Nueva API Granular
 *
 * useBlockProps(blockId) → useBlockPropsGranular(blockId)
 * useBlockProp(blockId, 'prop') → useBlockPropGranular(blockId, 'prop')
 * updateBlockProp(blockId, 'prop', value) → atomicUpdateBlockProp(blockId, 'prop', value)
 * updateBlockProps(blockId, props) → atomicUpdateBlockProps(blockId, props)
 *
 * La API antigua sigue funcionando para compatibilidad hacia atrás,
 * pero se recomienda migrar a la nueva API para mejor performance.
 */
