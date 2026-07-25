/**
 * Deterministic pseudo-random generator.
 *
 * Mock data must be stable across reloads — otherwise every refresh reshuffles
 * every table and the portal is impossible to demo or screenshot. A seeded
 * mulberry32 generator gives repeatable output with no dependency.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'number' ? seed >>> 0 : SeededRandom.hash(seed);
  }

  /** FNV-1a string hash, used to turn a label into a stable numeric seed. */
  static hash(input: string): number {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Float in [min, max] rounded to `decimals`. */
  float(min: number, max: number, decimals = 2): number {
    const value = this.next() * (max - min) + min;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  bool(trueProbability = 0.5): boolean {
    return this.next() < trueProbability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRandom.pick requires a non-empty array');
    }
    return items[this.int(0, items.length - 1)] as T;
  }

  /** `count` distinct members of `items` (or all of them when count is larger). */
  pickMany<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const output: T[] = [];
    const take = Math.min(count, pool.length);
    for (let index = 0; index < take; index++) {
      const [picked] = pool.splice(this.int(0, pool.length - 1), 1);
      if (picked !== undefined) {
        output.push(picked);
      }
    }
    return output;
  }

  /** Weighted pick — weights need not sum to 1. */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let threshold = this.next() * total;
    for (const entry of entries) {
      threshold -= entry.weight;
      if (threshold <= 0) {
        return entry.value;
      }
    }
    return entries[entries.length - 1]!.value;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const output = [...items];
    for (let index = output.length - 1; index > 0; index--) {
      const swap = this.int(0, index);
      [output[index], output[swap]] = [output[swap] as T, output[index] as T];
    }
    return output;
  }

  /** Zero-padded numeric string, e.g. `digits(4)` → `'0472'`. */
  digits(length: number): string {
    let output = '';
    for (let index = 0; index < length; index++) {
      output += this.int(0, 9).toString();
    }
    return output;
  }

  /** ISO timestamp offset from `reference` by a random amount of days. */
  dateWithin(reference: Date, minDaysAgo: number, maxDaysAgo: number): string {
    const days = this.float(minDaysAgo, maxDaysAgo, 4);
    return new Date(reference.getTime() - days * 86_400_000).toISOString();
  }

  /** Ascending series with light noise, useful for sparklines and charts. */
  series(length: number, min: number, max: number, trend = 0.02): number[] {
    const output: number[] = [];
    let value = this.float(min, max);
    for (let index = 0; index < length; index++) {
      const drift = (max - min) * trend;
      const noise = this.float(-(max - min) * 0.12, (max - min) * 0.12);
      value = Math.min(max, Math.max(min, value + drift + noise));
      output.push(Math.round(value));
    }
    return output;
  }
}

/** Shared generator so every mock dataset lines up run after run. */
export const mockRandom = (namespace: string): SeededRandom => new SeededRandom(`lao-lottery:${namespace}`);
