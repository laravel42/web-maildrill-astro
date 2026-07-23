import { registerBlock, registerButton } from '@/core/registry';

import { bodyAuthPlugin, footerAuthPlugin } from './auth-blocks';
import { bodyPlugin } from './body';
import { catalogPlugin, flowPlugin, mpmPlugin, otpPlugin } from './buttons/advanced';
import { copyCodePlugin, phoneButtonPlugin, quickReplyPlugin, urlButtonPlugin } from './buttons/basic';
import { footerPlugin } from './footer';
import { headerLocationPlugin } from './header-location';
import { headerDocumentPlugin, headerImagePlugin, headerVideoPlugin } from './header-media';
import { headerTextPlugin } from './header-text';

/**
 * Register every built-in plugin. Adding a future Meta component means
 * adding a plugin file and one line here — nothing else changes.
 */
let registered = false;

export function registerBuiltInPlugins(): void {
  if (registered) return;
  registered = true;

  registerBlock(headerTextPlugin);
  registerBlock(headerImagePlugin);
  registerBlock(headerVideoPlugin);
  registerBlock(headerDocumentPlugin);
  registerBlock(headerLocationPlugin);
  registerBlock(bodyPlugin);
  registerBlock(bodyAuthPlugin);
  registerBlock(footerPlugin);
  registerBlock(footerAuthPlugin);

  registerButton(quickReplyPlugin);
  registerButton(urlButtonPlugin);
  registerButton(phoneButtonPlugin);
  registerButton(copyCodePlugin);
  registerButton(otpPlugin);
  registerButton(flowPlugin);
  registerButton(catalogPlugin);
  registerButton(mpmPlugin);
}
