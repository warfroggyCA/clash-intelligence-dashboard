// Utility to deep-normalize values for JSON/SSR safety
// - Converts undefined to null
// - Converts Date to ISO string
// - Leaves primitives unchanged
// - Recurses arrays/objects

export function sanitizeForJSON<T = any>(input: any): T {
  const seen = new WeakSet<object>();

  const helper = (value: any): any => {
    if (value === undefined) return null;
    if (value === null) return null;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((v) => helper(v));
    if (t === 'object') {
      if (seen.has(value)) return null;
      seen.add(value);
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = helper(v);
      }
      return out;
    }
    // functions, symbols, bigint, etc.
    return null;
  };

  return helper(input) as T;
}

