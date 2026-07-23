import React from 'react';
import { createRoot } from 'react-dom/client';

import { Studio } from '../src';
import '../src/styles/studio.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ height: '100vh' }}>
      <Studio />
    </div>
  </React.StrictMode>
);
