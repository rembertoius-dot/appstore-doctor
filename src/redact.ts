// Every excerpt that reaches a reporter or the agent prompt goes through here first.
export const MAX_EXCERPT = 160;

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN/,
  /\bsk_(live|test)_/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  // Vendor tokens: GitHub, Slack, Google API keys, bearer headers.
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/i,
  // No leading \b: identifiers like JWT_SECRET, clientSecret and db_password must match.
  /secret/i,
  /(token|passwd|password|apikey|api_key)["']?\s*[=:]/i,
  // No boundaries: a 32+ hex run inside an identifier or after 0x is still a secret shape.
  /[A-Fa-f0-9]{32,}/,
  // Long base64-looking run; needs a digit and an uppercase letter so plain words or repeated letters pass.
  /(?=[A-Za-z0-9+/]*\d)(?=[A-Za-z0-9+/]*[A-Z])[A-Za-z0-9+/]{40,}={0,2}/,
];

const SENSITIVE_PATH = /(^|[\\/])(\.env[^\\/]*|\.npmrc|\.netrc|id_rsa[^\\/]*|id_ed25519[^\\/]*|service-account[^\\/]*\.json|[^\\/]*\.(p8|pem|key|keystore|jks|p12|pfx|mobileprovision)|[^\\/]*(credentials|secret)[^\\/]*)$/i;

export function redactExcerpt(line: string): string | null {
  const trimmed = line.trim();
  if (SECRET_PATTERNS.some((p) => p.test(trimmed))) return null;
  return trimmed.length > MAX_EXCERPT ? trimmed.slice(0, MAX_EXCERPT) + '…' : trimmed;
}

export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH.test(path);
}
