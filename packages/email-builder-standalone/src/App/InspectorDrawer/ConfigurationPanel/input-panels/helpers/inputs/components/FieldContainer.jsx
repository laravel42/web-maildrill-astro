import React from 'react';

/**
 * Lightweight vertical stack used by inspector inputs.
 *
 * Note: render `{children}` directly instead of `children.map(...)`.
 * React already accepts both a single element and an array of elements,
 * but `.map` on a single child throws `children.map is not a function`.
 */
const FieldContainer = ({ children }) => {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>{children}</div>;
};

export default FieldContainer;
