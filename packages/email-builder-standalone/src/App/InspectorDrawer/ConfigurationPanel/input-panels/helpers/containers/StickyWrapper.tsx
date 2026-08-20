import React, { useEffect, useRef, useState } from 'react';

const StickyWrapper = ({
  children,
  topOffset = 0,
  zIndex = 10,
  className = '',
  style = {},
  disabled = false,
  threshold = null, // Nueva propiedad: selector CSS, ID o clase del elemento límite
  ...props
}) => {
  const [isSticky, setIsSticky] = useState(false);
  const [stickyDimensions, setStickyDimensions] = useState({ width: 0, height: 0 });
  const [_stickyPosition, setStickyPosition] = useState({ left: 0 });
  const [pushOffset, setPushOffset] = useState(0); // Nueva: offset para el efecto push
  const [isBeingPushed, setIsBeingPushed] = useState(false); // Nueva: estado de push
  const stickyRef = useRef(null);
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Si está deshabilitado, no hacer nada
    if (disabled) {
      setIsSticky(false);
      setIsBeingPushed(false);
      setPushOffset(0);
      return;
    }

    const sentinel = sentinelRef.current;
    const stickyElement = stickyRef.current;
    if (!sentinel || !stickyElement) return;

    // Obtener el elemento threshold si se proporciona
    let thresholdElement = null;
    if (threshold) {
      // Si threshold comienza con '#', es un ID
      if (threshold.startsWith('#')) {
        thresholdElement = document.getElementById(threshold.slice(1));
      }
      // Si threshold comienza con '.', es una clase
      else if (threshold.startsWith('.')) {
        thresholdElement = document.querySelector(threshold);
      }
      // Si no, asumimos que es un selector CSS válido
      else {
        thresholdElement = document.querySelector(threshold);
      }
    }

    // Función para actualizar dimensiones y posición
    const updateDimensionsAndPosition = () => {
      const rect = stickyElement.getBoundingClientRect();
      setStickyDimensions({
        width: rect.width,
        height: rect.height,
      });
      setStickyPosition({
        left: rect.left,
      });
    };

    // Función para calcular el push offset basado en la posición del threshold
    const calculatePushOffset = () => {
      if (!thresholdElement || !stickyElement) return { offset: 0, isPushed: false };

      const thresholdRect = thresholdElement.getBoundingClientRect();
      const stickyRect = stickyElement.getBoundingClientRect();
      const stickyBottom = topOffset + stickyRect.height;

      // Si el threshold está empujando el sticky
      if (thresholdRect.top < stickyBottom) {
        const pushDistance = stickyBottom - thresholdRect.top;
        const maxPushDistance = stickyRect.height + 20; // Un poco extra para que desaparezca completamente

        // Limitar el push para que no sea más que la altura del elemento
        const clampedPushDistance = Math.min(pushDistance, maxPushDistance);

        return {
          offset: -clampedPushDistance,
          isPushed: true,
        };
      }

      return { offset: 0, isPushed: false };
    };

    // Observer para detectar cuando activar sticky
    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldBeSticky = !entry.isIntersecting;

        if (shouldBeSticky && !isSticky) {
          // Capturar dimensiones y posición ANTES de hacer sticky
          updateDimensionsAndPosition();
        }

        setIsSticky(shouldBeSticky);

        // Si acabamos de activar sticky y hay threshold, calcular push inicial
        if (shouldBeSticky && threshold) {
          const { offset, isPushed } = calculatePushOffset();
          setPushOffset(offset);
          setIsBeingPushed(isPushed);
        } else if (!shouldBeSticky) {
          // Reset push state cuando no es sticky
          setPushOffset(0);
          setIsBeingPushed(false);
        }
      },
      {
        threshold: 0,
        rootMargin: `-${topOffset}px 0px 0px 0px`,
      },
    );

    // ResizeObserver: mantener dimensiones actualizadas SIEMPRE
    // (cuando el contenido cambia mientras está sticky, evitamos cortes)
    const resizeObserver = new ResizeObserver(() => {
      updateDimensionsAndPosition();
    });

    // Listener para scroll si hay threshold (para calcular push effect)
    const handleScroll = () => {
      if (threshold && isSticky) {
        const { offset, isPushed } = calculatePushOffset();
        setPushOffset(offset);
        setIsBeingPushed(isPushed);
      }
    };

    observer.observe(sentinel);
    resizeObserver.observe(stickyElement);

    if (threshold) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    // Actualizar dimensiones iniciales
    updateDimensionsAndPosition();

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      if (threshold) {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [topOffset, isSticky, disabled, threshold]);

  // Determinar si debe aplicar sticky (solo si no está deshabilitado)
  const shouldApplySticky = !disabled && isSticky;

  // Calcular la posición final del sticky considerando el push
  const finalTop = shouldApplySticky ? `${topOffset + pushOffset}px` : 'auto';

  return (
    <div ref={containerRef} className={className} {...props}>
      {/* Sentinel element para detectar cuando debe activarse sticky - solo si no está deshabilitado */}
      {!disabled && (
        <div
          ref={sentinelRef}
          style={{
            height: '1px',
            position: 'absolute',
            top: `-${topOffset + 1}px`,
            left: 0,
            right: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Placeholder para mantener el espacio cuando el elemento esté fixed */}
      {shouldApplySticky && (
        <div
          style={{
            height: `${stickyDimensions.height}px`,
            width: `${stickyDimensions.width}px`,
          }}
        />
      )}

      <div
        ref={stickyRef}
        style={{
          position: shouldApplySticky ? 'fixed' : 'static',
          top: finalTop,
          // No forzamos width/height aquí para permitir que el contenido
          // crezca naturalmente; el placeholder mantiene el espacio.
          // El ancho puede venir del style externo del consumidor.
          width: 'auto',
          // En estado sticky (fixed) dejamos que crezca con el contenido
          // (`auto`) y el placeholder mantiene el hueco. En estado estático
          // llenamos el alto del padre (`100%`) para que un hijo que pide una
          // altura acotada (p. ej. el InspectorDrawer con su `calc(100% - 4px)`
          // + `overflowY: auto` interno) la pueda resolver y haga scroll en vez
          // de desbordar. En contenedores de alto indefinido, `100%` computa
          // como `auto`, así que no cambia el comportamiento previo.
          height: shouldApplySticky ? 'auto' : '100%',
          minHeight: 0,
          zIndex: shouldApplySticky ? zIndex : 'auto',
          transition: isBeingPushed
            ? 'none' // Sin transición cuando está siendo empujado para movimiento fluido
            : 'box-shadow 0.2s ease-in-out, top 0.3s ease-out', // Transición suave al volver

          // Reducir opacidad cuando está muy empujado para efecto de desvanecimiento
          ...(isBeingPushed &&
            pushOffset < -stickyDimensions.height * 0.3 && {
              opacity: Math.max(
                0,
                1 + (pushOffset + stickyDimensions.height * 0.3) / (stickyDimensions.height * 0.7),
              ),
            }),
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default StickyWrapper;
