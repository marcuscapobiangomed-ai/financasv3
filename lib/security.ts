import { logger } from "./logger";

const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "application/json",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type ValidationResult = { valid: boolean; error?: string };

export function validateFile(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    logger.warn("security", "File rejected — too large", { name: file.name, size: file.size });
    return { valid: false, error: `Arquivo muito grande (máx ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  const allowedExts = ["csv", "pdf", "png", "jpg", "jpeg", "json"];
  if (!ext || !allowedExts.includes(ext)) {
    logger.warn("security", "File rejected — invalid extension", { name: file.name, ext });
    return { valid: false, error: `Tipo de arquivo não permitido (.${ext})` };
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type) && file.type !== "") {
    if (!file.type.startsWith("image/")) {
      logger.warn("security", "File rejected — invalid MIME type", { name: file.name, mime: file.type });
      return { valid: false, error: "Tipo de arquivo não reconhecido" };
    }
  }

  return { valid: true };
}

export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

export function sanitizeForStorage(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value).slice(0, 5000);
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeForStorage(v);
    }
    return result;
  }
  return value;
}

export const RATE_LIMIT = {
  maxImportsPerMinute: 5,
  maxEntriesPerImport: 500,
  maxFormSubmissionsPerMinute: 20,
};

const actionTimestamps: Record<string, number[]> = {};

export function checkRateLimit(action: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const timestamps = (actionTimestamps[action] = actionTimestamps[action] || []);
  const recent = timestamps.filter((t) => now - t < 60000);
  actionTimestamps[action] = recent;
  if (recent.length >= maxPerMinute) return false;
  recent.push(now);
  return true;
}

export function generateCsrfToken(): string {
  return crypto.randomUUID();
}
