/**
 * imageSourceTabs.test.tsx — cobertura aislada de `eb.image.sources` (F2a).
 *
 * `ImageSourceTabs` solo aparece en el árbol completo del editor dentro del picker de imagen
 * del Inspector, que requiere un bloque Image seleccionado y arrastre/fetch de galería —
 * demasiado costoso de montar fielmente en jsdom/happy-dom sin backend. Se renderiza el
 * componente en aislamiento con props sintéticas mínimas, que es exactamente su contrato
 * público (`tabs`, `defaultTab`): suficiente para verificar que el atributo `data-tour` está
 * presente y único, sin acoplarse a `ImageInput`/`BackgroundImageInput`.
 *
 * La cobertura de "aparece en el árbol real del editor al seleccionar una Image y abrir su
 * picker" queda para el e2e de F6 (Playwright), como documenta
 * `tourAnchors.render.test.tsx`.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ImageSourceTabs from '../src/components/ImageSourceTabs';
import { EMAIL_BUILDER_TOUR_ANCHORS } from '../src/tour/tourAnchors';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function queryAllByTour(key: string): Element[] {
  return Array.from(container.querySelectorAll(`[data-tour="${key}"]`));
}

describe('ImageSourceTabs — ancla eb.image.sources', () => {
  it('expone el ancla una vez con un único tab visible (sin strip)', () => {
    act(() => {
      root.render(
        <ImageSourceTabs
          tabs={[{ key: 'upload', label: 'Upload', visible: true, render: () => <div>upload</div> }]}
        />,
      );
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.imageSources)).toHaveLength(1);
  });

  it('expone el ancla una vez con varios tabs visibles (con strip)', () => {
    act(() => {
      root.render(
        <ImageSourceTabs
          tabs={[
            { key: 'gallery', label: 'Gallery', visible: true, render: () => <div>gallery</div> },
            { key: 'upload', label: 'Upload', visible: true, render: () => <div>upload</div> },
          ]}
        />,
      );
    });

    expect(queryAllByTour(EMAIL_BUILDER_TOUR_ANCHORS.imageSources)).toHaveLength(1);
  });
});
