"use client";

import { useCallback, useState } from "react";
import { useResumableUpload } from "@/hooks/use-resumable-upload";
import type {
  TemplateCarouselCard,
  TemplateCategory,
  TemplateHeaderType,
  TemplateVersion,
  TemplateVersionLayoutType,
  TemplateVersionPayload,
} from "@/lib/types";

/** Counts {{...}} placeholders in a string. */
function countPlaceholders(s: string): number {
  return (s.match(/\{\{[^}]+\}\}/g) || []).length;
}

const CAROUSEL_MIN_CARDS = 2;
const CAROUSEL_MAX_CARDS = 10;

const DEFAULT_BUTTON = { type: "QUICK_REPLY", text: "" };
const DEFAULT_CAROUSEL_CARD: TemplateCarouselCard = {
  headerFormat: "IMAGE",
  headerHandle: "",
  body: "",
  buttons: [{ ...DEFAULT_BUTTON }],
};

export type TemplateVersionEditorProps = {
  templateCategory: TemplateCategory;
  initial: TemplateVersion | null;
  onSave: (payload: TemplateVersionPayload) => void;
  onCancel: () => void;
  isPending: boolean;
  mode: "create" | "update";
};

export function TemplateVersionEditor({
  templateCategory,
  initial,
  onSave,
  onCancel,
  isPending,
  mode,
}: TemplateVersionEditorProps) {
  const [language, setLanguage] = useState(initial?.language ?? "en");
  const [layoutType, setLayoutType] = useState<TemplateVersionLayoutType>(
    initial?.layoutType ?? "STANDARD"
  );
  const [headerType, setHeaderType] = useState<TemplateHeaderType>(
    initial?.headerType ?? "NONE"
  );
  const [headerContent, setHeaderContent] = useState(
    initial?.headerContent ?? ""
  );
  const [body, setBody] = useState(initial?.body ?? "");
  const [footer, setFooter] = useState(initial?.footer ?? "");
  const [buttons, setButtons] = useState(
    initial?.buttons ?? [{ type: "QUICK_REPLY", text: "" }]
  );
  const [carouselCards, setCarouselCards] = useState<TemplateCarouselCard[]>(
    initial?.carouselCards && initial.carouselCards.length >= CAROUSEL_MIN_CARDS
      ? initial.carouselCards
      : [
          { ...DEFAULT_CAROUSEL_CARD },
          { ...DEFAULT_CAROUSEL_CARD },
        ]
  );
  const [errors, setErrors] = useState<string[]>([]);
  const {
    upload,
    progress,
    uploading,
    error: uploadError,
    cancel,
  } = useResumableUpload();

  const validate = useCallback((): boolean => {
    const err: string[] = [];
    if (!body.trim()) err.push("Body is required.");
    if (layoutType === "STANDARD" && headerType !== "NONE") {
      const isMediaHeader = ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType);
      if (isMediaHeader && !headerContent.trim()) {
        err.push("Upload a file for the header or use a different header type.");
      }
    }
    if (layoutType === "STANDARD" && buttons.length) {
      buttons.forEach((b, i) => {
        if (b.type === "URL") {
          if (!b.url?.trim()) {
            err.push(`URL button ${i + 1}: URL is required.`);
          } else {
            const n = countPlaceholders(b.url);
            if (n !== 1) {
              err.push(
                `URL button ${i + 1}: must contain exactly one placeholder (e.g. {{1}} or {{tracking_id}}). Found ${n}.`
              );
            }
          }
        }
      });
    }
    if (layoutType === "CAROUSEL") {
      if (templateCategory !== "MARKETING") {
        err.push("Carousel is only allowed when template category is MARKETING.");
      }
      if (carouselCards.length < CAROUSEL_MIN_CARDS || carouselCards.length > CAROUSEL_MAX_CARDS) {
        err.push(`Carousel must have between ${CAROUSEL_MIN_CARDS} and ${CAROUSEL_MAX_CARDS} cards.`);
      }
      const formats = new Set(carouselCards.map((c) => c.headerFormat));
      if (formats.size > 1) err.push("All carousel cards must use the same header format (IMAGE or VIDEO).");
      carouselCards.forEach((card, i) => {
        if (!card.headerHandle?.trim()) err.push(`Card ${i + 1}: header handle is required.`);
        if (!card.body?.trim()) err.push(`Card ${i + 1}: body is required.`);
        if (!card.buttons?.length || card.buttons.every((b) => !b.text?.trim())) {
          err.push(`Card ${i + 1}: at least one button is required.`);
        }
      });
    }
    setErrors(err);
    return err.length === 0;
  }, [body, layoutType, headerType, headerContent, templateCategory, carouselCards, buttons]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    const payload: TemplateVersionPayload = {
      body: body.trim(),
      language,
      footer: footer.trim() || null,
      headerType: layoutType === "STANDARD" ? headerType : undefined,
      headerContent:
        layoutType === "STANDARD" && headerType !== "NONE"
          ? (headerContent.trim() || null)
          : null,
      layoutType,
    };
    if (layoutType === "STANDARD") {
      const cleanButtons = buttons
        .filter((b) => b.text?.trim())
        .map((b) => ({
          type: b.type || "QUICK_REPLY",
          text: b.text!.trim(),
          ...(b.type === "URL" && b.url ? { url: b.url.trim() } : {}),
          ...(b.phone_number ? { phone_number: b.phone_number } : {}),
        }));
      if (cleanButtons.length) payload.buttons = cleanButtons;
    }
    if (layoutType === "CAROUSEL") {
      payload.carouselCards = carouselCards.map((card) => ({
        headerFormat: card.headerFormat,
        headerHandle: card.headerHandle.trim(),
        body: card.body.trim(),
        buttons: card.buttons
          .filter((b) => b.text?.trim())
          .map((b) => ({
            type: b.type || "QUICK_REPLY",
            text: b.text!.trim(),
            ...(b.url ? { url: b.url } : {}),
            ...(b.phone_number ? { phone_number: b.phone_number } : {}),
          })),
      }));
      if (payload.carouselCards.some((c) => c.buttons.length === 0)) {
        setErrors((e) => [...e, "Each carousel card must have at least one button."]);
        return;
      }
    }
    onSave(payload);
  }, [
    validate,
    body,
    language,
    footer,
    layoutType,
    headerType,
    headerContent,
    buttons,
    carouselCards,
    onSave,
  ]);

  const addCarouselCard = () => {
    if (carouselCards.length >= CAROUSEL_MAX_CARDS) return;
    setCarouselCards((prev) => [...prev, { ...DEFAULT_CAROUSEL_CARD }]);
  };
  const removeCarouselCard = (index: number) => {
    if (carouselCards.length <= CAROUSEL_MIN_CARDS) return;
    setCarouselCards((prev) => prev.filter((_, i) => i !== index));
  };
  const updateCarouselCard = (index: number, updates: Partial<TemplateCarouselCard>) => {
    setCarouselCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };
  const setCarouselHeaderFormat = (format: "IMAGE" | "VIDEO") => {
    setCarouselCards((prev) =>
      prev.map((c) => ({ ...c, headerFormat: format }))
    );
  };

  const canUseCarousel = templateCategory === "MARKETING";

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <h3 className="font-semibold">
          {mode === "create" ? "Create version" : "Edit version"}
        </h3>

        {errors.length > 0 && (
          <div role="alert" className="alert alert-error alert-soft text-sm">
            <ul className="list-disc list-inside">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3 mt-3">
          <label className="form-control">
            <span className="label-text">Language</span>
            <input
              type="text"
              className="input input-bordered input-sm w-full max-w-xs"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
            />
          </label>

          <label className="form-control">
            <span className="label-text">Layout</span>
            <select
              className="select select-bordered select-sm w-full max-w-xs"
              value={layoutType}
              onChange={(e) =>
                setLayoutType(e.target.value as TemplateVersionLayoutType)
              }
            >
              <option value="STANDARD">Standard</option>
              <option value="CAROUSEL" disabled={!canUseCarousel}>
                Carousel {!canUseCarousel && "(MARKETING only)"}
              </option>
            </select>
          </label>

          {layoutType === "STANDARD" && (
            <>
              <label className="form-control">
                <span className="label-text">Header type</span>
                <select
                  className="select select-bordered select-sm w-full max-w-xs"
                  value={headerType}
                  onChange={(e) =>
                    setHeaderType(e.target.value as TemplateHeaderType)
                  }
                >
                  <option value="NONE">None</option>
                  <option value="TEXT">Text</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Document</option>
                </select>
              </label>
              {headerType === "TEXT" && (
                <label className="form-control">
                  <span className="label-text">Header content (text)</span>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full"
                    value={headerContent}
                    onChange={(e) => setHeaderContent(e.target.value)}
                    placeholder="Header text or {{1}}, {{name}}"
                  />
                </label>
              )}
              {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && (
                <div className="form-control">
                  <span className="label-text">Header ({headerType}) — upload file</span>
                  <input
                    type="file"
                    className="file-input file-input-bordered file-input-sm w-full max-w-md"
                    accept="image/jpeg,image/png,video/mp4,application/pdf"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const assetHandle = await upload(file);
                        setHeaderContent(assetHandle);
                      } catch {
                        // Error shown via uploadError
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                  {uploading && (
                    <div className="mt-1 space-y-1">
                      <progress
                        className="progress progress-primary w-full"
                        value={progress}
                        max={100}
                      />
                      <div className="flex items-center gap-2">
                        <span className="label-text-alt text-warning">
                          Uploading… {progress}%
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={cancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {uploadError && (
                    <span className="label-text-alt text-error mt-1">{uploadError}</span>
                  )}
                  {headerContent && !uploading && (
                    <span className="label-text-alt text-success mt-1">
                      Uploaded: {headerContent}
                    </span>
                  )}
                </div>
              )}
              <label className="form-control">
                <span className="label-text">Body (required)</span>
                <textarea
                  className="textarea textarea-bordered w-full"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Message body"
                />
              </label>
              <label className="form-control">
                <span className="label-text">Footer (optional)</span>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  placeholder="Footer text"
                />
              </label>
              <div>
                <span className="label-text block mb-1">Buttons (optional)</span>
                <div className="space-y-2">
                  {buttons.map((btn, i) => (
                    <div key={i} className="flex flex-col gap-1 p-2 rounded-lg bg-base-100 border border-base-300">
                      <div className="flex gap-2 items-center flex-wrap">
                        <select
                          className="select select-bordered select-sm w-32"
                          value={btn.type}
                          onChange={(e) =>
                            setButtons((prev) =>
                              prev.map((b, j) =>
                                j === i
                                  ? { ...b, type: e.target.value as "QUICK_REPLY" | "URL" | "PHONE_NUMBER", url: b.type === "URL" ? b.url : undefined }
                                  : b
                              )
                            )
                          }
                        >
                          <option value="QUICK_REPLY">Quick reply</option>
                          <option value="URL">URL</option>
                          <option value="PHONE_NUMBER">Phone</option>
                        </select>
                        <input
                          type="text"
                          className="input input-bordered input-sm flex-1 min-w-[120px]"
                          value={btn.text}
                          onChange={(e) =>
                            setButtons((prev) =>
                              prev.map((b, j) =>
                                j === i ? { ...b, text: e.target.value } : b
                              )
                            )
                          }
                          placeholder="Button text"
                        />
                        {buttons.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              setButtons((prev) => prev.filter((_, j) => j !== i))
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {btn.type === "URL" && (
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full"
                          value={btn.url ?? ""}
                          onChange={(e) =>
                            setButtons((prev) =>
                              prev.map((b, j) =>
                                j === i ? { ...b, url: e.target.value } : b
                              )
                            )
                          }
                          placeholder="URL with exactly one placeholder, e.g. https://example.com/{{1}}"
                        />
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      setButtons((prev) => [...prev, { ...DEFAULT_BUTTON }])
                    }
                  >
                    + Add button
                  </button>
                </div>
              </div>
            </>
          )}

          {layoutType === "CAROUSEL" && (
            <>
              <div>
                <span className="label-text block mb-1">
                  Carousel cards ({CAROUSEL_MIN_CARDS}–{CAROUSEL_MAX_CARDS})
                </span>
                <div className="form-control mb-2">
                  <span className="label-text">Header format (same for all)</span>
                  <select
                    className="select select-bordered select-sm w-32"
                    value={carouselCards[0]?.headerFormat ?? "IMAGE"}
                    onChange={(e) =>
                      setCarouselHeaderFormat(
                        e.target.value as "IMAGE" | "VIDEO"
                      )
                    }
                  >
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </div>
                <div className="space-y-4">
                  {carouselCards.map((card, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-base-300 p-3 bg-base-100"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-sm">Card {idx + 1}</span>
                        {carouselCards.length > CAROUSEL_MIN_CARDS && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => removeCarouselCard(idx)}
                          >
                            Remove card
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full"
                          placeholder="Header handle (media ID)"
                          value={card.headerHandle}
                          onChange={(e) =>
                            updateCarouselCard(idx, {
                              headerHandle: e.target.value,
                            })
                          }
                        />
                        <textarea
                          className="textarea textarea-bordered textarea-sm w-full"
                          placeholder="Card body"
                          value={card.body}
                          onChange={(e) =>
                            updateCarouselCard(idx, { body: e.target.value })
                          }
                          rows={2}
                        />
                        <div className="space-y-1">
                          {card.buttons.map((b, bi) => (
                            <div key={bi} className="flex gap-2 flex-wrap">
                              <input
                                type="text"
                                className="input input-bordered input-sm flex-1 min-w-[100px]"
                                placeholder="Button text"
                                value={b.text}
                                onChange={(e) =>
                                  updateCarouselCard(idx, {
                                    buttons: (card.buttons ?? []).map((bb, bj) =>
                                      bj === bi ? { ...bb, text: e.target.value } : bb
                                    ),
                                  })
                                }
                              />
                              {(card.buttons?.length ?? 0) > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => {
                                    const next = (card.buttons ?? []).filter(
                                      (_, bj) => bj !== bi
                                    );
                                    updateCarouselCard(idx, {
                                      buttons: next.length ? next : [DEFAULT_BUTTON],
                                    });
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              updateCarouselCard(idx, {
                                buttons: [
                                  ...(card.buttons && card.buttons.length > 0
                                    ? card.buttons
                                    : [DEFAULT_BUTTON]),
                                  { ...DEFAULT_BUTTON },
                                ],
                              })
                            }
                          >
                            + Add button
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {carouselCards.length < CAROUSEL_MAX_CARDS && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-2"
                    onClick={addCarouselCard}
                  >
                    + Add card
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={isPending || (layoutType === "STANDARD" && !body.trim())}
          >
            {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
