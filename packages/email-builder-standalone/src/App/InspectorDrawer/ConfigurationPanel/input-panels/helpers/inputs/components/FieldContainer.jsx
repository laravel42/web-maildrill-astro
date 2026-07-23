import React from 'react';

/**
 * Lightweight vertical stack used by inspector inputs.
 *
 * Note: render `{children}` directly instead of `children.map(...)`.
 * React already accepts both a single element and an array of elements,
 * but `.map` on a single child throws `children.map is not a function`.
 */
const FieldContainer = ({ children }) => {
  // No gap here — LabelProperty now owns the label-to-control spacing via its
  // own 6px margin-bottom, so stacking a gap on top of that would double it.
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>;
};

export default FieldContainer;
