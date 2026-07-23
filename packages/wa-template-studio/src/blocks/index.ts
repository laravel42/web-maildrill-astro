import { registerBlock, registerButton } from '@/core/registry';

import { bodyAuthPlugin, footerAuthPlugin } from './auth-blocks';
import { bodyPlugin } from './body';
import { catalogPlugin, flowPlugin, mpmPlugin, otpPlugin } from './buttons/advanced';
import { copyCodePlugin, phoneButtonPlugin, urlButtonPlugin } from './buttons/basic';
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

  // Quick reply is intentionally NOT registered by default (product
  // decision) — the plugin still ships; hosts can opt back in with
  // `registerButton(quickReplyPlugin)` from the package root.
  registerButton(urlButtonPlugin);
  registerButton(phoneButtonPlugin);
  registerButton(copyCodePlugin);
  registerButton(otpPlugin);
  registerButton(flowPlugin);
  registerButton(catalogPlugin);
  registerButton(mpmPlugin);
}
