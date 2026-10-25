export function isDigitPrefixedKey(key: string): boolean {
  return /^[0-9]+_[a-zA-Z0-9_]+$/.test(key);
}

export function camelToSnakeString(str: string): string {
  if (isDigitPrefixedKey(str)) {
    return str;
  }
  return str.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`).replace(/^_/, '');
}

export function snakeToCamelString(str: string): string {
  if (isDigitPrefixedKey(str)) {
    return str;
  }
  return str.replace(/_([a-z0-9])/g, (_, p1) => p1.toUpperCase());
}

export function deepCamelToSnake<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }
  if (obj instanceof Date || obj instanceof RegExp) {
    return obj as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepCamelToSnake(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = camelToSnakeString(key);
      result[newKey] = deepCamelToSnake(value);
    }
    return result as T;
  }
  return obj as T;
}

export function deepSnakeToCamel<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }
  if (obj instanceof Date || obj instanceof RegExp) {
    return obj as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSnakeToCamel(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = snakeToCamelString(key);
      result[newKey] = deepSnakeToCamel(value);
    }
    return result as T;
  }
  return obj as T;
}
