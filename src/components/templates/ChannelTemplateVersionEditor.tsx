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
  TemplateOtpType,
  TemplateVersionLayoutType,
} from "@/lib/types";
import {
  DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE,
  WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS,
} from "@/lib/whatsapp-template-languages";
import { CopyableId } from "@/components/ui/CopyableId";
import { getApiError } from "@/lib/api-error";
import { WhatsAppTemplatePreview } from "@/components/templates/WhatsAppTemplatePreview";
import { LanguageCombobox } from "@/components/templates/LanguageCombobox";
import {
  lintTemplateDraft,
  extractVariableNames,
} from "@/lib/whatsapp-template-lint";
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
const META_TEMPLATE_BUTTON_LABEL_MAX = 25;
/** COPY_CODE (coupon) sample-code limit — Meta coupon templates. */
const COUPON_CODE_MAX = 20;
/** Carousel card body limit (Meta) — far tighter than the 1024 main body. */
const CAROUSEL_CARD_BODY_MAX = 160;
/** Meta header media caps, per type: image 5 MB, video 16 MB, document 100 MB. */
const HEADER_MEDIA_MAX_BYTES_BY_TYPE: Record<string, number> = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 16 * 1024 * 1024,
  DOCUMENT: 100 * 1024 * 1024,
};
/** Largest header media cap (document); used where the type isn't known up front. */
const HEADER_MEDIA_MAX_BYTES = HEADER_MEDIA_MAX_BYTES_BY_TYPE.DOCUMENT;

// COPY_CODE (coupon) is valid only on STANDARD templates — Meta doesn't allow it
// in carousel cards, so the standard button editor offers it but the carousel one doesn't.
type CarouselButtonUiType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";

