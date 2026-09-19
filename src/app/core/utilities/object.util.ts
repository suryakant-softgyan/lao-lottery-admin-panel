/** Small, dependency-free object/array helpers used across the portal. */

/** Reads `a.b.c` style paths safely off an unknown object. */
export function getByPath(source: unknown, path: string): unknown {
  if (source === null || source === undefined) {
    return undefined;
  }
  return path.split('.').reduce<unknown>((accumulator, segment) => {
    if (accumulator === null || accumulator === undefined || typeof accumulator !== 'object') {
      return undefined;
    }
    return (accumulator as Record<string, unknown>)[segment];
  }, source);
}

/** Structured deep clone with a JSON fallback for older runtimes. */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function groupBy<T, K extends string | number>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const output = new Map<K, T[]>();
  for (const item of items) {
    const group = key(item);
    const bucket = output.get(group);
    if (bucket) {
      bucket.push(item);
    } else {
      output.set(group, [item]);
    }
  }
  return output;
}

export function sumBy<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

export function uniqueBy<T, K>(items: readonly T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const output: T[] = [];
  for (const item of items) {
    const identity = key(item);
    if (!seen.has(identity)) {
      seen.add(identity);
      output.push(item);
    }
  }
  return output;
}

/** Removes `null` / `undefined` / `''` entries — used before sending queries. */
export function compact<T extends Record<string, unknown>>(source: T): Partial<T> {
  const output: Partial<T> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && value !== undefined && value !== '') {
      output[key as keyof T] = value as T[keyof T];
    }
  }
  return output;
}

/** Shallow equality, sufficient for change detection on filter objects. */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => a[key] === b[key]);
}

/** Chunks an array into fixed-size slices. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

/** Moves an item within an array, returning a new array. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const output = [...items];
  const [moved] = output.splice(from, 1);
  if (moved !== undefined) {
    output.splice(to, 0, moved);
  }
  return output;
}
