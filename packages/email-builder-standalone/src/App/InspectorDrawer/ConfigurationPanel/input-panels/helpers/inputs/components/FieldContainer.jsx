import React from 'react';

/**
 * Lightweight vertical stack used by inspector inputs.
 *
 * Note: render `{children}` directly instead of `children.map(...)`.
 * React already accepts both a single element and an array of elements,
 * but `.map` on a single child throws `children.map is not a function`.
 */
const FieldContainer = ({ children }) => {
  // 4px: the label already carries its own small bottom margin, and anything
  // larger reads as a gap rather than a label attached to its control.
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>{children}</div>;
};

export default FieldContainer;
