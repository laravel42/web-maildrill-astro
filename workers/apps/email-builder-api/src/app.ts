import type { FastifyInstance } from 'fastify';

import { agentPlugin } from './routes/agent.js';
import { aiImageGeneratePlugin } from './routes/ai-image-generate.js';
import { aiTextProcessPlugin } from './routes/ai-text-process.js';
import { devSaveLayoutPlugin } from './routes/dev-save-layout.js';
import { devSavePrimitivePlugin } from './routes/dev-save-primitive.js';
import { devSaveSectionPlugin } from './routes/dev-save-section.js';
import { devSaveTemplatePlugin } from './routes/dev-save-template.js';
import { devSaveThemePlugin } from './routes/dev-save-theme.js';
import { devTemplateSeedsPlugin } from './routes/dev-template-seeds.js';
import { generatePlugin } from './routes/generate.js';
import { generateThemePlugin } from './routes/generate-theme.js';
import { imagesPlugin } from './routes/images.js';
import { improvePromptPlugin } from './routes/improve-prompt.js';
import { visualBriefPlugin } from './routes/visual-brief.js';

/**
 * Every EmailBuilder route, as one encapsulated Fastify plugin.
 *
 * Kept separate from the standalone entrypoint so the same routes can be
 * mounted inside the unified dev server without starting a second process or
 * inheriting that server's validator compiler — these routes validate with
 * their own zod instance inside the handlers, never via Fastify's `schema`.
 *
 * The `/api` prefix matches what the editor calls, so the browser path
 * `/api/eb/*` proxied by the frontend lands on `/api/*` here unchanged.
 */
export async function emailBuilderRoutes(app: FastifyInstance): Promise<void> {
  await app.register(generatePlugin, { prefix: '/api' });
  await app.register(generateThemePlugin, { prefix: '/api' });
  await app.register(imagesPlugin, { prefix: '/api' });
  await app.register(improvePromptPlugin, { prefix: '/api/improve-prompt' });
  await app.register(visualBriefPlugin, { prefix: '/api' });
  await app.register(agentPlugin, { prefix: '/api' });
  await app.register(aiImageGeneratePlugin, { prefix: '/api' });
  await app.register(aiTextProcessPlugin, { prefix: '/api' });

  // Authoring helpers used by the editor's dev tooling; unprefixed by design.
  await app.register(devSaveSectionPlugin);
  await app.register(devSavePrimitivePlugin);
  await app.register(devSaveLayoutPlugin);
  await app.register(devSaveTemplatePlugin);
  await app.register(devSaveThemePlugin);
  await app.register(devTemplateSeedsPlugin);
}

/** Feature flags the editor reads from the health endpoint. */
export function emailBuilderHealth(): Record<string, unknown> {
  return {
    status: 'ok',
    features: {
      dedupStrategy: 'remap-duplicate-ids',
      skillCache: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled',
      qualityExpectations: 'v1',
      agent: {
        audit: true,
        critique: true,
        refineBrief: true,
        designCraft: 'impeccable-v1',
      },
    },
  };
}
