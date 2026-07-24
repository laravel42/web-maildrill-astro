/**
 * Few-shot learning system for AI template generation
 * Selects relevant examples based on prompt similarity
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

interface FewShotExample {
  prompt: string;
  output: string;
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
}

// Simple keyword-based similarity scoring
export function calculateSimilarity(prompt1: string, prompt2: string): number {
  const words1 = prompt1.toLowerCase().split(/\s+/);
  const words2 = prompt2.toLowerCase().split(/\s+/);

  const commonWords = words1.filter((word) => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;

  return commonWords.length / totalWords;
}

// Extract category from prompt
export function categorizePrompt(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes('newsletter') || lower.includes('boletín')) return 'newsletter';
  if (lower.includes('bienvenida') || lower.includes('welcome')) return 'welcome';
  if (lower.includes('ecommerce') || lower.includes('tienda')) return 'ecommerce';
  if (lower.includes('evento') || lower.includes('event')) return 'event';
  if (lower.includes('corporativo') || lower.includes('corporate')) return 'corporate';
  if (lower.includes('hero') || lower.includes('banner') || lower.includes('fondo')) return 'hero';

  return 'general';
}

// Determine complexity from prompt
export function assessComplexity(prompt: string): 'simple' | 'medium' | 'complex' {
  const lower = prompt.toLowerCase();
  const complexityIndicators = [
    'múltiples',
    'multiple',
    'varios',
    'complex',
    'complejo',
    'secciones',
    'sections',
    'columnas',
    'columns',
    'avanzado',
  ];

  const simpleIndicators = ['simple', 'básico', 'basic', 'rápido', 'quick'];

  if (simpleIndicators.some((word) => lower.includes(word))) return 'simple';
  if (complexityIndicators.some((word) => lower.includes(word))) return 'complex';
  return 'medium';
}

class FewShotSelector {
  private examples: FewShotExample[] = [];

  constructor() {
    this.loadExamples();
  }

  private loadExamples() {
    // Load from presets directory - adjust path to be relative to project root
    const presetsDir = join(process.cwd(), '../../skills/email-builder/references/presets');

    // Add hardcoded examples with backgroundImage patterns
    this.addHardcodedExamples();

    try {
      const files = readdirSync(presetsDir).filter((f) => f.endsWith('.ndjson'));

      for (const file of files) {
        try {
          const content = readFileSync(join(presetsDir, file), 'utf-8');
          const lines = content.split('\n').filter((line) => line.trim());

          // Extract prompt from filename or first comment
          const prompt = this.extractPromptFromFile(file, lines);
          if (prompt) {
            this.examples.push({
              prompt,
              output: content,
              category: categorizePrompt(prompt),
              complexity: assessComplexity(prompt),
            });
          }
        } catch (error) {
          console.warn(`Failed to load preset ${file}:`, error);
        }
      }

      console.log(`Loaded ${this.examples.length} few-shot examples`);
    } catch (error) {
      console.warn('Failed to load presets directory:', error);
    }
  }

  private addHardcodedExamples() {
    // Hero with full backgroundImage container — most common visual hero.
    this.examples.push({
      prompt: 'Email con hero banner y imagen de fondo',
      category: 'hero',
      complexity: 'medium',
      output: `{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#F5F5F5","canvasColor":"#FFFFFF","textColor":"#1A1A1A","fontFamily":"LATO","childrenIds":["block-1","block-2"],"linkGlobal":{"linkColor":"#0066CC","underline":true}}}}
{"id":"block-1","block":{"type":"Container","data":{"style":{"backgroundImage":"https://picsum.photos/seed/hero-banner/1200/600","backgroundColor":"#1A1A1A","padding":{"top":80,"bottom":80,"right":40,"left":40},"mobilePadding":{"top":60,"bottom":60,"right":24,"left":24}},"props":{"childrenIds":["block-3","block-4","block-5"]}}}}
{"id":"block-3","block":{"type":"NotionText","data":{"style":{"fontSize":48,"fontWeight":"bold","color":"#FFFFFF","textAlign":"center","padding":{"top":0,"bottom":16,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":16,"right":0,"left":0}},"props":{"html":"Bienvenido a Nuestra Plataforma"}}}}
{"id":"block-4","block":{"type":"NotionText","data":{"style":{"fontSize":20,"color":"#E5E5E5","textAlign":"center","padding":{"top":0,"bottom":24,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":24,"right":0,"left":0}},"props":{"html":"Descubre todas las funcionalidades que tenemos para ti"}}}}
{"id":"block-5","block":{"type":"Button","data":{"style":{"backgroundColor":null,"textAlign":"center","padding":{"top":0,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0},"borderRadius":8},"props":{"buttonBackgroundColor":"#0066CC","buttonTextColor":"#FFFFFF","fullWidth":false,"text":"Comenzar Ahora","url":"#"}}}}
{"id":"block-2","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":40,"bottom":40,"right":24,"left":24},"mobilePadding":{"top":40,"bottom":40,"right":24,"left":24}},"props":{"childrenIds":["block-6"]}}}}`,
    });

    // Newsletter with section background image.
    this.examples.push({
      prompt: 'Newsletter con sección de imagen de fondo',
      category: 'newsletter',
      complexity: 'medium',
      output: `{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#F8F9FA","canvasColor":"#FFFFFF","textColor":"#212529","fontFamily":"INTER","childrenIds":["block-1","block-2","block-3"],"linkGlobal":{"linkColor":"#007BFF","underline":true}}}}
{"id":"block-1","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":32,"bottom":32,"right":24,"left":24},"mobilePadding":{"top":32,"bottom":32,"right":24,"left":24}},"props":{"childrenIds":["block-4"]}}}}
{"id":"block-4","block":{"type":"NotionText","data":{"style":{"fontSize":32,"fontWeight":"bold","color":"#212529","textAlign":"center","padding":{"top":0,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"Newsletter Mensual"}}}}
{"id":"block-2","block":{"type":"Container","data":{"style":{"backgroundImage":"https://picsum.photos/seed/newsletter-bg/1200/400","backgroundColor":"#007BFF","padding":{"top":60,"bottom":60,"right":40,"left":40},"mobilePadding":{"top":40,"bottom":40,"right":24,"left":24}},"props":{"childrenIds":["block-5","block-6"]}}}}
{"id":"block-5","block":{"type":"NotionText","data":{"style":{"fontSize":28,"fontWeight":"bold","color":"#FFFFFF","textAlign":"center","padding":{"top":0,"bottom":16,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":16,"right":0,"left":0}},"props":{"html":"Artículo Destacado del Mes"}}}}
{"id":"block-6","block":{"type":"NotionText","data":{"style":{"fontSize":16,"color":"#F8F9FA","textAlign":"center","padding":{"top":0,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"Descubre las últimas tendencias y novedades en nuestro sector"}}}}
{"id":"block-3","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":40,"bottom":40,"right":24,"left":24},"mobilePadding":{"top":40,"bottom":40,"right":24,"left":24}},"props":{"childrenIds":["block-7"]}}}}`,
    });

    // Hero split 2-col (text left, image right) — alternative hero shape.
    this.examples.push({
      prompt: 'Email con hero dividido en dos columnas, texto izquierda imagen derecha',
      category: 'hero',
      complexity: 'medium',
      output: `{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#FAFAFA","canvasColor":"#FFFFFF","textColor":"#0F172A","fontFamily":"INTER","childrenIds":["block-1","block-2"],"linkGlobal":{"linkColor":"#6366F1","underline":false}}}}
{"id":"block-1","block":{"type":"ColumnsContainer","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":48,"bottom":48,"right":32,"left":32},"mobilePadding":{"top":40,"bottom":40,"right":20,"left":20}},"props":{"columnsCount":2,"fixedWidths":[300,300,null],"columnsGap":24,"columns":[{"childrenIds":["block-3","block-4","block-5"]},{"childrenIds":["block-6"]},{"childrenIds":[]}]}}}}
{"id":"block-3","block":{"type":"NotionText","data":{"style":{"fontSize":40,"fontWeight":"bold","color":"#0F172A","padding":{"top":0,"bottom":12,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":12,"right":0,"left":0}},"props":{"html":"Construye Más Rápido"}}}}
{"id":"block-4","block":{"type":"NotionText","data":{"style":{"fontSize":16,"color":"#475569","padding":{"top":0,"bottom":24,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":24,"right":0,"left":0}},"props":{"html":"Plataforma todo-en-uno para equipos modernos. Comienza gratis hoy mismo."}}}}
{"id":"block-5","block":{"type":"Button","data":{"style":{"backgroundColor":null,"textAlign":"left","padding":{"top":0,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0},"borderRadius":6},"props":{"buttonBackgroundColor":"#6366F1","buttonTextColor":"#FFFFFF","fullWidth":false,"text":"Probar Gratis","url":"#"}}}}
{"id":"block-6","block":{"type":"Image","data":{"style":{"padding":{"top":0,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"url":"https://picsum.photos/seed/hero-split/600/400","alt":"Producto","size":"fill","width":300,"sizeMobile":"fill","widthMobile":300}}}}
{"id":"block-2","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":32,"bottom":32,"right":24,"left":24},"mobilePadding":{"top":32,"bottom":32,"right":24,"left":24}},"props":{"childrenIds":[]}}}}`,
    });

    // Type-only editorial hero — no image, oversized typography.
    this.examples.push({
      prompt: 'Email editorial con hero tipográfico oversized sin imagen',
      category: 'hero',
      complexity: 'medium',
      output: `{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#FFFFFF","canvasColor":"#FFFFFF","textColor":"#000000","fontFamily":"PLAYFAIR_DISPLAY","childrenIds":["block-1","block-2"],"linkGlobal":{"linkColor":"#000000","underline":true}}}}
{"id":"block-1","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":96,"bottom":48,"right":40,"left":40},"mobilePadding":{"top":64,"bottom":40,"right":24,"left":24}},"props":{"childrenIds":["block-3","block-4","block-5","block-6"]}}}}
{"id":"block-3","block":{"type":"NotionText","data":{"style":{"fontSize":13,"fontWeight":"bold","color":"#737373","textAlign":"center","padding":{"top":0,"bottom":24,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":24,"right":0,"left":0}},"props":{"html":"VOLUMEN 12 · ENERO"}}}}
{"id":"block-4","block":{"type":"NotionText","data":{"style":{"fontSize":64,"fontWeight":"bold","color":"#000000","textAlign":"center","lineHeight":"1.05","padding":{"top":0,"bottom":24,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":24,"right":0,"left":0}},"props":{"html":"El Año Que Viene"}}}}
{"id":"block-5","block":{"type":"Divider","data":{"style":{"backgroundColor":null,"padding":{"top":0,"bottom":24,"right":80,"left":80},"mobilePadding":{"top":0,"bottom":24,"right":40,"left":40}},"props":{"lineColor":"#000000","lineHeight":2}}}}
{"id":"block-6","block":{"type":"NotionText","data":{"style":{"fontSize":18,"color":"#262626","textAlign":"center","lineHeight":"1.6","padding":{"top":0,"bottom":0,"right":40,"left":40},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"Una mirada profunda a las tendencias que definirán los próximos doce meses."}}}}
{"id":"block-2","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":40,"bottom":40,"right":40,"left":40},"mobilePadding":{"top":32,"bottom":32,"right":24,"left":24}},"props":{"childrenIds":[]}}}}`,
    });

    // Hero card overlay — image background with floating card on top.
    this.examples.push({
      prompt: 'Email con hero de imagen completa y tarjeta superpuesta',
      category: 'hero',
      complexity: 'complex',
      output: `{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#0F172A","canvasColor":"#FFFFFF","textColor":"#0F172A","fontFamily":"INTER","childrenIds":["block-1","block-2"],"linkGlobal":{"linkColor":"#0EA5E9","underline":false}}}}
{"id":"block-1","block":{"type":"Container","data":{"style":{"backgroundImage":"https://picsum.photos/seed/lifestyle-hero/1200/700","backgroundColor":"#0F172A","padding":{"top":120,"bottom":40,"right":40,"left":40},"mobilePadding":{"top":80,"bottom":24,"right":20,"left":20}},"props":{"childrenIds":["block-3"]}}}}
{"id":"block-3","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":32,"bottom":32,"right":32,"left":32},"mobilePadding":{"top":24,"bottom":24,"right":20,"left":20},"borderRadius":12},"props":{"childrenIds":["block-4","block-5","block-6"]}}}}
{"id":"block-4","block":{"type":"NotionText","data":{"style":{"fontSize":13,"fontWeight":"bold","color":"#0EA5E9","padding":{"top":0,"bottom":8,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":8,"right":0,"left":0}},"props":{"html":"NUEVA COLECCIÓN"}}}}
{"id":"block-5","block":{"type":"NotionText","data":{"style":{"fontSize":32,"fontWeight":"bold","color":"#0F172A","padding":{"top":0,"bottom":12,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":12,"right":0,"left":0}},"props":{"html":"Verano 2026"}}}}
{"id":"block-6","block":{"type":"Button","data":{"style":{"backgroundColor":null,"textAlign":"left","padding":{"top":12,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":12,"bottom":0,"right":0,"left":0},"borderRadius":6},"props":{"buttonBackgroundColor":"#0F172A","buttonTextColor":"#FFFFFF","fullWidth":false,"text":"Ver colección","url":"#"}}}}
{"id":"block-2","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":40,"bottom":40,"right":24,"left":24},"mobilePadding":{"top":32,"bottom":32,"right":20,"left":20}},"props":{"childrenIds":[]}}}}`,
    });

    // Compact transactional banner strip — utility / receipt / OTP shape.
    this.examples.push({
      prompt: 'Email transaccional compacto con banner superior y mensaje principal',
      category: 'transactional',
      complexity: 'simple',
      output: `{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#F4F4F5","canvasColor":"#FFFFFF","textColor":"#18181B","fontFamily":"INTER","childrenIds":["block-1","block-2","block-3"],"linkGlobal":{"linkColor":"#3B82F6","underline":true}}}}
{"id":"block-1","block":{"type":"ColumnsContainer","data":{"style":{"backgroundColor":"#18181B","padding":{"top":16,"bottom":16,"right":24,"left":24},"mobilePadding":{"top":12,"bottom":12,"right":16,"left":16}},"props":{"columnsCount":2,"fixedWidths":[80,420,null],"columnsGap":16,"columns":[{"childrenIds":["block-4"]},{"childrenIds":["block-5"]},{"childrenIds":[]}]}}}}
{"id":"block-4","block":{"type":"Image","data":{"style":{"padding":{"top":0,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"url":"https://placehold.co/120x32?text=Acme","alt":"Acme","size":"scale","scale":40,"width":80,"sizeMobile":"scale","scaleMobile":40,"widthMobile":80}}}}
{"id":"block-5","block":{"type":"NotionText","data":{"style":{"fontSize":13,"color":"#A1A1AA","textAlign":"right","padding":{"top":8,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":8,"bottom":0,"right":0,"left":0}},"props":{"html":"Recibo · 20 May 2026"}}}}
{"id":"block-2","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":40,"bottom":40,"right":32,"left":32},"mobilePadding":{"top":32,"bottom":32,"right":20,"left":20}},"props":{"childrenIds":["block-6","block-7"]}}}}
{"id":"block-6","block":{"type":"NotionText","data":{"style":{"fontSize":24,"fontWeight":"bold","color":"#18181B","padding":{"top":0,"bottom":12,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":12,"right":0,"left":0}},"props":{"html":"Pago confirmado"}}}}
{"id":"block-7","block":{"type":"NotionText","data":{"style":{"fontSize":15,"color":"#52525B","lineHeight":"1.55","padding":{"top":0,"bottom":0,"right":0,"left":0},"mobilePadding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"Hemos procesado tu pago de USD 49.00. Encontrarás los detalles completos en tu panel."}}}}
{"id":"block-3","block":{"type":"Container","data":{"style":{"backgroundColor":"#FFFFFF","padding":{"top":24,"bottom":40,"right":32,"left":32},"mobilePadding":{"top":20,"bottom":32,"right":20,"left":20}},"props":{"childrenIds":[]}}}}`,
    });
  }

  private extractPromptFromFile(filename: string, _lines: string[]): string | null {
    // Try to extract from filename
    const nameMap: Record<string, string> = {
      '01-welcome-email': 'Email de bienvenida simple y profesional',
      '02-editorial-newsletter': 'Newsletter editorial con artículos y contenido',
      '03-ecommerce-receipt': 'Recibo de compra ecommerce con detalles del pedido',
      '04-saas-subscription': 'Confirmación de suscripción SaaS',
      '05-reservation-reminder': 'Recordatorio de reserva con detalles',
      '06-post-metrics': 'Reporte de métricas y estadísticas',
      '07-inquiry-response': 'Respuesta a consulta de cliente',
      '08-product-launch': 'Anuncio de lanzamiento de producto',
    };

    const baseName = filename.replace('.ndjson', '');
    return nameMap[baseName] || null;
  }

  /**
   * Pick the few-shot examples to embed in the system prompt.
   *
   * The selection is a hybrid:
   *   1. Deterministic: best-matching example by category + similarity.
   *   2. Diversity-driven: at least one example with `backgroundImage`,
   *      ROTATED by `seed` so successive generations of the same prompt
   *      see a different visual hero shape. Without rotation the
   *      "ensure backgroundImage" branch always returned index 0,
   *      making every visual prompt copy the same hero structure.
   *
   * @param seed Optional 0–999 integer. When provided, drives the
   *   rotation of the backgroundImage example. When omitted, falls back
   *   to index 0 (legacy behaviour).
   */
  selectExamples(userPrompt: string, maxExamples: number = 2, seed?: number): FewShotExample[] {
    const category = categorizePrompt(userPrompt);
    const complexity = assessComplexity(userPrompt);

    // Score examples by relevance
    const scored = this.examples.map((example) => ({
      example,
      score: this.calculateRelevanceScore(userPrompt, example, category, complexity),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Ensure at least one example with backgroundImage for visual variety
    const selected: FewShotExample[] = [];
    const backgroundImageExamples = scored.filter((item) => item.example.output.includes('backgroundImage'));

    // Always include at least one background image example if available.
    // Rotate by seed so successive generations see different hero shapes
    // for the same prompt. Different multipliers per role keep adjacent
    // seeds from collapsing onto the same example.
    if (backgroundImageExamples.length > 0) {
      const idx = seed !== undefined ? Math.abs(seed * 31) % backgroundImageExamples.length : 0;
      selected.push(backgroundImageExamples[idx].example);
    }

    // Fill remaining slots with best scoring examples
    const remaining = maxExamples - selected.length;
    const otherExamples = scored.filter((item) => !selected.includes(item.example)).slice(0, remaining);

    selected.push(...otherExamples.map((item) => item.example));

    return selected.slice(0, maxExamples);
  }

  private calculateRelevanceScore(
    userPrompt: string,
    example: FewShotExample,
    userCategory: string,
    userComplexity: string
  ): number {
    let score = 0;

    // Text similarity (40% weight)
    score += calculateSimilarity(userPrompt, example.prompt) * 0.4;

    // Category match (35% weight)
    if (example.category === userCategory) {
      score += 0.35;
    } else if (userCategory === 'general') {
      score += 0.1; // Slight bonus for general prompts
    }

    // Complexity match (25% weight)
    if (example.complexity === userComplexity) {
      score += 0.25;
    } else if (
      (userComplexity === 'medium' && example.complexity !== 'simple') ||
      (userComplexity === 'complex' && example.complexity !== 'simple')
    ) {
      score += 0.1; // Prefer more complex examples for complex prompts
    }

    // Boost background image examples for visual prompts
    const userLower = userPrompt.toLowerCase();
    const hasVisualKeywords =
      userLower.includes('visual') ||
      userLower.includes('atractivo') ||
      userLower.includes('impactante') ||
      userLower.includes('banner') ||
      userLower.includes('hero') ||
      userLower.includes('fondo');

    if (hasVisualKeywords && example.output.includes('backgroundImage')) {
      score += 0.3; // Strong boost for visual prompts + background examples
    }

    // For newsletters, occasionally prefer background image examples
    if (userCategory === 'newsletter' && example.category === 'hero' && Math.random() > 0.5) {
      score += 0.2; // Random boost to mix in hero examples
    }

    return score;
  }

  formatExamplesForPrompt(examples: FewShotExample[], hasPool: boolean): string {
    if (examples.length === 0) return '';

    let formatted = '\n## EJEMPLOS DE REFERENCIA:\n\n';

    if (hasPool) {
      formatted +=
        'NOTA: Los ejemplos siguientes usan tokens `@unsplash:N` en lugar de URLs literales — TU output DEBE hacer lo mismo. Cuando veas `@unsplash:0`, `@unsplash:1`, etc. en el campo `url` o `backgroundImage`, copia ese formato exacto y elige el índice del IMAGE_POOL que mejor se ajuste al propósito del bloque.\n\n';
    }

    examples.forEach((example, index) => {
      formatted += `### Ejemplo ${index + 1}: ${example.prompt}\n`;
      formatted += '```ndjson\n';
      const body = example.output.trim();
      formatted += hasPool ? rewritePicsumUrlsToTokens(body) : body;
      formatted += '\n```\n\n';
    });

    formatted += '## INSTRUCCIONES:\n';
    formatted += 'Sigue EXACTAMENTE el formato NDJSON de los ejemplos anteriores. ';
    formatted += 'Cada línea debe ser un objeto JSON válido independiente.\n\n';

    return formatted;
  }
}

/**
 * Rewrite every literal `https://picsum.photos/seed/{slug}/{w}/{h}` URL in
 * an NDJSON example to a `@unsplash:N` token, preserving slug → token
 * stability so the same example produces the same indices on every call.
 *
 * Why we do this at format-time and not at preset-author time: most of the
 * curated `presets/*.ndjson` files were authored before the IMAGE_POOL
 * existed and ship picsum URLs. Rewriting at runtime keeps the examples
 * consistent with the pool-mode instructions without forcing a one-time
 * migration of every preset on disk.
 *
 * The rewrite is purely lexical — it does NOT validate token range
 * against the actual pool size. The system prompt's IMAGE_POOL section is
 * what tells the LLM how many slots are available; the few-shot examples
 * just demonstrate the format.
 */
function rewritePicsumUrlsToTokens(ndjson: string): string {
  const PICSUM_RE = /https:\/\/picsum\.photos\/seed\/[^/\s"]+\/\d+(?:[/x]\d+)?/g;
  const PLACEHOLD_RE = /https:\/\/placehold\.co\/[^"\s]+/g;
  const seen = new Map<string, string>();
  let counter = 0;
  const tokenFor = (url: string): string => {
    const existing = seen.get(url);
    if (existing !== undefined) return existing;
    const token = `@unsplash:${counter}`;
    counter += 1;
    seen.set(url, token);
    return token;
  };
  return ndjson.replace(PICSUM_RE, tokenFor).replace(PLACEHOLD_RE, tokenFor);
}

// Singleton instance
let fewShotSelector: FewShotSelector | null = null;

export function getFewShotSelector(): FewShotSelector {
  if (!fewShotSelector) {
    fewShotSelector = new FewShotSelector();
  }
  return fewShotSelector;
}

export function generateFewShotPrompt(
  userPrompt: string,
  maxExamples: number = 2,
  hasPool: boolean = false,
  seed?: number
): string {
  const selector = getFewShotSelector();
  const examples = selector.selectExamples(userPrompt, maxExamples, seed);
  return selector.formatExamplesForPrompt(examples, hasPool);
}
