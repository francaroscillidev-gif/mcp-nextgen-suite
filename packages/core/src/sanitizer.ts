/**
 * Utility to scrub sensitive credentials, secrets, tokens and passwords
 * from logs, database outputs, and commands before returning to an LLM context.
 */

const SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // Generic password/secret keys in JSON/YAML/env format
  {
    regex: /(password|passwd|secret|api_key|apikey|access_token|private_key|auth_token)\s*[:=]\s*(['"]?)([^'"\s\n\r]{4,})\2/gi,
    replacement: '$1: "[REDACTED_SECRET]"'
  },
  // JWT tokens (Bearer ey...)
  {
    regex: /Bearer\s+ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/gi,
    replacement: 'Bearer [REDACTED_JWT]'
  },
  // Postgres/MySQL/Mongo connection strings with password
  {
    regex: /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/([^:@\s]+):([^@\s]+)@/gi,
    replacement: '$1://$2:[REDACTED_PASSWORD]@'
  },
  // AWS / Cloud tokens (AKIA..., etc.)
  {
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    replacement: '[REDACTED_AWS_KEY_ID]'
  },
  // Private Key blocks
  {
    regex: /-----BEGIN\s+([A-Z\s]+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+([A-Z\s]+)?PRIVATE\s+KEY-----/gi,
    replacement: '[REDACTED_PRIVATE_KEY_BLOCK]'
  }
];

export function sanitizeSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  for (const { regex, replacement } of SECRET_PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeSecrets(obj) as unknown as T;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (/password|secret|token|key/i.test(key) && typeof value === 'string') {
        sanitized[key] = '[REDACTED_SECRET]';
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized as T;
  }
  return obj;
}
