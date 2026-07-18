import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro 6+ deprecates the `z` re-export from `astro:content`; import it from
// `astro/zod` so the schema uses the same (Zod 4) instance Astro bundles.
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    heroImage: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string(),
    category: z.string(),
    draft: z.boolean().default(false),
    readingMinutes: z.number().int().positive(),
    series: z.string().optional(),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedDate: z.coerce.date(),
    kicker: z.string(),
    noun: z.string(),
  }),
});

export const collections = { blog, guides, legal };
