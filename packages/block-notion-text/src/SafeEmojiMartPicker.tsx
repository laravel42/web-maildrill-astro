import React, { useCallback, useEffect, useRef, useState } from 'react';

type EmojiMartPickerElement = HTMLElement & {
  update?: (props: Record<string, unknown>) => void;
  component?: unknown;
};

type SafeEmojiMartPickerProps = Record<string, unknown> & {
  fallback?: React.ReactNode;
};

const WEB_COMPONENT_TAG = 'em-emoji-picker';

const isBrowser = typeof window !== 'undefined';

const logPrefix = '[SafeEmojiMartPicker]';

const SafeEmojiMartPicker: React.FC<SafeEmojiMartPickerProps> = (props) => {
  const { fallback = null, ...pickerProps } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<EmojiMartPickerElement | null>(null);
  const latestPropsRef = useRef<Record<string, unknown>>(pickerProps);
  const [isReady, setIsReady] = useState(false);

  const applyProps = useCallback(() => {
    const picker = pickerRef.current;
    if (!picker) {
      return;
    }

    const currentProps = latestPropsRef.current;

    // Aplicar todas las props al elemento
    (Object.entries as (obj: Record<string, unknown>) => [string, unknown][])(currentProps).forEach(([key, value]) => {
      if (key === 'ref' || key === 'fallback') return;

      // Las funciones se asignan directamente como propiedades
      const pickerRecord = picker as unknown as Record<string, unknown>;
      if (typeof value === 'function') {
        pickerRecord[key] = value;
      } else {
        pickerRecord[key] = value;
      }
    });

    // Si el picker tiene método update, usarlo también
    if (picker.update) {
      picker.update(currentProps);
    }
  }, []);

  useEffect(() => {
    latestPropsRef.current = pickerProps;
    applyProps();
  }, [pickerProps, applyProps]);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let cancelled = false;
    const host = containerRef.current;
    if (!host) {
      return;
    }

    let pickerElement: EmojiMartPickerElement | null = null;

    const mount = async () => {
      try {
        await import('emoji-mart');
        if (cancelled) {
          console.log(logPrefix, 'Mount cancelled after import');
          return;
        }

        if (typeof customElements?.whenDefined === 'function') {
          await customElements.whenDefined(WEB_COMPONENT_TAG);
        }

        if (cancelled || !host) {
          console.log(logPrefix, 'Mount cancelled before element creation');
          return;
        }

        pickerElement = document.createElement(WEB_COMPONENT_TAG) as EmojiMartPickerElement;
        pickerRef.current = pickerElement;
        host.appendChild(pickerElement);

        const waitForComponent = () => {
          if (cancelled) return;
          if (!pickerElement) return;
          if (pickerElement.component) {
            applyProps();
            setIsReady(true);
            return;
          }

          requestAnimationFrame(waitForComponent);
        };

        waitForComponent();
      } catch (error) {
        console.error(logPrefix, 'Failed to load emoji-mart picker', error);
      }
    };

    mount();

    return () => {
      cancelled = true;
      setIsReady(false);
      pickerRef.current = null;
      if (pickerElement && host.contains(pickerElement)) {
        host.removeChild(pickerElement);
      }
    };
  }, [applyProps]);

  return <div ref={containerRef}>{!isReady && fallback}</div>;
};

export default SafeEmojiMartPicker;
