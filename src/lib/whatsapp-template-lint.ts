/**
 * Client-side, NON-BLOCKING lint for WhatsApp template drafts. Mirrors the
 * authoritative server rules in msgbuddy-v2 `src/templates/whatsapp-template-limits.ts`
 * so authors see policy issues as they type instead of only after a failed
 * submit round-trip. The server remains the source of truth — this is UX only.
 */

export type TemplateLintLevel = "error" | "warn";

export type TemplateLintIssue = {
  level: TemplateLintLevel;
  message: string;
};

/** Bracket-style placeholders like `[NAME]` — Meta auto-rejects these. */
const BRACKET_PLACEHOLDER_RE = /\[[A-Za-z_][A-Za-z0-9_ -]*\]/;

/** URL shorteners Meta rejects in button URLs. Keep in sync with the server list. */
const URL_SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "buff.ly",
  "is.gd",
  "rebrand.ly",
  "rb.gy",
  "wa.me",
  "shorturl.at",
  "cutt.ly",
  "lnkd.in",
]);

function detectShortenerHost(url: string): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  const cleaned = t.replace(/\{\{[^}]+\}\}/g, "x");
  try {
    const u = new URL(cleaned);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return URL_SHORTENER_HOSTS.has(host) ? host : null;
  } catch {
    return null;
  }
}

function bodyStartsOrEndsWithVariable(body: string): boolean {
  const t = (body ?? "").trim();
  if (!t) return false;
  return /^\{\{[^}]+\}\}/.test(t) || /\{\{[^}]+\}\}$/.test(t);
}

function extractPositional(s: string): number[] {
  const out: number[] = [];
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(Number(m[1]));
  return out;
}

function positionalSequenceIssue(body: string): string | null {
  const nums = extractPositional(body);
  if (nums.length === 0) return null;
  const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
  for (let i = 0; i < unique.length; i++) {
    if (unique[i] !== i + 1) {
      return `Positional variables must start at {{1}} and be sequential — found {{${unique.join("}}, {{")}}}.`;
    }
  }
  return null;
}

function luhn(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number(num[i]);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectSensitiveData(text: string): string | null {
  const re = /\b(?:\d[ -]?){13,19}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const digits = m[0].replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      return "looks like a credit card number";
    }
  }
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return "looks like a US Social Security Number";
  if (
    /\b(password|pwd|pin\s*code)\b\s*[:=]/i.test(text) ||
    /\b(your|the)\s+(password|pin|pin\s*code)\s+is\b/i.test(text)
  ) {
    return "asks for or includes a password / PIN";
  }
  if (
    /\b(credit\s*card|debit\s*card|cvv|cvc|bank\s*account|account\s*number|routing\s*number|iban)\b/i.test(
      text
    )
  ) {
    return "asks for full payment / banking details";
  }
  return null;
}

export type LintButton = { type: string; text?: string; url?: string };

/**
 * Lint a standard (non-carousel, non-auth) template draft. Returns [] when clean.
 */
export function lintTemplateDraft(input: {
  body: string;
  footer?: string | null;
  parameterFormat?: "POSITIONAL" | "NAMED";
  buttons?: LintButton[];
}): TemplateLintIssue[] {
  const issues: TemplateLintIssue[] = [];
  const body = input.body ?? "";

  if (BRACKET_PLACEHOLDER_RE.test(body)) {
    issues.push({
      level: "error",
      message:
        "Body uses bracket placeholders like [NAME]. Use Meta syntax — {{1}} or {{name}}.",
    });
  }
  if (body.trim() && bodyStartsOrEndsWithVariable(body)) {
    issues.push({
      level: "error",
      message: "Body can't begin or end with a variable — add fixed text around {{…}}.",
    });
  }
  if ((input.parameterFormat ?? "POSITIONAL") === "POSITIONAL") {
    const seq = positionalSequenceIssue(body);
    if (seq) issues.push({ level: "error", message: seq });
  }
  const sensitive = detectSensitiveData(body);
  if (sensitive) {
    issues.push({
      level: "error",
      message: `Body ${sensitive} — Meta auto-rejects this. Remove it from the template.`,
    });
  }

  const footer = input.footer ?? "";
  if (footer && /\{\{[^}]+\}\}/.test(footer)) {
    issues.push({
      level: "error",
      message: "Footer can't contain variables — only fixed text is allowed.",
    });
  }

  // Quick-reply buttons must be contiguous — Meta rejects a URL/phone button
  // sandwiched between quick replies (e.g. QR, URL, QR).
  const qrIdx = (input.buttons ?? [])
    .map((b, i) => ((b.type ?? "").toUpperCase() === "QUICK_REPLY" ? i : -1))
    .filter((i) => i >= 0);
  if (qrIdx.length > 1 && qrIdx[qrIdx.length - 1] - qrIdx[0] + 1 !== qrIdx.length) {
    issues.push({
      level: "error",
      message:
        "Quick-reply buttons must be grouped together — Meta rejects another button placed between quick replies.",
    });
  }

  for (const btn of input.buttons ?? []) {
    if ((btn.type ?? "").toUpperCase() !== "URL") continue;
    const url = btn.url ?? "";
    const placeholders = (url.match(/\{\{[^}]+\}\}/g) ?? []).length;
    if (placeholders > 1) {
      issues.push({
        level: "error",
        message: `URL button "${btn.text || url}" has ${placeholders} placeholders — at most one is allowed.`,
      });
    }
    const shortener = detectShortenerHost(url);
    if (shortener) {
      issues.push({
        level: "error",
        message: `URL shortener "${shortener}" isn't allowed — use the full destination URL.`,
      });
    }
  }

  return issues;
}

/** Distinct variable tokens in a string: positional "1"/"2" or named "first_name". */
export function extractVariableNames(text: string): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? "")) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      order.push(m[1]);
    }
  }
  return order;
}
