export const ERROR_CATEGORIES = [
  "validation",
  "authentication",
  "rate_limit",
  "temporary",
  "permanent",
  "unknown",
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

const RETRYABLE = new Set<ErrorCategory>(["rate_limit", "temporary", "unknown"]);

export function isRetryable(category: ErrorCategory): boolean {
  return RETRYABLE.has(category);
}

/** Map an HTTP status from a provider response to an error category. */
export function classifyHttpStatus(status: number): ErrorCategory {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "authentication";
  if (status === 400 || status === 404 || status === 422) return "validation";
  if (status >= 500) return "temporary";
  if (status >= 400) return "permanent";
  return "unknown";
}

const NETWORK_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/** Map a thrown network/transport error to an error category. */
export function classifyNetworkError(err: unknown): ErrorCategory {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (typeof code === "string" && NETWORK_CODES.has(code)) return "temporary";
  return "unknown";
}

export class DomainError extends Error {
  readonly category: ErrorCategory;
  constructor(message: string, category: ErrorCategory = "unknown") {
    super(message);
    this.name = new.target.name;
    this.category = category;
  }
  get retryable(): boolean {
    return isRetryable(this.category);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "validation");
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