type CarouselButtonRow = {
  id: string;
  type: CarouselButtonUiType;
  text: string;
  url: string;
  phone_number: string;
  /** COPY_CODE only: sample coupon code (Meta `example`), ≤20 chars. */
  example: string;
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
    example: "",
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
        example: "",
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
        example: "",
      };
    }
    if (type === "COPY_CODE") {
      return {
        id,
        type: "COPY_CODE",
        text: "",
        url: "",
        phone_number: "",
        example: String((btn as { example?: string; code?: string }).example ?? (btn as { code?: string }).code ?? ""),
      };
    }
    return {
      id,
      type: "QUICK_REPLY",
      text,
      url: "",
      phone_number: "",
      example: "",
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
    if (r.type === "COPY_CODE") {
      return { type: "COPY_CODE", example: r.example.trim() };
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
  const isAuth = channelCategory === "AUTHENTICATION";
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
  // AUTHENTICATION-template config (Meta-fixed shape; no header/body/footer/buttons).
  const [authOtpType, setAuthOtpType] = useState<TemplateOtpType>("COPY_CODE");
  const [authButtonText, setAuthButtonText] = useState("Copy code");
  const [authSecurityRec, setAuthSecurityRec] = useState(false);
  const [authExpiryMinutes, setAuthExpiryMinutes] = useState("");
  const [authAutofillText, setAuthAutofillText] = useState("Autofill");
  const [authPackageName, setAuthPackageName] = useState("");
  const [authSignatureHash, setAuthSignatureHash] = useState("");
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
  /** Preview-only sample values keyed by variable token ("1", "name", …). Not persisted. */
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});

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
    const ac = version.authConfig ?? null;
    setAuthOtpType(
      ac?.otpType === "ONE_TAP" || ac?.otpType === "ZERO_TAP" ? ac.otpType : "COPY_CODE"
    );
    setAuthButtonText(ac?.buttonText ?? "Copy code");
    setAuthSecurityRec(ac?.addSecurityRecommendation === true);
    setAuthExpiryMinutes(
      typeof ac?.codeExpirationMinutes === "number" ? String(ac.codeExpirationMinutes) : ""
    );
    setAuthAutofillText(ac?.autofillText ?? "Autofill");
    setAuthPackageName(ac?.packageName ?? "");
    setAuthSignatureHash(ac?.signatureHash ?? "");
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
    version.authConfig,
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

  // Distinct variable tokens across body / text header / carousel card bodies —
  // drives the "preview with sample data" inputs.
  const detectedVariables = useMemo(() => {
    const names = new Set<string>();
    for (const n of extractVariableNames(body)) names.add(n);
    if (headerType === "TEXT")
      for (const n of extractVariableNames(headerContent)) names.add(n);
    if (layoutType === "CAROUSEL")
      for (const c of carouselCards)
        for (const n of extractVariableNames(String(c.body ?? ""))) names.add(n);
    return [...names];
  }, [body, headerType, headerContent, layoutType, carouselCards]);

  // Non-blocking Meta-policy lint, surfaced live so authors fix issues before submit.
  const lintIssues = useMemo(() => {
    if (isAuth) return [];
    const btns = (standardButtonRows ?? []).map((r) => ({
      type: r.type,
      text: r.text,
      url: r.url,
    }));
    return lintTemplateDraft({ body, footer, parameterFormat, buttons: btns });
  }, [isAuth, body, footer, parameterFormat, standardButtonRows]);

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
      const cap = HEADER_MEDIA_MAX_BYTES_BY_TYPE[headerType] ?? HEADER_MEDIA_MAX_BYTES;
      if (file.size > cap) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        const capMb = (cap / (1024 * 1024)).toFixed(0);
        setFormError(
          `Header media is ${mb} MB — Meta limit for ${headerType.toLowerCase()} is ${capMb} MB. Resize or compress before uploading.`
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
    [headerType]
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

    // Drafts are a scratchpad — Meta-policy checks (placeholders, sensitive data,
    // button counts, URL shorteners, length caps, etc.) run at Submit-for-approval
    // time on the server. Here we only do what's needed to build a valid payload:
    // JSON parse so we can serialise buttons/variables/carouselCards.
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

    const b = body;
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

    if (layoutType === "STANDARD") {
      // standardButtonRows is the UI source of truth; derive the payload from it
      // directly so a missed mirror into buttonsJson can never desync the save.
      payload.buttons = standardButtonRows
        ? (rowsToApiButtons(standardButtonRows) as unknown[])
        : [];
    } else if (parsedButtons.value !== undefined) {
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

    // AUTHENTICATION templates carry no free content — overwrite with the fixed OTP shape.
    if (isAuth) {
      const expiry = authExpiryMinutes.trim() ? Number(authExpiryMinutes) : undefined;
      payload.authConfig = {
        otpType: authOtpType,
        buttonText: authButtonText.trim() || undefined,
        addSecurityRecommendation: authSecurityRec,
        ...(expiry != null && !Number.isNaN(expiry)
          ? { codeExpirationMinutes: expiry }
          : {}),
        ...(authOtpType !== "COPY_CODE"
          ? {
              autofillText: authAutofillText.trim() || undefined,
              packageName: authPackageName.trim() || undefined,
              signatureHash: authSignatureHash.trim() || undefined,
              ...(authOtpType === "ZERO_TAP" ? { zeroTapTermsAccepted: true } : {}),
            }
          : {}),
      };
      payload.body = "";
      payload.headerType = "NONE";
      payload.headerContent = null;
      payload.footer = null;
      payload.buttons = [];
      payload.variables = [];
      payload.carouselCards = null;
      payload.layoutType = "STANDARD";
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
    standardButtonRows,
    variablesJson,
    carouselJson,
    carouselCards,
    carouselButtonRowsByIndex,
    channelTemplateId,
    version.version,
    updateMutation,
    allowCategoryChange,
    isAuth,
    authOtpType,
    authButtonText,
    authSecurityRec,
    authExpiryMinutes,
    authAutofillText,
    authPackageName,
    authSignatureHash,
  ]);

  // Autosave: after manual "Save draft" succeeds, keep persisting edits with debounce.
  // Mirrors the same permissive contract as onSave — only bail when the payload
  // can't actually be built (in-flight upload, unparseable JSON).
  useEffect(() => {
    if (!editable) return;
    if (!autoSaveAfterManual) return;
    if (updateMutation.isPending) return;
    if (uploadBusy) return;
    if (Object.values(carouselUploadBusyByIndex).some(Boolean)) return;

    if (!parseJsonOptional(buttonsJson, "Buttons").ok) return;
    if (!parseJsonOptional(variablesJson, "Variables").ok) return;
    if (!parseJsonOptional(carouselJson, "Carousel cards").ok) return;

    const signature = JSON.stringify({
      body: body.trim(),
      footer: footer.trim(),
      headerType,
      headerContent: headerContent.trim(),
      language,
      parameterFormat,
      layoutType,
      standardButtonRows,
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
    standardButtonRows,
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
        category={channelCategory}
        sampleValues={sampleValues}
        authConfig={
          isAuth
            ? {
                otpButtonText: authButtonText,
                addSecurityRecommendation: authSecurityRec,
                codeExpirationMinutes: authExpiryMinutes.trim()
                  ? Number(authExpiryMinutes)
                  : null,
              }
            : null
        }
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
    channelCategory,
    sampleValues,
    isAuth,
    authButtonText,
    authSecurityRec,
    authExpiryMinutes,
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
              {/* MsgBuddy id used as `channelTemplateVersionId` on POST /v2/messages.
                  Rendered above the Meta-side `providerVersionId` and named distinctly
                  so the two aren't confused — they look similar at a glance but only
                  one of them is what the API wants. */}
              <div className="col-span-2 pt-1">
                <CopyableId
                  value={version.id}
                  label="channelTemplateVersionId"
                  srLabel="channel template version id"
                  className="min-w-0 max-w-full"
                />
                <p className="mt-0.5 font-mono-op text-[0.625rem] text-base-content/35">
                  POST /v2/messages — this is the id your app sends with.
                </p>
              </div>
              {version.providerVersionId && (
                <div className="col-span-2">
                  <span className="text-base-content/50">Provider version ID (Meta)</span>{" "}
                  <span className="font-mono break-all">{version.providerVersionId}</span>
                  <p className="mt-0.5 font-mono-op text-[0.625rem] text-base-content/35">
                    Meta-side id. For tracing in Meta Business Manager only — not
                    used by the send API.
                  </p>
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
          {!isAuth && (
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
          )}
          <label className="form-control w-full">
            <span className="label-text text-xs">Language</span>
            <LanguageCombobox
              value={language}
              options={languageOptions}
              onChange={setLanguage}
              disabled={!editable}
            />
          </label>
        </div>
      </div>

      <div className="my-2 border-t border-base-300" />

      {/* ── Authentication template (Meta-fixed shape) ── */}
      {isAuth && (
        <div className="space-y-3">
          <div className="op-label">One-time passcode</div>
          <p className="text-[0.75rem] text-base-content/55">
            Meta auto-generates the message body (e.g. <span className="font-mono-op">123456 is your verification code.</span>).
            You configure the OTP button and options only — no header, custom body, or extra buttons.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control w-full">
              <span className="label-text text-xs">Delivery</span>
              <select
                className="select select-bordered select-sm w-full"
                value={authOtpType}
                onChange={(e) => setAuthOtpType(e.target.value as TemplateOtpType)}
              >
                <option value="COPY_CODE">Copy code</option>
                <option value="ONE_TAP">One-tap autofill</option>
                <option value="ZERO_TAP">Zero-tap</option>
              </select>
            </label>
            <label className="form-control w-full">
              <span className="label-text text-xs">Button label</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={authButtonText}
                maxLength={META_TEMPLATE_BUTTON_LABEL_MAX}
                onChange={(e) => setAuthButtonText(e.target.value)}
                placeholder="Copy code"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={authSecurityRec}
                onChange={(e) => setAuthSecurityRec(e.target.checked)}
              />
              <span className="label-text text-xs">
                Add security recommendation line
              </span>
            </label>
            <label className="form-control w-full">
              <span className="label-text text-xs">Code expires after (minutes)</span>
              <input
                type="number"
                min={1}
                max={90}
                className="input input-bordered input-sm w-full"
                value={authExpiryMinutes}
                onChange={(e) => setAuthExpiryMinutes(e.target.value)}
                placeholder="Optional · 1–90"
              />
            </label>
          </div>
          {authOtpType !== "COPY_CODE" && (
            <div className="space-y-3 rounded-box border border-base-300 bg-base-200 p-3">
              <p className="text-[0.75rem] text-base-content/60">
                Autofill needs your Android app identity (from Meta &amp; your app signing key).
              </p>
              <label className="form-control w-full">
                <span className="label-text text-xs">Autofill button text</span>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={authAutofillText}
                  maxLength={META_TEMPLATE_BUTTON_LABEL_MAX}
                  onChange={(e) => setAuthAutofillText(e.target.value)}
                  placeholder="Autofill"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="form-control w-full">
                  <span className="label-text text-xs">Package name</span>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full font-mono-op"
                    value={authPackageName}
                    onChange={(e) => setAuthPackageName(e.target.value)}
                    placeholder="com.example.app"
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-xs">Signature hash</span>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full font-mono-op"
                    value={authSignatureHash}
                    onChange={(e) => setAuthSignatureHash(e.target.value)}
                    placeholder="11 chars"
                  />
                </label>
              </div>
              {authOtpType === "ZERO_TAP" && (
                <p className="text-[0.6875rem] text-warning">
                  Zero-tap requires that you&apos;ve accepted Meta&apos;s zero-tap terms and that your
                  app handles the delivered code automatically.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Section 2: Message (Standard layout) ── */}
      {!isAuth && layoutType === "STANDARD" && (
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
                <span className="label-text-alt text-base-content/50">
                  At most one variable allowed in the header (Meta).
                </span>
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

          {/* Live Meta-policy lint (non-blocking; server re-checks at submit) */}
          {!isAuth && lintIssues.length > 0 && (
            <div className="space-y-1">
              {lintIssues.map((iss, i) => (
                <div
                  key={i}
                  className={`rounded-md border px-2 py-1 text-[0.6875rem] ${
                    iss.level === "error"
                      ? "border-error/30 bg-error/5 text-error"
                      : "border-warning/30 bg-warning/5 text-warning"
                  }`}
                >
                  {iss.message}
                </div>
              ))}
              <p className="text-[0.625rem] text-base-content/45">
                Meta policy checks — fix these before submitting for approval.
              </p>
            </div>
          )}

          {/* Preview with sample data (not persisted — right-panel preview only) */}
          {!isAuth && detectedVariables.length > 0 && (
            <div className="space-y-2 rounded-box border border-base-300 bg-base-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Preview with sample data</span>
                <span className="text-[0.625rem] text-base-content/50">
                  Not saved · preview only
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {detectedVariables.map((name) => (
                  <label key={name} className="form-control">
                    <span className="label-text font-mono-op text-[0.6875rem]">
                      {`{{${name}}}`}
                    </span>
                    <input
                      className="input input-bordered input-xs w-full"
                      value={sampleValues[name] ?? ""}
                      onChange={(e) =>
                        setSampleValues((p) => ({ ...p, [name]: e.target.value }))
                      }
                      placeholder="Sample value"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

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
                Optional · up to 10 total (max 2 URL + 1 phone)
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
                            if (t !== "URL") cur.url = "";
                            if (t !== "PHONE_NUMBER") cur.phone_number = "";
                            if (t !== "COPY_CODE") cur.example = "";
                            if (t === "COPY_CODE") cur.text = ""; // Meta fixes the label
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
                        <option value="COPY_CODE">Copy code (coupon)</option>
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

                  {row.type !== "COPY_CODE" && (
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
                  )}

                  {row.type === "COPY_CODE" && (
                    <label className="form-control w-full">
                      <span className="label-text text-xs">
                        Sample coupon code ({row.example.length}/{COUPON_CODE_MAX})
                      </span>
                      <input
                        type="text"
                        className="input input-bordered input-xs w-full font-mono text-xs"
                        maxLength={COUPON_CODE_MAX}
                        value={row.example}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStandardButtonRows((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            next[bi] = { ...next[bi], example: v };
                            setButtonsJson(
                              JSON.stringify(rowsToApiButtons(next), null, 2)
                            );
                            return next;
                          });
                        }}
                        placeholder="e.g. SAVE20"
                      />
                      <span className="mt-0.5 text-xs text-base-content/50">
                        The label is fixed by WhatsApp (&ldquo;Copy code&rdquo;). The real code is
                        supplied per send. Max {COUPON_CODE_MAX} chars.
                      </span>
                    </label>
                  )}

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
                        disabled={carouselCards.length <= 2}
                        title={
                          carouselCards.length <= 2
                            ? "A carousel needs at least 2 cards (Meta)"
                            : "Remove card"
                        }
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
                              const cardCap =
                                HEADER_MEDIA_MAX_BYTES_BY_TYPE[card.headerFormat] ??
                                HEADER_MEDIA_MAX_BYTES;
                              if (file.size > cardCap) {
                                const mb = (file.size / (1024 * 1024)).toFixed(1);
                                const capMb = (cardCap / (1024 * 1024)).toFixed(0);
                                setFormError(
                                  `Card ${idx + 1} header media is ${mb} MB — Meta limit for ${card.headerFormat.toLowerCase()} is ${capMb} MB. Resize or compress before uploading.`
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
                      <div className="flex items-center justify-between">
                        <span className="label-text text-xs">Body · required</span>
                        <span
                          className={`text-[0.6875rem] ${charCounterClass(
                            card.body.length,
                            CAROUSEL_CARD_BODY_MAX
                          )}`}
                        >
                          {card.body.length}/{CAROUSEL_CARD_BODY_MAX}
                        </span>
                      </div>
                      <textarea
                        className="textarea textarea-bordered w-full min-h-[100px] text-sm"
                        value={card.body}
                        maxLength={CAROUSEL_CARD_BODY_MAX}
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
                          1–2 buttons · label max {META_TEMPLATE_BUTTON_LABEL_MAX} chars (Meta)
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
                        disabled={btnRowsForCard.length >= 2}
                        title={
                          btnRowsForCard.length >= 2
                            ? "A carousel card allows at most 2 buttons (Meta)"
                            : undefined
                        }
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

      {/* ── Section 3: Advanced settings (not applicable to authentication templates) ── */}
      {!isAuth && (
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
      )}

      {/* Bottom save */}
      <div className="flex justify-end pt-1">
        {SaveButton}
      </div>
    </div>
  );
});
