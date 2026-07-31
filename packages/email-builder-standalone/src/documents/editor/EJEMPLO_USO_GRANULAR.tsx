/**
 * EJEMPLOS DE USO DE LA ARQUITECTURA GRANULAR
 *
 * Este archivo contiene ejemplos prácticos de cómo usar la nueva arquitectura
 * de actualizaciones granulares en componentes reales.
 */

import React, { useState } from 'react';

import type { TEditorBlock } from './core';
import {
  atomicOptimisticUpdate,
  atomicUpdateBlockProp,
  useBlockPropGranular,
  useBlockPropsMultiple,
  useBlockPropWithUpdater,
  useBlockUpdater,
} from './granular';

// ============================================================================
// EJEMPLO 1: Input Simple con Debounce
// ============================================================================

/**
 * Input de texto que solo se re-renderiza cuando cambia el texto
 * Usa actualización granular para máxima eficiencia
 */
export function TextInputGranular({ blockId }: { blockId: string }) {
  // Hook combinado: lectura + escritura
  const [text, setText] = useBlockPropWithUpdater<string>(blockId, 'text');

  // Estado local para actualización optimista
  const [localValue, setLocalValue] = useState(text);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Actualización optimista: UI se actualiza inmediatamente
    setLocalValue(newValue);

    // Actualización del store con debounce (implementado en el hook)
    setText(newValue);
  };

  return (
    <input type="text" value={localValue} onChange={handleChange} placeholder="Escribe algo..." />
  );
}

// ============================================================================
// EJEMPLO 2: Formulario con Múltiples Campos
// ============================================================================

/**
 * Formulario que edita múltiples props del bloque
 * Usa batch updates para eficiencia
 */
