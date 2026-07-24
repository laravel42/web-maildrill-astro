export type LabelValues = Record<string, string | number>;

function keyOf(name: string, labels?: LabelValues): string {
  if (!labels) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${String(labels[k])}"`);
  return parts.length ? `${name}{${parts.join(",")}}` : name;
}

/**
 * Minimal in-process metrics registry that renders Prometheus-compatible text.
 * Deliberately dependency-free; swap for prom-client if/when scraping is wired.
 */
class Registry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly counterNames = new Set<string>();
  private readonly gaugeNames = new Set<string>();

  inc(name: string, labels?: LabelValues, value = 1): void {
    this.counterNames.add(name);
    const k = keyOf(name, labels);
    this.counters.set(k, (this.counters.get(k) ?? 0) + value);
  }

  setGauge(name: string, value: number, labels?: LabelValues): void {
    this.gaugeNames.add(name);
    this.gauges.set(keyOf(name, labels), value);
  }

  render(): string {
    const lines: string[] = [];
    for (const name of this.counterNames) {
      lines.push(`# TYPE ${name} counter`);
      for (const [k, v] of this.counters) {
        if (k === name || k.startsWith(`${name}{`)) lines.push(`${k} ${v}`);
      }
    }
    for (const name of this.gaugeNames) {
      lines.push(`# TYPE ${name} gauge`);
      for (const [k, v] of this.gauges) {
        if (k === name || k.startsWith(`${name}{`)) lines.push(`${k} ${v}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }
}

export const metrics = new Registry();
