"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUpdateChannelTemplateVersion } from "@/hooks/use-templates";
import { mediaApi } from "@/lib/api";
import type {
  ChannelTemplateVersion,
  ChannelTemplateVersionUpdatePayload,
  TemplateCarouselCard,
  TemplateHeaderType,
  TemplateCategory,
  TemplateVersionLayoutType,
} from "@/lib/types";
import {
  DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE,
  WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS,
} from "@/lib/whatsapp-template-languages";
import { getApiError } from "@/lib/api-error";
import { WhatsAppTemplatePreview } from "@/components/templates/WhatsAppTemplatePreview";
import { useRightPanel } from "@/components/right-panel/useRightPanel";

const BODY_MAX = 1024;
const FOOTER_MAX = 60;
const HEADER_TEXT_MAX = 60;

function charCounterClass(current: number, max: number): string {
  const ratio = current / max;
  if (ratio >= 1) return "text-error font-semibold";
  if (ratio >= 0.9) return "text-warning";
  return "text-base-content/50";
}


const HEADER_TYPES: TemplateHeaderType[] = [
  "NONE",
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
];

/** Meta template button label limit (QUICK_REPLY / URL / PHONE_NUMBER) — official Meta cap. */
const META_TEMPLATE_BUTTON_LABEL_MAX = 20;
/** Meta carousel template card cap. */
const CAROUSEL_CARDS_MAX = 10;
/** Meta cap for template header media (IMAGE / VIDEO / DOCUMENT). */
const HEADER_MEDIA_MAX_BYTES = 15 * 1024 * 1024;
/** URL shorteners Meta rejects in button URLs — content review will instantly fail. */
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

/** Returns the hostname of a button URL if it's a known shortener, else null. */
function isShortenerUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return URL_SHORTENER_HOSTS.has(host) ? host : null;
  } catch {
    return null;
  }
}

/** Bracket-style placeholders (e.g. `[NAME]`) — common mistake, Meta auto-rejects. */
const BRACKET_PLACEHOLDER_RE = /\[[A-Za-z_][A-Za-z0-9_ -]*\]/;

/** Extracts positional placeholder numbers from a string. `["1", "3", "1"]` → `[1, 3, 1]`. */
function extractPositionalPlaceholders(s: string): number[] {
  const out: number[] = [];
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(Number(m[1]));
  return out;
}

/** Returns true if the trimmed string begins or ends with a `{{...}}` placeholder. */
function startsOrEndsWithPlaceholder(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^\{\{[^}]+\}\}/.test(t) || /\{\{[^}]+\}\}$/.test(t);
}

/** Luhn-validate a digit string (credit-card check). */
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

/** Returns the first sensitive-data label found in `text`, or null. Mirrors backend. */
function detectSensitiveData(text: string): string | null {
  // Credit card: 13-19 digit run that passes Luhn
  const ccMatch = text.match(/\b(?:\d[ -]?){13,19}\b/g);
  if (ccMatch) {
    for (const m of ccMatch) {
      const digits = m.replace(/[ -]/g, "");
      if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
        return "looks like a credit card number";
      }
    }
  }
  // US SSN
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    return "looks like a US Social Security Number (SSN)";
  }
  // Password / PIN disclosure
  if (
    /\b(password|pwd|pin\s*code)\b\s*[:=]/i.test(text) ||
    /\b(your|the)\s+(password|pin|pin\s*code)\s+is\b/i.test(text)
  ) {
    return "asks for or includes a password / PIN";
  }
  // Payment / banking details
  if (
    /\b(credit\s*card|debit\s*card|cvv|cvc|bank\s*account|account\s*number|routing\s*number|iban)\b/i.test(
      text
    )
  ) {
    return "asks for full payment / banking details";
  }
  return null;
}

type CarouselButtonUiType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";

type CarouselButtonRow = {
  id: string;
  type: CarouselButtonUiType;
  text: string;
  url: string;
  phone_number: string;
};

function newCarouselButtonRowId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  );
}

function defaultCarouselButtonRow(): CarouselButtonRow {
  return {
    id: newCarouselButtonRowId(),
    type: "QUICK_REPLY",
    text: "Learn more",
    url: "",
    phone_number: "",
  };
}

/** Build editable rows from stored API JSON (at least one row for empty arrays). */
function rowsFromApiButtons(raw: unknown): CarouselButtonRow[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [defaultCarouselButtonRow()];
  }
  return raw.map((rawBtn) => {
    const btn = rawBtn as Record<string, unknown>;
    const type = String(btn.type ?? "QUICK_REPLY").toUpperCase();
    const text = String(btn.text ?? "");
    const id = newCarouselButtonRowId();
    if (type === "URL") {
      return {
        id,
        type: "URL",
        text,
        url: String(btn.url ?? ""),
        phone_number: "",
      };
    }
    if (type === "PHONE_NUMBER" || type === "PHONE") {
      return {
        id,
        type: "PHONE_NUMBER",
        text,
        url: "",
        phone_number: String(
          (btn as { phone_number?: string }).phone_number ?? ""
        ),
      };
    }
    return {
      id,
      type: "QUICK_REPLY",
      text,
      url: "",
      phone_number: "",
    };
  });
}

/** Payload for API / Meta mapper (matches `mapButtons` on the server). */
function rowsToApiButtons(rows: CarouselButtonRow[]): unknown[] {
  return rows.map((r) => {
    if (r.type === "URL") {
      return { type: "URL", text: tidyWhitespace(r.text), url: r.url.trim() };
    }
    if (r.type === "PHONE_NUMBER") {
      return {
        type: "PHONE_NUMBER",
        text: tidyWhitespace(r.text),
        phone_number: r.phone_number.trim(),
      };
    }
    return { type: "QUICK_REPLY", text: tidyWhitespace(r.text) };
  });
}

/**
 * Trim leading/trailing whitespace and collapse runs of horizontal whitespace
 * (spaces, tabs) within each line to a single space. Newlines are preserved so
 * multi-line bodies keep their structure.
 */
function tidyWhitespace(s: string): string {
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function jsonToTextarea(v: unknown): string {
  if (v == null) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

function parseJsonOptional(
  raw: string,
  label: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(t) as unknown };
  } catch {
    return { ok: false, error: `${label} must be valid JSON.` };
  }
}

function safeParseCarouselCards(raw: string): TemplateCarouselCard[] | null {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as TemplateCarouselCard[]) : null;
  } catch {
    return null;
  }
}

function starterCarouselCards(count = 2): TemplateCarouselCard[] {
  return Array.from({ length: count }, (_, i) => ({
    headerFormat: "IMAGE",
    headerHandle: "",
    body: `Card ${i + 1} body…`,
    buttons: [{ type: "QUICK_REPLY", text: "Learn more" }],
  }));
}

/** Imperative handle exposed to the parent — lets it persist unsaved edits before submit. */
export type ChannelTemplateVersionEditorHandle = {
  /** Validates + persists current form state. Returns true on success, false if validation/API failed. */
  save: () => Promise<boolean>;
};

type ChannelTemplateVersionEditorProps = {
  channelTemplateId: string;
  version: ChannelTemplateVersion;
  onCopyAsNewDraft?: () => void;
  channelCategory?: TemplateCategory | null;
  onAutoSwitchCategoryToMarketing?: () => void;
};

export const ChannelTemplateVersionEditor = forwardRef<
  ChannelTemplateVersionEditorHandle,
  ChannelTemplateVersionEditorProps