export function BlockFormGranular({ blockId }: { blockId: string }) {
  // Leer múltiples props con un solo re-render
  const props = useBlockPropsMultiple<{
    text: string;
    color: string;
    fontSize: number;
    fontWeight: string;
  }>(blockId, ['text', 'color', 'fontSize', 'fontWeight']);

  // Funciones de actualización memoizadas
  const { batchUpdateProps } = useBlockUpdater(blockId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Actualizar todas las props a la vez (un solo re-render)
    batchUpdateProps({
      text: props.text,
      color: props.color,
      fontSize: props.fontSize,
      fontWeight: props.fontWeight,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Texto:</label>
        <input
          value={props.text || ''}
          onChange={(e) => batchUpdateProps({ text: e.target.value })}
        />
      </div>

      <div>
        <label>Color:</label>
        <input
          type="color"
          value={props.color || '#000000'}
          onChange={(e) => batchUpdateProps({ color: e.target.value })}
        />
      </div>

      <div>
        <label>Tamaño de fuente:</label>
        <input
          type="number"
          value={props.fontSize || 16}
          onChange={(e) => batchUpdateProps({ fontSize: Number(e.target.value) })}
        />
      </div>

      <div>
        <label>Peso de fuente:</label>
        <select
          value={props.fontWeight || 'normal'}
          onChange={(e) => batchUpdateProps({ fontWeight: e.target.value })}
        >
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
          <option value="lighter">Lighter</option>
        </select>
      </div>

      <button type="submit">Guardar</button>
    </form>
  );
}

// ============================================================================
// EJEMPLO 3: Toggle con Actualización Directa
// ============================================================================

/**
 * Toggle que actualiza una prop booleana
 * Usa actualización directa sin estado local
 */
export function BooleanToggleGranular({
  blockId,
  propName,
}: {
  blockId: string;
  propName: string;
}) {
  // Solo leer la prop específica
  const value = useBlockPropGranular<boolean>(blockId, propName);

  const handleToggle = () => {
    // Actualización directa y atómica
    atomicUpdateBlockProp(blockId, propName, !value);
  };

  return (
    <label>
      <input type="checkbox" checked={value || false} onChange={handleToggle} />
      {propName}
    </label>
  );
}

// ============================================================================
// EJEMPLO 4: Slider con Actualización en Tiempo Real
// ============================================================================

/**
 * Slider que actualiza un valor numérico en tiempo real
 * Muestra el valor actual mientras se arrastra
 */
export function SliderGranular({
  blockId,
  propName,
  min = 0,
  max = 100,
  step = 1,
}: {
  blockId: string;
  propName: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [value, setValue] = useBlockPropWithUpdater<number>(blockId, propName);

  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value || min}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <span>{value || min}</span>
    </div>
  );
}

// ============================================================================
// EJEMPLO 5: Selector de Color con Preview
// ============================================================================

/**
 * Selector de color que muestra preview en tiempo real
 * Usa actualización optimista para mejor UX
 */
export function ColorPickerGranular({ blockId, propName }: { blockId: string; propName: string }) {
  const [color, setColor] = useBlockPropWithUpdater<string>(blockId, propName);
  const [previewColor, setPreviewColor] = useState(color);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;

    // Preview inmediato
    setPreviewColor(newColor);

    // Actualización del store
    setColor(newColor);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <input type="color" value={previewColor || '#000000'} onChange={handleChange} />
      <div
        style={{
          width: '50px',
          height: '50px',
          backgroundColor: previewColor,
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      />
      <span>{previewColor}</span>
    </div>
  );
}

// ============================================================================
// EJEMPLO 6: Lista de Opciones con Actualización Batch
// ============================================================================

/**
 * Lista de checkboxes que actualiza múltiples props
 * Usa batch update para eficiencia
 */
export function CheckboxListGranular({
  blockId,
  options,
}: {
  blockId: string;
  options: Array<{ key: string; label: string }>;
}) {
  const props = useBlockPropsMultiple(
    blockId,
    options.map((opt) => opt.key),
  );
  const { batchUpdateProps } = useBlockUpdater(blockId);

  const handleToggle = (key: string) => {
    batchUpdateProps({
      [key]: !props[key],
    });
  };

  return (
    <div>
      {options.map((option) => (
        <label key={option.key} style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={Boolean(props[option.key])}
            onChange={() => handleToggle(option.key)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

// ============================================================================
// EJEMPLO 7: Actualización Optimista con Servidor
// ============================================================================

/**
 * Componente que guarda en servidor con actualización optimista
 * Muestra loading state y maneja errores con rollback
 */
export function SaveToServerGranular({ blockId }: { blockId: string }) {
  const [text, setText] = useBlockPropWithUpdater<string>(blockId, 'text');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Actualización optimista con rollback
    const rollback = atomicOptimisticUpdate(blockId, (block): TEditorBlock => {
      const props = block.data && 'props' in block.data ? block.data.props : undefined;
      return {
        ...block,
        data: {
          ...block.data,
          props: {
            ...(props as object),
            saving: true,
          },
        },
      } as TEditorBlock;
    });

    try {
      // Simular llamada al servidor
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simular error aleatorio
          if (Math.random() > 0.8) {
            reject(new Error('Error de red'));
          } else {
            resolve(true);
          }
        }, 1000);
      });

      // Éxito: marcar como guardado
      atomicUpdateBlockProp(blockId, 'saving', false);
      atomicUpdateBlockProp(blockId, 'lastSaved', new Date().toISOString());
    } catch (err) {
      // Error: hacer rollback
      rollback();
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <input value={text || ''} onChange={(e) => setText(e.target.value)} disabled={saving} />

      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar'}
      </button>

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}

// ============================================================================
// EJEMPLO 8: Componente de Solo Lectura (Sin Re-renders)
// ============================================================================

/**
 * Componente que solo muestra datos sin causar re-renders
 * Útil para displays que no necesitan actualizarse en tiempo real
 */
export function ReadOnlyDisplayGranular({ blockId }: { blockId: string }) {
  // Leer props sin suscribirse a cambios
  const { updateProp } = useBlockUpdater(blockId);

  const handleClick = () => {
    // Actualizar sin causar re-render de este componente
    updateProp('clicks', (clicks: number) => (clicks || 0) + 1);
  };

  return <button onClick={handleClick}>Click me (no re-renders)</button>;
}

// ============================================================================
// EJEMPLO 9: Componente con Validación
// ============================================================================

/**
 * Input con validación que solo actualiza si el valor es válido
 * Muestra errores sin actualizar el store
 */
export function ValidatedInputGranular({
  blockId,
  propName,
  validate,
}: {
  blockId: string;
  propName: string;
  validate: (value: string) => string | null;
}) {
  const [value, setValue] = useBlockPropWithUpdater<string>(blockId, propName);
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Validar
    const validationError = validate(newValue);
    setError(validationError);

    // Solo actualizar store si es válido
    if (!validationError) {
      setValue(newValue);
    }
  };

  return (
    <div>
      <input
        value={localValue}
        onChange={handleChange}
        style={{ borderColor: error ? 'red' : undefined }}
      />
      {error && <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>}
    </div>
  );
}

// ============================================================================
// EJEMPLO 10: Componente con Undo/Redo Local
// ============================================================================

/**
 * Editor con undo/redo local (independiente del global)
 * Útil para ediciones complejas antes de confirmar
 */
export function UndoableEditorGranular({ blockId }: { blockId: string }) {
  const [text, setText] = useBlockPropWithUpdater<string>(blockId, 'text');
  const [history, setHistory] = useState<string[]>([text]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const handleChange = (newValue: string) => {
    // Agregar a historial
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newValue);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Actualizar store
    setText(newValue);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setText(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setText(history[newIndex]);
    }
  };

  return (
    <div>
      <div>
        <button onClick={handleUndo} disabled={historyIndex === 0}>
          Undo
        </button>
        <button onClick={handleRedo} disabled={historyIndex === history.length - 1}>
          Redo
        </button>
      </div>

      <textarea
        value={text || ''}
        onChange={(e) => handleChange(e.target.value)}
        rows={5}
        style={{ width: '100%' }}
      />
    </div>
  );
}
