"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const BODY_MAX = 1024;
const FOOTER_MAX = 60;
const HEADER_TEXT_MAX = 60;

function charCounterClass(current: number, max: number): string {
  const ratio = current / max;
  if (ratio >= 1) return "text-error font-semibold";
  if (ratio >= 0.9) return "text-warning";
  return "text-base-content/50";
}

/** Replace {{N}}/{{name}} placeholders with highlighted spans for preview. */
function renderPreviewBody(text: string): React.ReactNode {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part) ? (
      <span key={i} className="bg-primary/15 text-primary rounded px-0.5 font-mono text-xs">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function WhatsAppBubblePreview({
  headerType,
  headerContent,
  body,
  footer,
  buttons,
}: {
  headerType: string;
  headerContent: string;
  body: string;
  footer: string;
  buttons: Array<{ type: string; text: string }>;
}) {
  return (
    <div className="flex justify-center py-2">
      <div className="w-full max-w-xs bg-[#dcf8c6] rounded-xl shadow-md p-3 space-y-2 text-sm text-gray-800 dark:bg-[#1f5c36] dark:text-gray-100">
        {headerType !== "NONE" && (
          <div className="rounded-lg bg-black/10 dark:bg-white/10 px-2 py-1.5 text-xs font-medium text-center">
            {headerType === "TEXT" ? (
              <span>{headerContent || <span className="opacity-50 italic">Header text</span>}</span>
            ) : (
              <span className="opacity-70 uppercase tracking-wide">{headerType}</span>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words leading-snug">
          {body ? renderPreviewBody(body) : <span className="opacity-40 italic">Message body…</span>}
        </div>
        {footer && (
          <div className="text-xs opacity-60 border-t border-black/10 dark:border-white/10 pt-1.5">
            {footer}
          </div>
        )}
        {buttons.length > 0 && (
          <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1.5">
            {buttons.map((btn, i) => (
              <div
                key={i}
                className="text-center text-[#075e54] dark:text-[#44c767] text-xs font-semibold py-1 rounded bg-white/60 dark:bg-white/10"
              >
                {btn.type === "URL" ? "🔗 " : btn.type === "PHONE_NUMBER" ? "📞 " : ""}
                {btn.text || "(button)"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const HEADER_TYPES: TemplateHeaderType[] = [
  "NONE",
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
];

/** Meta template button label limit (QUICK_REPLY / URL / PHONE_NUMBER). */
const META_TEMPLATE_BUTTON_LABEL_MAX = 25;

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
      return { type: "URL", text: r.text.trim(), url: r.url.trim() };
    }
    if (r.type === "PHONE_NUMBER") {
      return {
        type: "PHONE_NUMBER",
        text: r.text.trim(),
        phone_number: r.phone_number.trim(),
      };
    }
    return { type: "QUICK_REPLY", text: r.text.trim() };
  });
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

function starterCarouselCards(count = 3): TemplateCarouselCard[] {
  return Array.from({ length: count }, (_, i) => ({
    headerFormat: "IMAGE",
    headerHandle: "",
    body: `Card ${i + 1} body…`,
    buttons: [{ type: "QUICK_REPLY", text: "Learn more" }],
  }));
}

export function ChannelTemplateVersionEditor({
  channelTemplateId,
  version,
  onCopyAsNewDraft,
  channelCategory,
  onAutoSwitchCategoryToMarketing,
}: {
  channelTemplateId: string;
  version: ChannelTemplateVersion;
  onCopyAsNewDraft?: () => void;
  channelCategory?: TemplateCategory | null;
  onAutoSwitchCategoryToMarketing?: () => void;
}) {
  const editable = version.status === "DRAFT" && !version.isLocked;
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
  const [showPreview, setShowPreview] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [carouselUploadBusyByIndex, setCarouselUploadBusyByIndex] = useState<
    Record<number, boolean>
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
  }, [layoutType, channelCategory, onAutoSwitchCategoryToMarketing]);

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

  const onSave = useCallback((silent = false) => {
    if (!silent) setFormError(null);
    const b = body.trim();
    if (!b.length) {
      setFormError("Body is required.");
      return;
    }
    if (b.length > BODY_MAX) {
      setFormError(`Body must be at most ${BODY_MAX} characters.`);
      return;
    }
    if (footer.length > FOOTER_MAX) {
      setFormError(`Footer must be at most ${FOOTER_MAX} characters.`);
      return;
    }
    if (layoutType === "STANDARD") {
      if (headerType === "TEXT" && headerContent.length > HEADER_TEXT_MAX) {
        setFormError(`Text header must be at most ${HEADER_TEXT_MAX} characters.`);
        return;
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
          return;
        }
      }
    }

    const parsedButtons = parseJsonOptional(buttonsJson, "Buttons");
    if (!parsedButtons.ok) {
      setFormError(parsedButtons.error);
      return;
    }
    const parsedVars = parseJsonOptional(variablesJson, "Variables");
    if (!parsedVars.ok) {
      setFormError(parsedVars.error);
      return;
    }
    const parsedCarousel = parseJsonOptional(carouselJson, "Carousel cards");
    if (!parsedCarousel.ok) {
      setFormError(parsedCarousel.error);
      return;
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
          return;
        }
        if (label.length > META_TEMPLATE_BUTTON_LABEL_MAX) {
          setFormError(
            `Button ${i + 1}: label must be at most ${META_TEMPLATE_BUTTON_LABEL_MAX} characters.`
          );
          return;
        }
        if (r.type === "QUICK_REPLY") {
          quickReplyCount++;
        } else {
          ctaCount++;
        }
        if (r.type === "URL") {
          if (!r.url.trim()) {
            setFormError(`Button ${i + 1}: URL is required.`);
            return;
          }
          const placeholders = (r.url.match(/\{\{[^}]+\}\}/g) ?? []).length;
          if (placeholders !== 1) {
            setFormError(
              `Button ${i + 1}: URL must contain exactly 1 placeholder (found ${placeholders}).`
            );
            return;
          }
        }
        if (r.type === "PHONE_NUMBER" && !r.phone_number.trim()) {
          setFormError(`Button ${i + 1}: phone number is required.`);
          return;
        }
      }
      if (quickReplyCount > QUICK_REPLY_MAX) {
        setFormError(`Too many quick-reply buttons (${quickReplyCount}); max is ${QUICK_REPLY_MAX}.`);
        return;
      }
      if (ctaCount > CTA_MAX) {
        setFormError(`Too many CTA buttons (${ctaCount}); max is ${CTA_MAX}.`);
        return;
      }
    }

    if (layoutType === "CAROUSEL") {
      if (carouselCards.length === 0) {
        setFormError("Add at least one carousel card.");
        return;
      }
      for (let i = 0; i < carouselCards.length; i++) {
        const c = carouselCards[i];
        if (!c?.body?.trim()) {
          setFormError(`Card ${i + 1}: body is required.`);
          return;
        }
        if (!c?.headerHandle?.trim()) {
          setFormError(
            `Card ${i + 1}: upload a header file or paste the asset handle (headerHandle).`
          );
          return;
        }
        const rows = carouselButtonRowsByIndex[i] ?? [];
        if (rows.length === 0) {
          setFormError(`Card ${i + 1}: add at least one button.`);
          return;
        }
        for (let j = 0; j < rows.length; j++) {
          const r = rows[j];
          const label = r.text.trim();
          if (!label) {
            setFormError(`Card ${i + 1}, button ${j + 1}: label is required.`);
            return;
          }
          if (label.length > META_TEMPLATE_BUTTON_LABEL_MAX) {
            setFormError(
              `Card ${i + 1}, button ${j + 1}: label must be at most ${META_TEMPLATE_BUTTON_LABEL_MAX} characters (Meta).`
            );
            return;
          }
          if (r.type === "URL" && !r.url.trim()) {
            setFormError(`Card ${i + 1}, button ${j + 1}: URL is required.`);
            return;
          }
          if (r.type === "PHONE_NUMBER" && !r.phone_number.trim()) {
            setFormError(
              `Card ${i + 1}, button ${j + 1}: phone number is required (E.164, e.g. +15551234567).`
            );
            return;
          }
        }
      }
    }

    const payload: ChannelTemplateVersionUpdatePayload = {
      body: b,
      footer: footer.trim() ? footer.trim() : null,
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
      payload.headerContent =
        headerType === "NONE" ? null : headerContent.trim();
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
          body: String(c.body ?? "").trim(),
          buttons,
        };
      });
      payload.carouselCards = cardsForApi as unknown[];
      setCarouselJson(JSON.stringify(cardsForApi, null, 2));
    }
    if (layoutType === "STANDARD") {
      payload.carouselCards = null;
    }

    updateMutation.mutate(
      { id: channelTemplateId, version: version.version, data: payload },
      {
        onSuccess: () => {
          if (!silent) {
            setSaveOk("Saved.");
            setFormError(null);
            // Start auto-saving after the first successful manual save.
            setAutoSaveAfterManual(true);
            window.setTimeout(() => setSaveOk(null), 4000);
          } else {
            setSaveOk(null);
          }
        },
        onError: (err) => {
          setSaveOk(null);
          if (!silent) setFormError(getApiError(err));
        },
      }
    );
  }, [
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

  if (!editable) {
    const advanced = [
      { label: "Buttons", value: version.buttons },
      { label: "Variables", value: version.variables },
      { label: "Carousel cards", value: version.carouselCards },
    ].filter((x) => x.value != null);

    return (
      <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-base-content/80">
              Version snapshot (read-only)
            </div>
            <p className="text-xs text-base-content/60">
              {version.isLocked
                ? "This version is locked."
                : "Only draft versions can be edited in the UI."}
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
    <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-5">

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
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
          {SaveButton}
        </div>
      </div>

      {formError && (
        <div role="alert" className="alert alert-error text-sm py-2">
          <span>{formError}</span>
        </div>
      )}
      {saveOk && !formError && (
        <div role="status" className="alert alert-success text-sm py-2">
          <span>{saveOk}</span>
        </div>
      )}

      {/* ── Section 1: Structure ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">Structure</div>
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

      <div className="divider my-0" />

      {/* ── Section 2: Message (Standard layout) ── */}
      {layoutType === "STANDARD" && (
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">Message</div>

          {/* Header */}
          <div className="space-y-2">
            <label className="form-control w-full">
              <span className="label-text text-xs">Header type</span>
              <select
                className="select select-bordered select-sm w-full max-w-xs"
                value={headerType}
                onChange={(e) => setHeaderType(e.target.value as TemplateHeaderType)}
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
                <span className="label-text text-xs">
                  Header media — upload or paste asset handle
                </span>
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
                <input
                  type="text"
                  className="input input-bordered input-sm w-full font-mono text-xs"
                  value={headerContent}
                  onChange={(e) => setHeaderContent(e.target.value)}
                  placeholder="Asset handle from upload"
                />
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
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">Message</div>

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
                  const starter = starterCarouselCards(3);
                  setCarouselCards(starter);
                  const br: Record<number, CarouselButtonRow[]> = {};
                  for (let i = 0; i < starter.length; i++) {
                    br[i] = rowsFromApiButtons(starter[i]?.buttons);
                  }
                  setCarouselButtonRowsByIndex(br);
                  setCarouselJson(JSON.stringify(starter, null, 2));
                }}
              >
                Starter 3 cards
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setCarouselCards((prev) => {
                    const nextIndex = prev.length;
                    setCarouselButtonRowsByIndex((b) => ({
                      ...b,
                      [nextIndex]: [defaultCarouselButtonRow()],
                    }));
                    setCarouselUploadBusyByIndex((u) => ({ ...u, [nextIndex]: false }));
                    return [
                      ...prev,
                      {
                        headerFormat: "IMAGE",
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
              No cards yet. Click <span className="font-medium">Starter 3 cards</span> or{" "}
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
                    className="rounded-box border border-base-300 bg-base-100 p-3 space-y-3"
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
                            setCarouselCards((prev) =>
                              prev.map((c, i) =>
                                i === idx ? { ...c, headerFormat: v } : c
                              )
                            );
                          }}
                        >
                          <option value="IMAGE">IMAGE</option>
                          <option value="VIDEO">VIDEO</option>
                        </select>
                      </label>

                      <label className="form-control w-full">
                        <span className="label-text text-xs">Header handle</span>
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full font-mono text-xs"
                          value={card.headerHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCarouselCards((prev) =>
                              prev.map((c, i) =>
                                i === idx ? { ...c, headerHandle: v } : c
                              )
                            );
                          }}
                          placeholder="Upload to get handle, or paste existing"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        className="file-input file-input-bordered file-input-sm max-w-full"
                        accept={accept}
                        disabled={Boolean(carouselUploadBusyByIndex[idx])}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
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
                        title="Upload header media for this card"
                      />
                      {carouselUploadBusyByIndex[idx] && (
                        <span className="loading loading-spinner loading-sm" />
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

      <div className="divider my-0" />

      {/* ── Section 3: Advanced settings ── */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/40 hover:text-base-content/60 select-none">
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
                Optional JSON array of variable metadata (e.g. display names for campaign variable pickers). Most templates don't need this — leave blank unless you know what it does.
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

      {/* WhatsApp bubble preview */}
      {showPreview && (
        <div className="rounded-box border border-base-300 bg-base-200/50 p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Preview
          </div>
          {layoutType === "STANDARD" ? (
            <WhatsAppBubblePreview
              headerType={headerType}
              headerContent={headerContent}
              body={body}
              footer={footer}
              buttons={
                standardButtonRows
                  ? standardButtonRows.map((r) => ({ type: r.type, text: r.text }))
                  : []
              }
            />
          ) : (
            <div className="space-y-3">
              {body.trim() && (
                <div className="text-xs text-base-content/60 italic">
                  Carousel intro: {renderPreviewBody(body)}
                </div>
              )}
              {carouselCards.length === 0 ? (
                <div className="text-xs text-base-content/50">No carousel cards yet.</div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {carouselCards.map((card, idx) => (
                    <div key={idx} className="min-w-[200px] max-w-[220px]">
                      <WhatsAppBubblePreview
                        headerType={card.headerFormat ?? "IMAGE"}
                        headerContent={card.headerHandle ?? ""}
                        body={card.body ?? ""}
                        footer=""
                        buttons={
                          (carouselButtonRowsByIndex[idx] ?? []).map((r) => ({
                            type: r.type,
                            text: r.text,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom save */}
      <div className="flex justify-end pt-1">
        {SaveButton}
      </div>
    </div>
  );
}
