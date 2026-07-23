import React from 'react';
import { createRoot } from 'react-dom/client';

import WhatsAppBuilder from '../src/index';
import '../src/global.css';

/**
 * Standalone dev harness — run `pnpm --dir packages/whatsapp-builder-standalone dev`
 * (or `npm run dev` from the package) to work on the editor in isolation:
 * no host app, no auth, no site. Saves/autosaves log to the console.
 */

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WhatsAppBuilder
      height="100vh"
      businessName="Maildrill"
      onSave={(doc) => console.info('[wa-builder] save', doc)}
      onAutoSave={(doc) => console.info('[wa-builder] autosave', doc)}
    />
  </React.StrictMode>
);
