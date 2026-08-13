/**
 * Seed one product Template row per Maildrill Components Library gallery email.
 *
 * Sources (repo):
 *   packages/email-builder-standalone/src/App/ComponentsLibrary/templates/
 *     json/*.json  → builderDoc
 *     html/*.html  → html (+ subject from <title>)
 *
 * Run alone (does not wipe other tenant data):
 *   pnpm --filter workers db:seed:gallery
 *
 * Also invoked from the full `db:seed` after the channel demo templates.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, inArray } from 'drizzle-orm';

import { db, templates, tenants } from './index';

const TARGET_TENANT_NAME = 'team@laravel42.com';

const HERE = dirname(fileURLToPath(import.meta.url));
const GALLERY_ROOT = resolve(
  HERE,
  '../../../../packages/email-builder-standalone/src/App/ComponentsLibrary/templates',
);

type GalleryMeta = {
  nn: string;
  slug: string;
  name: string;
  description: string;
  /** Product gallery category vocabulary. */
  category: 'Newsletter' | 'Promotional' | 'Transactional';
};

/** Mirrors scripts/import-maildrill-templates.mjs META (+ product categories). */
export const GALLERY_TEMPLATE_META: GalleryMeta[] = [
  {
    nn: '01',
    slug: 'business',
    name: 'Business',
    description: 'Quarterly review letter',
    category: 'Newsletter',
  },
  {
    nn: '02',
    slug: 'technology',
    name: 'Technology',
    description: 'Product launch',
    category: 'Promotional',
  },
  {
    nn: '03',
    slug: 'ai',
    name: 'AI',
    description: 'Capability announcement',
    category: 'Newsletter',
  },
  {
    nn: '04',
    slug: 'saas',
    name: 'SaaS',
    description: 'Welcome / onboarding',
    category: 'Transactional',
  },
  {
    nn: '05',
    slug: 'marketing',
    name: 'Marketing',
    description: 'Campaign performance report',
    category: 'Newsletter',
  },
  {
    nn: '06',
    slug: 'social-media',
    name: 'Social Media',
    description: 'Community roundup',
    category: 'Newsletter',
  },
  {
    nn: '07',
    slug: 'finance',
    name: 'Finance',
    description: 'Statement',
    category: 'Transactional',
  },
  {
    nn: '08',
    slug: 'healthcare',
    name: 'Healthcare',
    description: 'Appointment reminder',
    category: 'Transactional',
  },
  {
    nn: '09',
    slug: 'education',
    name: 'Education',
    description: 'Term enrollment',
    category: 'Transactional',
  },
  {
    nn: '10',
    slug: 'food',
    name: 'Food',
    description: 'Menu & recipe letter',
    category: 'Promotional',
  },
  {
    nn: '11',
    slug: 'travel',
    name: 'Travel',
    description: 'Itinerary confirmation',
    category: 'Transactional',
  },
  {
    nn: '12',
    slug: 'nature',
    name: 'Nature',
    description: 'Impact report',
    category: 'Newsletter',
  },
  {
    nn: '13',
    slug: 'architecture',
    name: 'Architecture',
    description: 'Project showcase',
    category: 'Newsletter',
  },
  {
    nn: '14',
    slug: 'backgrounds',
    name: 'Backgrounds',
    description: 'Asset pack release',
    category: 'Promotional',
  },
  {
    nn: '15',
    slug: 'abstract',
    name: 'Abstract',
    description: 'Print drop',
    category: 'Promotional',
  },
  {
    nn: '16',
    slug: 'textures',
    name: 'Textures',
    description: 'Material pack release',
    category: 'Promotional',
  },
  {
    nn: '17',
    slug: 'people',
    name: 'People',
    description: 'Culture & hiring note',
    category: 'Newsletter',
  },
  {
    nn: '18',
    slug: 'lifestyle',
    name: 'Lifestyle',
    description: 'Editorial promotion',
    category: 'Promotional',
  },
  { nn: '19', slug: 'sports', name: 'Sports', description: 'Match day', category: 'Promotional' },
  {
    nn: '20',
    slug: 'holidays',
    name: 'Holidays',
    description: 'Seasonal promotion',
    category: 'Promotional',
  },
];

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = m?.[1]?.trim();
  return title || null;
}

function loadGalleryFiles(meta: GalleryMeta): {
  builderDoc: Record<string, unknown>;
  html: string;
  subject: string;
} {
  const jsonPath = join(GALLERY_ROOT, 'json', `${meta.nn}-${meta.slug}.json`);
  const htmlPath = join(GALLERY_ROOT, 'html', `${meta.nn}-${meta.slug}.html`);
  if (!existsSync(jsonPath)) {
    throw new Error(`Missing gallery JSON: ${jsonPath}`);
  }
  if (!existsSync(htmlPath)) {
    throw new Error(`Missing gallery HTML: ${htmlPath}`);
  }
  const builderDoc = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
  const html = readFileSync(htmlPath, 'utf8');
  const subject = extractTitle(html) ?? `${meta.name}: ${meta.description}`;
  return { builderDoc, html, subject };
}

/**
 * Replace any prior rows with the same gallery names for `tenantId`, then
 * insert one email template per gallery file (builderDoc + html).
 */
export async function seedGalleryTemplates(tenantId: string): Promise<number> {
  if (!existsSync(GALLERY_ROOT)) {
    throw new Error(`Gallery templates directory not found: ${GALLERY_ROOT}`);
  }

  const names = GALLERY_TEMPLATE_META.map((m) => m.name);
  await db
    .delete(templates)
    .where(and(eq(templates.tenantId, tenantId), inArray(templates.name, names)));

  const values = GALLERY_TEMPLATE_META.map((meta) => {
    const { builderDoc, html, subject } = loadGalleryFiles(meta);
    return {
      tenantId,
      name: meta.name,
      channel: 'email' as const,
      subject,
      preheader: meta.description,
      html,
      text: null,
      builderDoc,
      category: meta.category,
      favorite: meta.nn === '01',
    };
  });

  await db.insert(templates).values(values);
  return values.length;
}

async function main() {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, TARGET_TENANT_NAME))
    .limit(1);
  if (!tenant) {
    console.error(`Tenant "${TARGET_TENANT_NAME}" not found — run db:seed first.`);
    process.exit(1);
  }
  const n = await seedGalleryTemplates(tenant.id);
  console.log(`seeded ${n} gallery email templates for ${TARGET_TENANT_NAME}`);
  process.exit(0);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
