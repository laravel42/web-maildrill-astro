# Maildrill gallery templates

Source of truth for the 20 Components Library templates.

| Path    | Role                                               |
| ------- | -------------------------------------------------- |
| `html/` | Send-ready HTML (from MaildrillTemplates archive)  |
| `json/` | Flat email-builder documents (`Record<id, block>`) |

Regenerate JSON, AI presets, and `localPresets.data.json` templates:

```bash
node --import ./node_modules/tsx/dist/esm/index.mjs scripts/import-maildrill-templates.mjs
# or: ./node_modules/.bin/tsx scripts/import-maildrill-templates.mjs
```
