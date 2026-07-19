// Re-export for back-compat. `cleanDocument` moved to `@eb/email-builder`
// (Node-safe, shared by the HTML export and the Node renderer).
// See L42 Node HTML renderer work.
export { cleanDocument as default } from '@eb/email-builder';