>(function ChannelTemplateVersionEditor(
  {
    channelTemplateId,
    version,
    onCopyAsNewDraft,
    channelCategory,
    onAutoSwitchCategoryToMarketing,
  },
  ref
) {
  const editable = !version.isLocked && !version.archivedAt;
  const updateMutation = useUpdateChannelTemplateVersion();
  const fileRef = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState("");
  const [headerType, setHeaderType] = useState<TemplateHeaderType>("NONE");
  const [headerContent, setHeaderContent] = useState("");
  const [footer, setFooter] = useState("");
  const [language, setLanguage] = useState(DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE);
  const [parameterFormat, setParameterFormat] = useState<"POSITIONAL" | "NAMED">(
    "POSITIONAL"
  );
  const [layoutType, setLayoutType] = useState<TemplateVersionLayoutType>("STANDARD");
  const [buttonsJson, setButtonsJson] = useState("");
  const [variablesJson, setVariablesJson] = useState("");
  const [standardButtonRows, setStandardButtonRows] = useState<
    CarouselButtonRow[] | null
  >(null);
  const [carouselJson, setCarouselJson] = useState("");
  const [carouselCards, setCarouselCards] = useState<TemplateCarouselCard[]>([]);
  const [carouselButtonRowsByIndex, setCarouselButtonRowsByIndex] = useState<
    Record<number, CarouselButtonRow[]>
  >({});
  const [allowCategoryChange, setAllowCategoryChange] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  // After the first manual "Save draft" succeeds, keep auto-saving on edits.
  const [autoSaveAfterManual, setAutoSaveAfterManual] = useState(false);
  const [autoSavePending, setAutoSavePending] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [carouselUploadBusyByIndex, setCarouselUploadBusyByIndex] = useState<
    Record<number, boolean>
  >({});
  /** Blob URL for the just-picked header file — local-only, lets the right-panel preview render the actual image. */
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  /** Same as above, per carousel card index. */
  const [carouselPreviewUrlsByIndex, setCarouselPreviewUrlsByIndex] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    setSaveOk(null);
    setAutoSaveAfterManual(false);
    lastAutoSavedSignatureRef.current = null;
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  }, [version.id]);

  // In the browser, `setTimeout` returns a number.
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const lastAutoSavedSignatureRef = useRef<string | null>(null);

  // Re-sync when switching versions OR when server content changes (e.g. after PUT refetch).
  // Do not depend only on version.id — that skips updates after save for the same row.
  useEffect(() => {
    setFormError(null);
    setBody(version.body ?? "");
    setHeaderType((version.headerType as TemplateHeaderType) ?? "NONE");
    setHeaderContent(version.headerContent ?? "");
    setFooter(version.footer ?? "");
    setLanguage(version.language ?? DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE);
    setParameterFormat(
      version.parameterFormat === "NAMED" ? "NAMED" : "POSITIONAL"
    );
    setLayoutType(version.layoutType === "CAROUSEL" ? "CAROUSEL" : "STANDARD");
    setButtonsJson(jsonToTextarea(version.buttons));
    if (Array.isArray(version.buttons) && version.buttons.length > 0) {
      setStandardButtonRows(rowsFromApiButtons(version.buttons));
      setButtonsJson(JSON.stringify(rowsToApiButtons(rowsFromApiButtons(version.buttons)), null, 2));
    } else {
      setStandardButtonRows(null);
      setButtonsJson("");
    }
    setVariablesJson(jsonToTextarea(version.variables));
    setCarouselJson(jsonToTextarea(version.carouselCards));
    if (version.layoutType === "CAROUSEL") {
      const fromApi = Array.isArray(version.carouselCards)
        ? (version.carouselCards as TemplateCarouselCard[])
        : safeParseCarouselCards(jsonToTextarea(version.carouselCards)) ?? [];
      setCarouselCards(fromApi);
      const btnRows: Record<number, CarouselButtonRow[]> = {};
      for (let i = 0; i < fromApi.length; i++) {
        btnRows[i] = rowsFromApiButtons(fromApi[i]?.buttons);
      }
      setCarouselButtonRowsByIndex(btnRows);
      setCarouselUploadBusyByIndex({});
    } else {
      setCarouselCards([]);
      setCarouselButtonRowsByIndex({});
      setCarouselUploadBusyByIndex({});
    }
    setAllowCategoryChange(version.allowCategoryChange !== false);
  }, [
    version.id,
    version.body,
    version.footer,
    version.headerContent,
    version.headerType,
    version.language,
    version.parameterFormat,
    version.layoutType,
    version.buttons,
    version.variables,
    version.carouselCards,
    version.allowCategoryChange,
  ]);

  // Meta restriction: carousel templates cannot be UTILITY. Auto switch category to MARKETING.
  useEffect(() => {
    if (layoutType !== "CAROUSEL") return;
    if (channelCategory !== "UTILITY") return;
    onAutoSwitchCategoryToMarketing?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback ref intentionally excluded to prevent infinite loop
  }, [layoutType, channelCategory]);

  /** Ensure each card index has button row state (avoids unstable fallbacks on every render). */
  useEffect(() => {
    if (layoutType !== "CAROUSEL") return;
    setCarouselButtonRowsByIndex((prev) => {
      const next = { ...prev };
      let changed = false;
      for (let i = 0; i < carouselCards.length; i++) {
        if (next[i] === undefined) {
          next[i] = rowsFromApiButtons(carouselCards[i]?.buttons);
          changed = true;
        }
      }
      for (const k of Object.keys(next)) {
        const n = Number(k);
        if (!Number.isFinite(n) || n >= carouselCards.length) {
          delete next[n];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [layoutType, carouselCards]);

  const languageOptions = useMemo(() => {
    const known = new Set(
      WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS.map((o) => o.value)
    );
    const opts = [...WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS];
    if (language && !known.has(language)) {
      opts.unshift({ value: language, label: `${language} (saved)` });
    }
    return opts;
  }, [language]);

  const mediaAccept = useMemo(() => {
    switch (headerType) {
      case "IMAGE":
        return "image/jpeg,image/png,image/webp";
      case "VIDEO":
        return "video/mp4,video/quicktime";
      case "DOCUMENT":
        return "application/pdf";
      default:
        return "";
    }
  }, [headerType]);

  const onUploadMedia = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > HEADER_MEDIA_MAX_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        const capMb = (HEADER_MEDIA_MAX_BYTES / (1024 * 1024)).toFixed(0);
        setFormError(
          `Header media is ${mb} MB — Meta limit is ${capMb} MB. Resize or compress before uploading.`
        );
        e.target.value = "";
        return;
      }
      setHeaderPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setUploadBusy(true);
      setFormError(null);
      try {
        const { assetHandle } = await mediaApi.uploadForTemplate(file);
        setHeaderContent(assetHandle);
      } catch (err) {
        setFormError(getApiError(err));
      } finally {
        setUploadBusy(false);
        e.target.value = "";
      }
    },
    []
  );

  // Revoke standard header blob URL on unmount or when version switches.
  useEffect(() => {
    return () => {
      setHeaderPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [version.id]);

  // Revoke any carousel blob URLs on unmount.
  useEffect(() => {
    return () => {
      setCarouselPreviewUrlsByIndex((prev) => {
        for (const u of Object.values(prev)) URL.revokeObjectURL(u);
        return {};
      });
    };
  }, [version.id]);

  const onSave = useCallback(async (silent = false): Promise<boolean> => {
    if (!editable) return true;
    if (!silent) setFormError(null);
    const b = body.trim();
    if (!b.length) {
      setFormError("Body is required.");
      return false;
    }
    if (b.length > BODY_MAX) {
      setFormError(`Body must be at most ${BODY_MAX} characters.`);
      return false;
    }
    if (footer.length > FOOTER_MAX) {
      setFormError(`Footer must be at most ${FOOTER_MAX} characters.`);
      return false;
    }

    // ── Meta policy lint ───────────────────────────────────────────────────
    // Bracket-style placeholders like [NAME] — Meta auto-rejects.
    if (BRACKET_PLACEHOLDER_RE.test(b)) {
      setFormError(
        "Body uses bracket-style placeholders (e.g. [NAME]). Use Meta variable syntax instead — {{1}} for positional, or {{name}} for named."
      );
      return false;
    }
    // Body must not start or end with a variable.
    if (startsOrEndsWithPlaceholder(b)) {
      setFormError(
        "Body cannot begin or end with a variable. Add fixed text around {{...}} placeholders."
      );
      return false;
    }
    // Positional placeholders must start at 1 and be sequential.
    if (parameterFormat === "POSITIONAL") {
      const nums = extractPositionalPlaceholders(b);
      if (nums.length > 0) {
        const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
        for (let i = 0; i < unique.length; i++) {
          if (unique[i] !== i + 1) {
            setFormError(
              `Positional variables must start at 1 and be sequential (no gaps). Found {{${unique.join("}}, {{")}}}.`
            );
            return false;
          }
        }
      }
    }
    // Footer cannot contain variables (Meta rule).
    if (footer && /\{\{[^}]+\}\}/.test(footer)) {
      setFormError("Footer cannot contain variables — only fixed text is allowed there.");
      return false;
    }
    // Sensitive data — Meta auto-rejects templates that look like they request or
    // disclose card numbers, SSNs, passwords, or banking details.
    {
      const reason = detectSensitiveData(b);
      if (reason) {
        setFormError(
          `Body ${reason}. Meta auto-rejects templates with this content — remove it from the template.`
        );
        return false;
      }
    }
    if (layoutType === "STANDARD") {
      if (headerType === "TEXT" && headerContent.length > HEADER_TEXT_MAX) {
        setFormError(`Text header must be at most ${HEADER_TEXT_MAX} characters.`);
        return false;
      }
      if (
        headerType === "IMAGE" ||
        headerType === "VIDEO" ||
        headerType === "DOCUMENT"
      ) {
        if (!headerContent.trim()) {
          setFormError(
            "Upload a file or paste the media asset handle for this header."
          );
          return false;
        }
      }
    }

    const parsedButtons = parseJsonOptional(buttonsJson, "Buttons");
    if (!parsedButtons.ok) {
      setFormError(parsedButtons.error);
      return false;
    }
    const parsedVars = parseJsonOptional(variablesJson, "Variables");
    if (!parsedVars.ok) {
      setFormError(parsedVars.error);
      return false;
    }
    const parsedCarousel = parseJsonOptional(carouselJson, "Carousel cards");
    if (!parsedCarousel.ok) {
      setFormError(parsedCarousel.error);
      return false;
    }

    if (layoutType === "STANDARD" && standardButtonRows && standardButtonRows.length > 0) {
      const QUICK_REPLY_MAX = 3;
      const CTA_MAX = 2;
      let quickReplyCount = 0;
      let ctaCount = 0;
      for (let i = 0; i < standardButtonRows.length; i++) {
        const r = standardButtonRows[i];
        const label = r.text.trim();
        if (!label) {
          setFormError(`Button ${i + 1}: label is required.`);
          return false;
        }
        if (label.length > META_TEMPLATE_BUTTON_LABEL_MAX) {
          setFormError(
            `Button ${i + 1}: label must be at most ${META_TEMPLATE_BUTTON_LABEL_MAX} characters.`
          );
          return false;
        }
        if (r.type === "QUICK_REPLY") {
          quickReplyCount++;
        } else {
          ctaCount++;
        }
        if (r.type === "URL") {
          if (!r.url.trim()) {
            setFormError(`Button ${i + 1}: URL is required.`);
            return false;
          }
          const placeholders = (r.url.match(/\{\{[^}]+\}\}/g) ?? []).length;
          if (placeholders !== 1) {
            setFormError(
              `Button ${i + 1}: URL must contain exactly 1 placeholder (found ${placeholders}).`
            );
            return false;
          }
          const shortener = isShortenerUrl(r.url.replace(/\{\{[^}]+\}\}/g, "x"));
          if (shortener) {
            setFormError(
              `Button ${i + 1}: URL shortener "${shortener}" is not allowed. Use the full destination URL.`
            );
            return false;
          }
        }
        if (r.type === "PHONE_NUMBER" && !r.phone_number.trim()) {
          setFormError(`Button ${i + 1}: phone number is required.`);
          return false;
        }
      }
      if (quickReplyCount > QUICK_REPLY_MAX) {
        setFormError(`Too many quick-reply buttons (${quickReplyCount}); max is ${QUICK_REPLY_MAX}.`);
        return false;
      }
      if (ctaCount > CTA_MAX) {
        setFormError(`Too many CTA buttons (${ctaCount}); max is ${CTA_MAX}.`);
        return false;
      }
    }

    if (layoutType === "CAROUSEL") {
      if (carouselCards.length === 0) {
        setFormError("Add at least one carousel card.");
        return false;
      }
      if (carouselCards.length > CAROUSEL_CARDS_MAX) {
        setFormError(
          `Carousel templates support at most ${CAROUSEL_CARDS_MAX} cards (currently ${carouselCards.length}).`
        );
        return false;
      }
      for (let i = 0; i < carouselCards.length; i++) {
        const c = carouselCards[i];
        if (!c?.body?.trim()) {
          setFormError(`Card ${i + 1}: body is required.`);
          return false;
        }
        if (BRACKET_PLACEHOLDER_RE.test(c.body)) {
          setFormError(
            `Card ${i + 1}: body uses bracket-style placeholders (e.g. [NAME]). Use {{1}} or {{name}} instead.`
          );
          return false;
        }
        if (startsOrEndsWithPlaceholder(c.body)) {
          setFormError(
            `Card ${i + 1}: body cannot begin or end with a variable.`
          );
          return false;
        }
        {
          const cardSensitive = detectSensitiveData(c.body);
          if (cardSensitive) {
            setFormError(
              `Card ${i + 1}: body ${cardSensitive}. Meta auto-rejects this.`
            );
            return false;
          }
        }
        if (!c?.headerHandle?.trim()) {
          setFormError(
            `Card ${i + 1}: upload a header file or paste the asset handle (headerHandle).`
          );
          return false;
        }
        const rows = carouselButtonRowsByIndex[i] ?? [];
        if (rows.length === 0) {
          setFormError(`Card ${i + 1}: add at least one button.`);
          return false;
        }
        for (let j = 0; j < rows.length; j++) {
          const r = rows[j];
          const label = r.text.trim();
          if (!label) {
            setFormError(`Card ${i + 1}, button ${j + 1}: label is required.`);
            return false;
          }
          if (label.length > META_TEMPLATE_BUTTON_LABEL_MAX) {
            setFormError(
              `Card ${i + 1}, button ${j + 1}: label must be at most ${META_TEMPLATE_BUTTON_LABEL_MAX} characters (Meta).`
            );
            return false;
          }
          if (r.type === "URL") {
            if (!r.url.trim()) {
              setFormError(`Card ${i + 1}, button ${j + 1}: URL is required.`);
              return false;
            }
            const shortener = isShortenerUrl(r.url.replace(/\{\{[^}]+\}\}/g, "x"));
            if (shortener) {
              setFormError(
                `Card ${i + 1}, button ${j + 1}: URL shortener "${shortener}" is not allowed. Use the full destination URL.`
              );
              return false;
            }
          }
          if (r.type === "PHONE_NUMBER" && !r.phone_number.trim()) {
            setFormError(
              `Card ${i + 1}, button ${j + 1}: phone number is required (E.164, e.g. +15551234567).`
            );
            return false;
          }
        }
      }
    }

    const tidiedFooter = tidyWhitespace(footer);
    const payload: ChannelTemplateVersionUpdatePayload = {
      body: tidyWhitespace(b),
      footer: tidiedFooter ? tidiedFooter : null,
      language: language.trim() || DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE,
      parameterFormat,
      layoutType,
      allowCategoryChange,
    };

    if (layoutType === "CAROUSEL") {
      payload.headerType = "NONE";
      payload.headerContent = null;
    } else {
      payload.headerType = headerType;
      // Only tidy text headers — IMAGE/VIDEO/DOCUMENT store an asset handle that
      // must be preserved character-for-character.
      payload.headerContent =
        headerType === "NONE"
          ? null
          : headerType === "TEXT"
            ? tidyWhitespace(headerContent)
            : headerContent.trim();
    }

    if (parsedButtons.value !== undefined) {
      payload.buttons = Array.isArray(parsedButtons.value)
        ? (parsedButtons.value as unknown[])
        : null;
    }
    if (parsedVars.value !== undefined) {
      payload.variables = Array.isArray(parsedVars.value)
        ? (parsedVars.value as unknown[])
        : null;
    }
    if (layoutType === "CAROUSEL") {
      const cardsForApi: TemplateCarouselCard[] = carouselCards.map((c, idx) => {
        const rows = carouselButtonRowsByIndex[idx] ?? [];
        const buttons = rowsToApiButtons(rows) as TemplateCarouselCard["buttons"];
        return {
          headerFormat: c.headerFormat ?? "IMAGE",
          headerHandle: String(c.headerHandle ?? "").trim(),
          body: tidyWhitespace(String(c.body ?? "")),
          buttons,
        };
      });
      payload.carouselCards = cardsForApi as unknown[];
      setCarouselJson(JSON.stringify(cardsForApi, null, 2));
    }
    if (layoutType === "STANDARD") {
      payload.carouselCards = null;
    }

    try {
      await updateMutation.mutateAsync({
        id: channelTemplateId,
        version: version.version,
        data: payload,
      });
      if (!silent) {
        setSaveOk("Saved.");
        setFormError(null);
        // Start auto-saving after the first successful manual save.
        setAutoSaveAfterManual(true);
        window.setTimeout(() => setSaveOk(null), 4000);
      } else {
        setSaveOk(null);
      }
      return true;
    } catch (err) {
      setSaveOk(null);
      if (!silent) setFormError(getApiError(err));
      return false;
    }
  }, [
    editable,
    body,
    footer,
    headerContent,
    headerType,
    language,
    parameterFormat,
    layoutType,
    buttonsJson,
    variablesJson,
    carouselJson,
    carouselCards,
    carouselButtonRowsByIndex,
    standardButtonRows,
    channelTemplateId,
    version.version,
    updateMutation,
    allowCategoryChange,
  ]);

  // Autosave: after manual "Save draft" succeeds, keep persisting edits with debounce.
  useEffect(() => {
    if (!editable) return;
    if (!autoSaveAfterManual) return;
    if (updateMutation.isPending) return;
    if (uploadBusy) return;
    if (Object.values(carouselUploadBusyByIndex).some(Boolean)) return;

    const b = body.trim();
    if (!b.length) return;
    if (b.length > BODY_MAX) return;
    if (footer.length > FOOTER_MAX) return;

    // Header checks (keep in sync with onSave validation, but without setting UI errors).
    if (layoutType === "STANDARD") {
      if (headerType === "TEXT" && headerContent.length > HEADER_TEXT_MAX) return;
      if (
        (headerType === "IMAGE" ||
          headerType === "VIDEO" ||
          headerType === "DOCUMENT") &&
        !headerContent.trim()
      ) {
        return;
      }
    }

    const parsedButtons = parseJsonOptional(buttonsJson, "Buttons");
    if (!parsedButtons.ok) return;
    const parsedVars = parseJsonOptional(variablesJson, "Variables");
    if (!parsedVars.ok) return;

    const parsedCarousel = parseJsonOptional(carouselJson, "Carousel cards");
    if (!parsedCarousel.ok) return;

    if (layoutType === "CAROUSEL") {
      if (carouselCards.length === 0) return;
      for (let i = 0; i < carouselCards.length; i++) {
        const c = carouselCards[i];
        if (!c?.body?.trim()) return;
        if (!c?.headerHandle?.trim()) return;
        const rows = carouselButtonRowsByIndex[i] ?? [];
        if (rows.length === 0) return;
        for (let j = 0; j < rows.length; j++) {
          const r = rows[j];
          const label = r.text.trim();
          if (!label) return;
          if (label.length > META_TEMPLATE_BUTTON_LABEL_MAX) return;
          if (r.type === "URL" && !r.url.trim()) return;
          if (r.type === "PHONE_NUMBER" && !r.phone_number.trim()) return;
        }
      }
    }

    const signature = JSON.stringify({
      body: b,
      footer: footer.trim(),
      headerType,
      headerContent: headerContent.trim(),
      language,
      parameterFormat,
      layoutType,
      buttonsJson: buttonsJson.trim(),
      variablesJson: variablesJson.trim(),
      carouselCards,
      carouselButtonRowsByIndex,
      allowCategoryChange,
    });

    if (signature === lastAutoSavedSignatureRef.current) return;

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSavePending(true);
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      lastAutoSavedSignatureRef.current = signature;
      setAutoSavePending(false);
      onSave(true);
    }, 900);

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    editable,
    autoSaveAfterManual,
    updateMutation.isPending,
    uploadBusy,
    carouselUploadBusyByIndex,
    body,
    footer,
    headerType,
    headerContent,
    language,
    parameterFormat,
    layoutType,
    buttonsJson,
    variablesJson,
    carouselJson,
    carouselCards,
    carouselButtonRowsByIndex,
    allowCategoryChange,
    onSave,
  ]);

  // Expose a `save()` method so the parent can persist unsaved edits before
  // submitting the version for approval — otherwise Submit would advance whatever
  // last hit the DB and silently drop in-flight keystrokes.
  useImperativeHandle(
    ref,
    () => ({
      save: () => onSave(false),
    }),
    [onSave]
  );

  // Push live preview into the global right panel. Memoize the JSX so panel
  // chrome doesn't re-render — only the preview subtree diffs on each keystroke.
  const { setContent: setRightPanelContent, clearContent: clearRightPanelContent, open: openRightPanel, isOpen: rightPanelOpen } =
    useRightPanel();

  const previewNode = useMemo(() => {
    const standardButtons = standardButtonRows
      ? standardButtonRows.map((r) => ({ type: r.type, text: r.text }))
      : [];
    const carouselForPreview = carouselCards.map((card, idx) => ({
      headerFormat: (card.headerFormat ?? "IMAGE") as "IMAGE" | "VIDEO",
      headerHandle: card.headerHandle,
      headerPreviewUrl: carouselPreviewUrlsByIndex[idx],
      body: card.body,
      buttons: (carouselButtonRowsByIndex[idx] ?? []).map((r) => ({
        type: r.type,
        text: r.text,
      })),
    }));
    return (
      <WhatsAppTemplatePreview
        headerType={headerType as "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"}
        headerContent={headerContent}
        headerPreviewUrl={headerPreviewUrl}
        body={body}
        footer={footer}
        buttons={standardButtons}
        layoutType={layoutType as "STANDARD" | "CAROUSEL"}
        carouselCards={carouselForPreview}
      />
    );
  }, [
    headerType,
    headerContent,
    headerPreviewUrl,
    body,
    footer,
    standardButtonRows,
    layoutType,
    carouselCards,
    carouselButtonRowsByIndex,
    carouselPreviewUrlsByIndex,
  ]);

  useEffect(() => {
    setRightPanelContent({
      source: "channel-template-preview",
      title: "Preview",
      content: previewNode,
    });
  }, [previewNode, setRightPanelContent]);

  useEffect(() => {
    return () => clearRightPanelContent("channel-template-preview");
  }, [clearRightPanelContent]);

  if (!editable) {
    const advanced = [
      { label: "Buttons", value: version.buttons },
      { label: "Variables", value: version.variables },
      { label: "Carousel cards", value: version.carouselCards },
    ].filter((x) => x.value != null);

    return (
      <div className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="op-label text-warning">read-only</span>
            <p className="mt-1 text-[0.8125rem] text-base-content/70">
              {version.isLocked
                ? "🔒 This version is locked after internal approval. Content cannot be changed."
                : `This version is in "${version.status}" status. Only draft versions can be edited.`}
            </p>
          </div>
          {onCopyAsNewDraft && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onCopyAsNewDraft}
              title="Create a new draft by copying this version"
            >
              Copy into new draft
            </button>
          )}
        </div>
        {version.body != null && (
          <div className="space-y-2 text-sm">
            {version.headerType && version.headerType !== "NONE" && (
              <div>
                <span className="text-base-content/60">Header ({version.headerType}): </span>
                <span className="text-base-content/90 break-all">
                  {version.headerContent ?? "—"}
                </span>
              </div>
            )}
            <div>
              <span className="text-base-content/60">Body: </span>
              <pre className="whitespace-pre-wrap font-sans text-base-content mt-1">
                {version.body}
              </pre>
            </div>
            {version.footer && (
              <div>
                <span className="text-base-content/60">Footer: </span>
                {version.footer}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-base-content/60 pt-1">
              <div>
                <span className="text-base-content/50">Language</span>{" "}
                {version.language ?? DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE}
              </div>
              <div>
                <span className="text-base-content/50">Parameter format</span>{" "}
                {version.parameterFormat ?? "POSITIONAL"}
              </div>
              <div className="col-span-2">
                <span className="text-base-content/50">Meta category auto-match</span>{" "}
                {version.allowCategoryChange === false ? "Off (no auto marketing reclass)" : "On"}
              </div>
              {version.providerVersionId && (
                <div className="col-span-2">
                  <span className="text-base-content/50">Provider version ID</span>{" "}
                  <span className="font-mono break-all">{version.providerVersionId}</span>
                </div>
              )}
              {version.syncedAt && (
                <div>
                  <span className="text-base-content/50">Synced</span>{" "}
                  {new Date(version.syncedAt).toLocaleString()}
                </div>
              )}
              {version.submittedAt && (
                <div>
                  <span className="text-base-content/50">Submitted</span>{" "}
                  {new Date(version.submittedAt).toLocaleString()}
                </div>
              )}
              {version.approvedAt && (
                <div>
                  <span className="text-base-content/50">Approved</span>{" "}
                  {new Date(version.approvedAt).toLocaleString()}
                </div>
              )}
              {version.archivedAt && (
                <div>
                  <span className="text-base-content/50">Archived</span>{" "}
                  {new Date(version.archivedAt).toLocaleString()}
                </div>
              )}
            </div>

            {advanced.length > 0 && (
              <details className="group pt-1">
                <summary className="cursor-pointer text-xs text-base-content/70 hover:text-base-content">
                  Advanced content (JSON)
                </summary>
                <div className="mt-2 space-y-2">
                  {advanced.map((a) => (
                    <div key={a.label}>
                      <div className="text-xs text-base-content/60">{a.label}</div>
                      <pre className="mt-1 whitespace-pre-wrap font-mono text-xs bg-base-200/60 rounded-md p-2 border border-base-300/70">
                        {jsonToTextarea(a.value)}
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    );
  }

  const SaveButton = (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => onSave(false)}
      disabled={updateMutation.isPending}
    >
      {updateMutation.isPending ? (
        <>
          <span className="loading loading-spinner loading-sm" />
          Saving…
        </>
      ) : (
        "Save draft"
      )}
    </button>
  );

  return (
    <div className="card bg-base-100 border border-base-300 p-4 space-y-5 min-w-0">

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Content</div>
          {autoSavePending && (
            <span className="text-xs text-base-content/50 flex items-center gap-1">
              <span className="loading loading-spinner loading-xs" />
              Auto-saving…
            </span>
          )}
          {!autoSavePending && updateMutation.isPending && (
            <span className="text-xs text-base-content/50">Saving…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!rightPanelOpen && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={openRightPanel}
              title="Open the live preview in the right panel"
            >
              Show preview
            </button>
          )}
          {SaveButton}
        </div>
      </div>

      {formError && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem] text-base-content">{formError}</p>
        </div>
      )}
      {saveOk && !formError && (
        <div role="status" className="rounded-box border border-success/30 border-l-2 border-l-success bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-success">saved</span>
          <p className="text-[0.8125rem] text-base-content">{saveOk}</p>
        </div>
      )}

      {/* ── Section 1: Structure ── */}
      <div className="space-y-3">
        <div className="op-label">Structure</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="form-control w-full">
            <span className="label-text text-xs">Layout</span>
            <select
              className="select select-bordered select-sm w-full"
              value={layoutType}
              onChange={(e) =>
                setLayoutType(e.target.value as TemplateVersionLayoutType)
              }
            >
              <option value="STANDARD">Standard</option>
              <option value="CAROUSEL">Carousel</option>
            </select>
          </label>
          <label className="form-control w-full">
            <span className="label-text text-xs">Language</span>
            <select
              className="select select-bordered select-sm w-full"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {languageOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({o.value})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="my-2 border-t border-base-300" />

      {/* ── Section 2: Message (Standard layout) ── */}
      {layoutType === "STANDARD" && (
        <div className="space-y-4">
          <div className="op-label">Message</div>

          {/* Header */}
          <div className="space-y-2">
            <label className="form-control w-full">
              <span className="label-text text-xs">Header type</span>
              <select
                className="select select-bordered select-sm w-full max-w-xs"
                value={headerType}
                onChange={(e) => {
                  const next = e.target.value as TemplateHeaderType;
                  if (next !== headerType) {
                    setHeaderContent("");
                  }
                  setHeaderType(next);
                }}
              >
                {HEADER_TYPES.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>

            {headerType === "TEXT" && (
              <label className="form-control w-full">
                <span className="label-text text-xs">
                  Header text{" "}
                  <span className={charCounterClass(headerContent.length, HEADER_TEXT_MAX)}>
                    ({headerContent.length}/{HEADER_TEXT_MAX})
                  </span>
                </span>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={headerContent}
                  maxLength={HEADER_TEXT_MAX}
                  onChange={(e) => setHeaderContent(e.target.value)}
                  placeholder="Short header line"
                />
              </label>
            )}

            {(headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT") && (
              <div className="space-y-2">
                {headerContent ? (
                  <div className="flex items-center justify-between gap-2 rounded-box border border-base-300 bg-base-200/50 px-3 py-2">
                    <span className="op-label text-success">
                      ✓ {headerType.toLowerCase()} uploaded · see preview
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error/70"
                      onClick={() => {
                        setHeaderContent("");
                        setHeaderPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return null;
                        });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      className="file-input file-input-bordered file-input-sm max-w-full"
                      accept={mediaAccept}
                      onChange={onUploadMedia}
                      disabled={uploadBusy}
                    />
                    {uploadBusy && <span className="loading loading-spinner loading-sm" />}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="form-control w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="label-text text-xs">
                Body · required{" "}
                <span className={charCounterClass(body.length, BODY_MAX)}>
                  ({body.length}/{BODY_MAX})
                </span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs font-mono"
                title="Insert next positional placeholder at cursor"
                onClick={() => {
                  const el = bodyRef.current;
                  const nextN =
                    (body.match(/\{\{(\d+)\}\}/g) ?? []).reduce(
                      (max, m) => Math.max(max, parseInt(m.replace(/\D/g, ""), 10)),
                      0
                    ) + 1;
                  const insert = `{{${nextN}}}`;
                  if (el) {
                    const start = el.selectionStart ?? body.length;
                    const end = el.selectionEnd ?? body.length;
                    const next = body.slice(0, start) + insert + body.slice(end);
                    setBody(next);
                    requestAnimationFrame(() => {
                      el.focus();
                      el.setSelectionRange(start + insert.length, start + insert.length);
                    });
                  } else {
                    setBody((b) => b + insert);
                  }
                }}
              >
                + Insert {"{{"}N{"}}"}
              </button>
            </div>
            <textarea
              ref={bodyRef}
              className="textarea textarea-bordered w-full min-h-[120px] text-sm"
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Main message text. Use {{1}}, {{2}} (positional) or {{name}} (named) for variables."
            />
          </div>

          {/* Footer */}
          <label className="form-control w-full">
            <span className="label-text text-xs">
              Footer{" "}
              <span className={charCounterClass(footer.length, FOOTER_MAX)}>
                ({footer.length}/{FOOTER_MAX})
              </span>
            </span>
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={footer}
              maxLength={FOOTER_MAX}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Optional short footer text"
            />
          </label>

          {/* Buttons */}
          <div className="space-y-2 rounded-box border border-base-300 bg-base-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium">Buttons</span>
              <span className="text-xs text-base-content/60">
                Optional · max 3 quick-reply or 2 CTA
              </span>
            </div>

          {(!standardButtonRows || standardButtonRows.length === 0) ? (
            <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-3 text-sm text-base-content/60">
              No buttons yet. Add one below.
            </div>
          ) : (
            <div className="space-y-2">
              {standardButtonRows.map((row, bi) => (
                <div
                  key={row.id}
                  className="rounded-md border border-base-300/60 bg-base-100 p-2 space-y-2"
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="form-control min-w-[140px] flex-1">
                      <span className="label-text text-xs">Type</span>
                      <select
                        className="select select-bordered select-xs w-full"
                        value={row.type}
                        onChange={(e) => {
                          const t = e.target.value as CarouselButtonUiType;
                          setStandardButtonRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            const cur = { ...next[bi], type: t };
                            if (t === "QUICK_REPLY") {
                              cur.url = "";
                              cur.phone_number = "";
                            }
                            next[bi] = cur;
                            setButtonsJson(
                              JSON.stringify(rowsToApiButtons(next), null, 2)
                            );
                            return next;
                          });
                        }}
                      >
                        <option value="QUICK_REPLY">Quick reply</option>
                        <option value="URL">Visit website (URL)</option>
                        <option value="PHONE_NUMBER">Call phone number</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => {
                        setStandardButtonRows((prev) => {
                          const cur = prev ?? [];
                          const next = cur.filter((_, i) => i !== bi);
                          const final = next.length ? next : null;
                          setButtonsJson(
                            final ? JSON.stringify(rowsToApiButtons(final), null, 2) : ""
                          );
                          return final;
                        });
                      }}
                      aria-label={`Remove button ${bi + 1}`}
                    >
                      Remove
                    </button>
                  </div>

                  <label className="form-control w-full">
                    <span className="label-text text-xs">
                      Button text ({row.text.length}/{META_TEMPLATE_BUTTON_LABEL_MAX})
                    </span>
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full"
                      maxLength={META_TEMPLATE_BUTTON_LABEL_MAX}
                      value={row.text}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStandardButtonRows((prev) => {
                          if (!prev) return prev;
                          const next = [...prev];
                          next[bi] = { ...next[bi], text: v };
                          setButtonsJson(
                            JSON.stringify(rowsToApiButtons(next), null, 2)
                          );
                          return next;
                        });
                      }}
                      placeholder="Label shown on the button"
                    />
                  </label>

                  {row.type === "URL" && (
                    <label className="form-control w-full">
                      <span className="label-text text-xs">Website URL</span>
                      <input
                        type="url"
                        className="input input-bordered input-xs w-full font-mono text-xs"
                        value={row.url}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStandardButtonRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            next[bi] = { ...next[bi], url: v };
                            setButtonsJson(
                              JSON.stringify(rowsToApiButtons(next), null, 2)
                            );
                            return next;
                          });
                        }}
                        placeholder="https://example.com/path"
                      />
                      <span className="text-xs text-base-content/50 mt-0.5">
                        Use {"{{1}}"} at the end of the URL if Meta expects a variable.
                      </span>
                    </label>
                  )}

                  {row.type === "PHONE_NUMBER" && (
                    <label className="form-control w-full">
                      <span className="label-text text-xs">Phone (E.164)</span>
                      <input
                        type="tel"
                        className="input input-bordered input-xs w-full font-mono text-xs"
                        value={row.phone_number}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStandardButtonRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            next[bi] = { ...next[bi], phone_number: v };
                            setButtonsJson(
                              JSON.stringify(rowsToApiButtons(next), null, 2)
                            );
                            return next;
                          });
                        }}
                        placeholder="+15551234567"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => {
              setStandardButtonRows((prev) => {
                const base = prev ?? [];
                const next = [
                  ...base,
                  {
                    ...defaultCarouselButtonRow(),
                    id: newCarouselButtonRowId(),
                    text: "Option",
                  },
                ];
                setButtonsJson(JSON.stringify(rowsToApiButtons(next), null, 2));
                return next;
              });
            }}
          >
            + Add button
          </button>
          </div>
        </div>
      )}

      {/* ── Section 2: Message (Carousel layout) ── */}
      {layoutType === "CAROUSEL" && (
        <div className="space-y-4">
          <div className="op-label">Message</div>

          {/* Body (carousel has a main body too) */}
          <label className="form-control w-full">
            <span className="label-text text-xs">
              Body ({body.length}/{BODY_MAX}) · required
            </span>
            <textarea
              className="textarea textarea-bordered w-full min-h-[100px] text-sm"
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Main carousel message. Use {{1}} or named placeholders."
            />
          </label>

          <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Cards</div>
              <div className="text-xs text-base-content/60">
                Each card needs a header media handle and a body.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const starter = starterCarouselCards(2);
                  setCarouselCards(starter);
                  const br: Record<number, CarouselButtonRow[]> = {};
                  for (let i = 0; i < starter.length; i++) {
                    br[i] = rowsFromApiButtons(starter[i]?.buttons);
                  }
                  setCarouselButtonRowsByIndex(br);
                  setCarouselJson(JSON.stringify(starter, null, 2));
                }}
              >
                Starter 2 cards
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={carouselCards.length >= 10}
                title={carouselCards.length >= 10 ? "Maximum 10 cards (Meta limit)" : undefined}
                onClick={() => {
                  setCarouselCards((prev) => {
                    const nextIndex = prev.length;
                    const inheritFormat = prev.length > 0 ? prev[0].headerFormat : "IMAGE";
                    setCarouselButtonRowsByIndex((b) => ({
                      ...b,
                      [nextIndex]: [defaultCarouselButtonRow()],
                    }));
                    setCarouselUploadBusyByIndex((u) => ({ ...u, [nextIndex]: false }));
                    return [
                      ...prev,
                      {
                        headerFormat: inheritFormat,
                        headerHandle: "",
                        body: "",
                        buttons: [{ type: "QUICK_REPLY", text: "Learn more" }],
                      },
                    ];
                  });
                }}
              >
                + Add card
              </button>
            </div>
          </div>

          {carouselCards.length === 0 ? (
            <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-sm text-base-content/60">
              No cards yet. Click <span className="font-medium">Starter 2 cards</span> or{" "}
              <span className="font-medium">Add card</span>.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {carouselCards.map((card, idx) => {
                const accept =
                  card.headerFormat === "VIDEO"
                    ? "video/mp4,video/quicktime"
                    : "image/jpeg,image/png,image/webp";
                const btnRowsForCard =
                  carouselButtonRowsByIndex[idx] ?? rowsFromApiButtons(card.buttons);
                return (
                  <div
                    key={idx}
                    className="card bg-base-100 border border-base-300 p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">Card {idx + 1}</div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => {
                          setCarouselCards((prev) => prev.filter((_, i) => i !== idx));
                          setCarouselButtonRowsByIndex((prev) => {
                            const next: Record<number, CarouselButtonRow[]> = {};
                            for (let i = 0; i < carouselCards.length; i++) {
                              if (i === idx) continue;
                              const newIdx = i < idx ? i : i - 1;
                              next[newIdx] = prev[i] ?? [defaultCarouselButtonRow()];
                            }
                            return next;
                          });
                          setCarouselUploadBusyByIndex((prev) => {
                            const next: Record<number, boolean> = {};
                            for (let i = 0; i < carouselCards.length; i++) {
                              if (i === idx) continue;
                              const newIdx = i < idx ? i : i - 1;
                              next[newIdx] = prev[i] ?? false;
                            }
                            return next;
                          });
                        }}
                        title="Remove card"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="form-control w-full">
                        <span className="label-text text-xs">Header format</span>
                        <select
                          className="select select-bordered select-sm w-full"
                          value={card.headerFormat}
                          onChange={(e) => {
                            const v = e.target.value as "IMAGE" | "VIDEO";
                            // Meta requires all cards to share the same header format
                            setCarouselCards((prev) =>
                              prev.map((c) => ({ ...c, headerFormat: v, headerHandle: "" }))
                            );
                          }}
                        >
                          <option value="IMAGE">IMAGE</option>
                          <option value="VIDEO">VIDEO</option>
                        </select>
                        {idx === 0 && (
                          <span className="text-[0.625rem] text-base-content/40 mt-1">Applies to all cards</span>
                        )}
                      </label>

                    </div>

                    {/* Header media */}
                    <div className="space-y-2">
                      {card.headerHandle ? (
                        <div className="flex items-center justify-between gap-2 rounded-box border border-base-300 bg-base-200/50 px-3 py-2">
                          <span className="op-label text-success">
                            ✓ {(card.headerFormat ?? "IMAGE").toLowerCase()} uploaded · see preview
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error/70"
                            onClick={() => {
                              setCarouselCards((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, headerHandle: "" } : c))
                              );
                              setCarouselPreviewUrlsByIndex((prev) => {
                                const next = { ...prev };
                                if (next[idx]) URL.revokeObjectURL(next[idx]);
                                delete next[idx];
                                return next;
                              });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="file"
                            className="file-input file-input-bordered file-input-sm max-w-full"
                            accept={accept}
                            disabled={Boolean(carouselUploadBusyByIndex[idx])}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > HEADER_MEDIA_MAX_BYTES) {
                                const mb = (file.size / (1024 * 1024)).toFixed(1);
                                const capMb = (HEADER_MEDIA_MAX_BYTES / (1024 * 1024)).toFixed(0);
                                setFormError(
                                  `Card ${idx + 1} header media is ${mb} MB — Meta limit is ${capMb} MB. Resize or compress before uploading.`
                                );
                                e.target.value = "";
                                return;
                              }
                              setCarouselPreviewUrlsByIndex((prev) => {
                                const next = { ...prev };
                                if (next[idx]) URL.revokeObjectURL(next[idx]);
                                next[idx] = URL.createObjectURL(file);
                                return next;
                              });
                              setCarouselUploadBusyByIndex((prev) => ({
                                ...prev,
                                [idx]: true,
                              }));
                              setFormError(null);
                              try {
                                const { assetHandle } = await mediaApi.uploadForTemplate(file);
                                setCarouselCards((prev) =>
                                  prev.map((c, i) =>
                                    i === idx ? { ...c, headerHandle: assetHandle } : c
                                  )
                                );
                              } catch (err) {
                                setFormError(getApiError(err));
                              } finally {
                                setCarouselUploadBusyByIndex((prev) => ({
                                  ...prev,
                                  [idx]: false,
                                }));
                                e.target.value = "";
                              }
                            }}
                          />
                          {carouselUploadBusyByIndex[idx] && (
                            <span className="loading loading-spinner loading-sm" />
                          )}
                        </label>
                      )}
                    </div>

                    <label className="form-control w-full">
                      <span className="label-text text-xs">Body · required</span>
                      <textarea
                        className="textarea textarea-bordered w-full min-h-[100px] text-sm"
                        value={card.body}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCarouselCards((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, body: v } : c))
                          );
                        }}
                        placeholder="Card message text"
                      />
                    </label>

                    <div className="space-y-2 rounded-box border border-base-300 bg-base-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium">Buttons</span>
                        <span className="text-xs text-base-content/60">
                          At least one · label max {META_TEMPLATE_BUTTON_LABEL_MAX} chars (Meta)
                        </span>
                      </div>
                      {btnRowsForCard.map((row, bi) => (
                        <div
                          key={row.id}
                          className="rounded-md border border-base-300/60 bg-base-100 p-2 space-y-2"
                        >
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="form-control min-w-[140px] flex-1">
                              <span className="label-text text-xs">Type</span>
                              <select
                                className="select select-bordered select-xs w-full"
                                value={row.type}
                                onChange={(e) => {
                                  const t = e.target.value as CarouselButtonUiType;
                                  setCarouselButtonRowsByIndex((prev) => {
                                    const list = [...(prev[idx] ?? btnRowsForCard)];
                                    const cur = { ...list[bi], type: t };
                                    if (t === "QUICK_REPLY") {
                                      cur.url = "";
                                      cur.phone_number = "";
                                    }
                                    list[bi] = cur;
                                    return { ...prev, [idx]: list };
                                  });
                                }}
                              >
                                <option value="QUICK_REPLY">Quick reply</option>
                                <option value="URL">Visit website (URL)</option>
                                <option value="PHONE_NUMBER">Call phone number</option>
                              </select>
                            </label>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-error"
                              disabled={btnRowsForCard.length <= 1}
                              onClick={() => {
                                setCarouselButtonRowsByIndex((prev) => {
                                  const list = [...(prev[idx] ?? btnRowsForCard)];
                                  list.splice(bi, 1);
                                  return { ...prev, [idx]: list };
                                });
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <label className="form-control w-full">
                            <span className="label-text text-xs">
                              Button text ({row.text.length}/{META_TEMPLATE_BUTTON_LABEL_MAX})
                            </span>
                            <input
                              type="text"
                              className="input input-bordered input-xs w-full"
                              maxLength={META_TEMPLATE_BUTTON_LABEL_MAX}
                              value={row.text}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCarouselButtonRowsByIndex((prev) => {
                                    const list = [...(prev[idx] ?? btnRowsForCard)];
                                    list[bi] = { ...list[bi], text: v };
                                  return { ...prev, [idx]: list };
                                });
                              }}
                              placeholder="Label shown on the button"
                            />
                          </label>
                          {row.type === "URL" && (
                            <label className="form-control w-full">
                              <span className="label-text text-xs">Website URL</span>
                              <input
                                type="url"
                                className="input input-bordered input-xs w-full font-mono text-xs"
                                value={row.url}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCarouselButtonRowsByIndex((prev) => {
                                    const list = [...(prev[idx] ?? btnRowsForCard)];
                                    list[bi] = { ...list[bi], url: v };
                                    return { ...prev, [idx]: list };
                                  });
                                }}
                                placeholder="https://example.com/path"
                              />
                              <span className="text-xs text-base-content/50 mt-0.5">
                                Use {"{{1}}"} at the end of the URL if Meta expects a variable.
                              </span>
                            </label>
                          )}
                          {row.type === "PHONE_NUMBER" && (
                            <label className="form-control w-full">
                              <span className="label-text text-xs">Phone (E.164)</span>
                              <input
                                type="tel"
                                className="input input-bordered input-xs w-full font-mono text-xs"
                                value={row.phone_number}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCarouselButtonRowsByIndex((prev) => {
                                    const list = [...(prev[idx] ?? btnRowsForCard)];
                                    list[bi] = { ...list[bi], phone_number: v };
                                    return { ...prev, [idx]: list };
                                  });
                                }}
                                placeholder="+15551234567"
                              />
                            </label>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => {
                          setCarouselButtonRowsByIndex((prev) => {
                            const list = [...(prev[idx] ?? btnRowsForCard)];
                            list.push({
                              ...defaultCarouselButtonRow(),
                              text: "Option",
                            });
                            return { ...prev, [idx]: list };
                          });
                        }}
                      >
                        + Add button
                      </button>
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs text-base-content/60 hover:text-base-content">
                        Advanced: edit buttons as JSON
                      </summary>
                      <div className="mt-2">
                        <textarea
                          className="textarea textarea-bordered w-full min-h-[72px] font-mono text-xs"
                          value={jsonToTextarea(rowsToApiButtons(btnRowsForCard))}
                          onChange={(e) => {
                            const parsed = parseJsonOptional(
                              e.target.value,
                              "Buttons"
                            );
                            if (!parsed.ok || !Array.isArray(parsed.value)) return;
                            setCarouselButtonRowsByIndex((prev) => ({
                              ...prev,
                              [idx]: rowsFromApiButtons(parsed.value),
                            }));
                          }}
                          placeholder="[]"
                        />
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-sm text-base-content/70 hover:text-base-content">
              Advanced: carousel cards JSON
            </summary>
            <div className="mt-2">
              <textarea
                className="textarea textarea-bordered w-full min-h-[160px] font-mono text-xs"
                value={carouselJson}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCarouselJson(raw);
                  const parsed = safeParseCarouselCards(raw);
                  if (parsed) {
                    setCarouselCards(parsed);
                    const btnRows: Record<number, CarouselButtonRow[]> = {};
                    for (let i = 0; i < parsed.length; i++) {
                      btnRows[i] = rowsFromApiButtons(parsed[i]?.buttons);
                    }
                    setCarouselButtonRowsByIndex(btnRows);
                  }
                }}
                placeholder={`[\n  {\n    \"headerFormat\": \"IMAGE\",\n    \"headerHandle\": \"…\",\n    \"body\": \"…\",\n    \"buttons\": []\n  }\n]`}
              />
            </div>
          </details>
          </div>
        </div>
      )}

      <div className="my-2 border-t border-base-300" />

      {/* ── Section 3: Advanced settings ── */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 op-label hover:text-base-content/60 select-none">
            <span>Advanced</span>
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 6 10" fill="currentColor">
              <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        </summary>

        <div className="mt-4 space-y-4">
          <label className="form-control w-full max-w-xs">
            <span className="label-text text-xs">Parameter format</span>
            <select
              className="select select-bordered select-sm w-full"
              value={parameterFormat}
              onChange={(e) =>
                setParameterFormat(e.target.value as "POSITIONAL" | "NAMED")
              }
            >
              <option value="POSITIONAL">Positional — {"{{1}}"}, {"{{2}}"}</option>
              <option value="NAMED">Named — {"{{name}}"}, {"{{date}}"}</option>
            </select>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-box border border-base-300 bg-base-200 px-3 py-2 max-w-xl">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-0.5"
              checked={allowCategoryChange}
              onChange={(e) => setAllowCategoryChange(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Allow Meta category auto-match</span>
              <span className="block text-xs text-base-content/60 mt-0.5">
                Uncheck to prevent Meta from auto-reclassifying this template to marketing
                on first sync (<code className="text-xs">allow_category_change: false</code>).
              </span>
            </span>
          </label>

          <details className="group/vars">
            <summary className="cursor-pointer text-xs text-base-content/60 hover:text-base-content">
              Advanced: variables metadata (optional)
            </summary>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-base-content/50">
                Optional JSON array of variable metadata (e.g. display names for campaign variable pickers). Most templates don&apos;t need this — leave blank unless you know what it does.
              </p>
              <textarea
                className="textarea textarea-bordered w-full min-h-[80px] font-mono text-xs"
                value={variablesJson}
                onChange={(e) => setVariablesJson(e.target.value)}
                placeholder='[{"key": "first_name", "label": "First name"}]'
              />
            </div>
          </details>
        </div>
      </details>

      {/* Bottom save */}
      <div className="flex justify-end pt-1">
        {SaveButton}
      </div>
    </div>
  );
});
