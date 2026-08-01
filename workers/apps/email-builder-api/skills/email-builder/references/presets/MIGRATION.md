# Preset Migration Requirements

This document outlines the mandatory migration steps for any preset extracted from `email-builder-templates.json` or other legacy sources.

## Overview

All presets must pass through a migration pipeline to ensure compatibility with the current Email Builder system. This is critical because legacy templates contain deprecated block types, themes, and incomplete data structures.

## Migration Pipeline

### 1. Legacy Block Type Migration

**Required transformations:**

| Legacy Type    | New Type     | Notes                                                        |
| -------------- | ------------ | ------------------------------------------------------------ |
| `CustomEditor` | `NotionText` | Rich text editor migration (only remaining legacy migrator). |

`Wysiwyg`, `Text`, and `Avatar` were retired in commit `e9493ce` — they are no longer migrated and will be silently dropped if encountered.

### 2. Theme Migration

**SocialMedia block themes:**

| Legacy Theme     | New Theme                    | Description                    |
| ---------------- | ---------------------------- | ------------------------------ |
| `"circle-white"` | `"negative"`                 | White icons on dark background |
| `"circle-black"` | `"positive"`                 | Dark icons on light background |
| `"square-*"`     | `"negative"` or `"positive"` | Convert based on background    |

**Valid themes:** `"positive"`, `"negative"`, `"brand"`

### 3. Padding Completion

**All blocks must have complete padding objects:**

```typescript
// ❌ Incomplete (legacy)
padding: { top: 16, bottom: 16 }

// ✅ Complete (required)
padding: { top: 16, bottom: 16, right: 0, left: 0 }
```

**Missing sides default to `0`.**

### 4. Validation Requirements

All migrated presets MUST pass:

```typescript
import { EditorConfigurationSchema } from '@eb/document-core';

const result = EditorConfigurationSchema.safeParse(migratedTemplate);
if (!result.success) {
  throw new Error('Migration failed validation');
}
```

## Implementation

### Automated Migration Script

Use the migration utilities in `packages/backend/scripts/curate-presets/`:

```typescript
import { migrateTemplate } from './migrate-template.js';
import { validateTemplate } from './validate-template.js';

// 1. Load legacy template
const legacy = JSON.parse(legacyTemplateJson);

// 2. Migrate
const migrated = migrateTemplate(legacy);

// 3. Validate
const validation = validateTemplate(migrated);
if (!validation.success) {
  console.error('Migration failed:', validation.errors);
  return;
}

// 4. Save as NDJSON
await saveAsNDJSON(migrated, outputPath);
```

### Manual Review Checklist

After automated migration, verify:

- [ ] All blocks have valid `type` from allowed list
- [ ] No `CustomEditor` blocks remain (only the migrator should ever see them)
- [ ] SocialMedia themes are `positive`, `negative`, or `brand`
- [ ] All padding objects have 4 sides (top, bottom, right, left)
- [ ] FontFamily matches archetype table (A-P)
- [ ] Colors align with archetype palette
- [ ] Template passes `EditorConfigurationSchema` validation

## Common Migration Issues

### 1. Invalid Block Types

**Problem:** Legacy templates may contain block types not in the current system.

**Solution:** Map to nearest equivalent or remove if no mapping exists.

### 2. Incomplete Style Objects

**Problem:** Missing required style properties.

**Solution:** Add defaults based on block type requirements.

### 3. Malformed URLs

**Problem:** Invalid or broken image URLs.

**Solution:** Replace with appropriate placeholders or Picsum URLs.

### 4. Font Family Mismatches

**Problem:** Legacy templates using fonts not in archetype table.

**Solution:** Map to closest archetype font:

- Sans-serif → `MONTSERRAT`, `LATO`, `OPEN_SANS`, or `MODERN_SANS`
- Serif → `PLAYFAIR` or `MERRIWEATHER`
- Display → `OSWALD`

## Quality Standards

### Archetype Alignment

Each preset should clearly map to one of the 16 archetipos (A-P):

| Archetype | Font       | Use Case             |
| --------- | ---------- | -------------------- |
| A         | MONTSERRAT | SaaS/Onboarding      |
| B         | PLAYFAIR   | Editorial/Newsletter |
| C         | OSWALD     | Ecommerce/Flash Sale |
| ...       | ...        | ...                  |

### Visual Consistency

- **Colors:** Use archetype palette or harmonious variations
- **Spacing:** Consistent padding/margins throughout
- **Typography:** Appropriate font sizes (14-16px body, 24-48px headers)
- **Imagery:** Semantic Picsum seeds or placeholder URLs

## Testing

### Validation Test

```bash
cd packages/backend
pnpm tsx scripts/validate-preset.ts path/to/preset.ndjson
```

### Generation Test

```bash
cd packages/backend
pnpm tsx scripts/test-preset-generation.ts preset-slug
```

### Edge Case Test

```bash
cd packages/backend
pnpm tsx scripts/audit-edge-cases.ts
```

## File Structure

Migrated presets should follow this structure:

```
skills/email-builder/references/presets/
├── 01-saas-onboarding.ndjson
├── 02-editorial-newsletter.ndjson
├── ...
├── 16-activation-reengagement.ndjson
├── index.json                    # Metadata index
└── README.md                     # This file
```

## Maintenance

### Adding New Presets

1. Extract from source (email-builder-templates.json or manual creation)
2. Run migration pipeline
3. Validate against schema
4. Test generation
5. Update index.json
6. Add to system prompt context loader

### Updating Existing Presets

1. Modify NDJSON file
2. Re-validate
3. Test generation
4. Update metadata if needed

---

## References

- [Email Builder Block Types](../SKILL.md)
- [Archetype Table](../../../packages/backend/src/context/system-prompt.ts)
- [Validation Schema](../../../packages/document-core/src/schema.ts)
- [Migration Scripts](../../../packages/backend/scripts/curate-presets/)
