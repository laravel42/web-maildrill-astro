/**
 * Wrapper component for the standalone (Shadow DOM) build.
 * Injects styles into the shadow root and passes portalContainer to EmailBuilder.
 */
import React from 'react';

import styles from './global.css?inline';
import EmailBuilder, { type EmailBuilderProps } from './index';
import { ShadowDomProvider, useShadowContainer } from './ShadowDomProvider';

const EmailBuilderInner: React.FC<EmailBuilderProps> = (props) => {
  const container = useShadowContainer();
  return (
    <>
      <style>{styles}</style>
      <EmailBuilder {...props} portalContainer={container} />
    </>
  );
};

const EmailBuilderStandalone: React.FC<EmailBuilderProps> = (props) => (
  <ShadowDomProvider>
    <EmailBuilderInner {...props} />
  </ShadowDomProvider>
);

export default EmailBuilderStandalone;
