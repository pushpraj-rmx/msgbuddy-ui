"use client";

import {
  Image as ImageIcon,
  PlayCircle,
  FileText,
  ExternalLink,
  Phone,
  Reply,
  Copy,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRef, useState } from "react";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import type { ChannelTemplateVersion } from "@/lib/types";

/* ─── Types ─── */

type TemplateButton = {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
};

type CarouselCard = {
  headerFormat?: "IMAGE" | "VIDEO";
  headerHandle?: string;
  headerPreviewUrl?: string;
  body?: string;
  buttons?: TemplateButton[];
};

export type WhatsAppTemplatePreviewProps = {
  headerType?: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  headerContent?: string | null;
  headerPreviewUrl?: string | null;
  body: string;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
  layoutType?: "STANDARD" | "CAROUSEL";
  carouselCards?: CarouselCard[] | null;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | null;
  language?: string | null;
  className?: string;
};

/* ─── Helpers ─── */

/**
 * Replace {{N}} / {{name}} placeholders with highlighted spans.
 * Grammar is kept in lock-step with the backend send/mapper regex
 * (`NAMED_VAR_REGEX = /\{\{(\w+)\}\}/g`): only `{{word}}` is a real variable.
 * Something like `{{ full name }}` (spaces/punctuation) is literal text the
 * backend will NOT substitute, so it must NOT be highlighted here either.
 */
export function renderVariableText(text: string) {
  const parts = text.split(/(\{\{\w+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{\w+\}\}$/.test(part) ? (
      <span
        key={i}
        className="rounded bg-primary/15 px-0.5 font-mono text-[0.6875rem] text-primary"
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}

const BUTTON_ICON: Record<string, typeof Reply> = {
  QUICK_REPLY: Reply,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
  OTP: Copy,
  FLOW: LayoutGrid,
};

/* ─── Sub-components ─── */

function HeaderMedia({
  type,
  previewUrl,
  content,
}: {
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  previewUrl?: string | null;
  content?: string | null;
}) {
  const resolved = resolveMediaUrlForUi(previewUrl ?? undefined);

  if (type === "IMAGE") {
    return resolved ? (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic user content, dimensions unknown
      <img
        src={resolved}
        alt="Header"
        className="aspect-[1.91/1] w-full rounded-lg object-cover bg-base-300"
      />
    ) : (
      <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-lg bg-base-300/60">
        <ImageIcon className="h-8 w-8 text-base-content/25" />
      </div>
    );
  }

  if (type === "VIDEO") {
    return resolved ? (
      <video
        src={resolved}
        controls
        className="aspect-[1.91/1] w-full rounded-lg bg-base-300 object-cover"
      />
    ) : (
      <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-lg bg-base-300/60">
        <PlayCircle className="h-8 w-8 text-base-content/25" />
      </div>
    );
  }

  // DOCUMENT
  return (
    <div className="flex items-center gap-2 rounded-lg bg-base-300/60 px-3 py-2.5">
      <FileText className="h-5 w-5 shrink-0 text-base-content/40" />
      <span className="truncate text-xs text-base-content/60">
        {content || "Document"}
      </span>
    </div>
  );
}

function ButtonRow({ btn }: { btn: TemplateButton }) {
  const Icon = BUTTON_ICON[btn.type] ?? Reply;
  return (
    <div className="flex items-center justify-center gap-1.5 rounded bg-base-100/60 py-1.5 text-[0.75rem] font-medium text-info">
      <Icon className="h-3 w-3" />
      <span>{btn.text || "(button)"}</span>
    </div>
  );
}

function BubbleCard({
  headerType,
  headerContent,
  headerPreviewUrl,
  body,
  footer,
  buttons,
  compact,
}: {
  headerType?: string | null;
  headerContent?: string | null;
  headerPreviewUrl?: string | null;
  body?: string;
  footer?: string | null;
  buttons?: TemplateButton[];
  compact?: boolean;
}) {
  const ht = headerType ?? "NONE";
  const btns = buttons ?? [];
  const bodySize = compact ? "text-[0.75rem]" : "text-[0.8125rem]";

  return (
    <div className="space-y-1.5 rounded-xl bg-base-200 p-2.5 ring-1 ring-base-300">
      {/* Header */}
      {ht === "TEXT" && headerContent && (
        <div className="rounded-md bg-base-300/50 px-2 py-1.5 text-center text-xs font-medium text-base-content/80">
          {renderVariableText(headerContent)}
        </div>
      )}
      {(ht === "IMAGE" || ht === "VIDEO" || ht === "DOCUMENT") && (
        <HeaderMedia
          type={ht as "IMAGE" | "VIDEO" | "DOCUMENT"}
          previewUrl={headerPreviewUrl}
          content={headerContent}
        />
      )}

      {/* Body */}
      {body ? (
        <div
          className={`whitespace-pre-wrap break-words leading-snug text-base-content ${bodySize}`}
        >
          {renderVariableText(body)}
        </div>
      ) : (
        <div className={`italic text-base-content/35 ${bodySize}`}>
          Message body…
        </div>
      )}

      {/* Footer */}
      {footer && (
        <div className="border-t border-base-300/50 pt-1 text-[0.6875rem] text-base-content/45">
          {footer}
        </div>
      )}

      {/* Buttons */}
      {btns.length > 0 && (
        <div className="space-y-1 border-t border-base-300/50 pt-1.5">
          {btns.map((btn, i) => (
            <ButtonRow key={i} btn={btn} />
          ))}
        </div>
      )}
    </div>
  );
}

function CarouselStrip({ cards, body }: { cards: CarouselCard[]; body?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className="space-y-2">
      {/* Intro body */}
      {body?.trim() && (
        <div className="whitespace-pre-wrap break-words text-[0.8125rem] leading-snug text-base-content">
          {renderVariableText(body)}
        </div>
      )}

      {/* Scrollable cards */}
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            className="absolute -left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-base-300 bg-base-100 p-1 shadow-sm"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 scrollbar-none"
          onScroll={updateArrows}
        >
          {cards.map((card, idx) => (
            <div key={idx} className="w-[200px] shrink-0 snap-start">
              <BubbleCard
                headerType={card.headerFormat ?? "IMAGE"}
                headerPreviewUrl={card.headerPreviewUrl}
                body={card.body}
                buttons={card.buttons}
                compact
              />
            </div>
          ))}
        </div>
        {canScrollRight && cards.length > 1 && (
          <button
            type="button"
            className="absolute -right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-base-300 bg-base-100 p-1 shadow-sm"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Category badge ─── */

const CATEGORY_STYLES: Record<string, string> = {
  MARKETING: "op-tag op-tag-info",
  UTILITY: "op-tag op-tag-ok",
  AUTHENTICATION: "op-tag op-tag-warn",
};

/* ─── Main component ─── */

export function WhatsAppTemplatePreview({
  headerType,
  headerContent,
  headerPreviewUrl,
  body,
  footer,
  buttons,
  layoutType,
  carouselCards,
  category,
  language,
  className,
}: WhatsAppTemplatePreviewProps) {
  const isCarousel =
    layoutType === "CAROUSEL" &&
    Array.isArray(carouselCards) &&
    carouselCards.length > 0;

  const parsedButtons: TemplateButton[] = Array.isArray(buttons)
    ? (buttons as TemplateButton[])
    : [];

  return (
    <div
      className={
        className ??
        "w-full max-w-xs rounded-box border border-base-300 border-l-2 border-l-success bg-base-100 p-3 space-y-2"
      }
    >
      {/* Meta badges */}
      {(category || language) && (
        <div className="flex items-center gap-1.5">
          {category && (
            <span className={CATEGORY_STYLES[category] ?? "op-tag"}>
              {category}
            </span>
          )}
          {language && (
            <span className="op-tag">{language.toUpperCase()}</span>
          )}
        </div>
      )}

      {/* Content */}
      {isCarousel ? (
        <CarouselStrip cards={carouselCards!} body={body} />
      ) : (
        <BubbleCard
          headerType={headerType}
          headerContent={headerContent}
          headerPreviewUrl={headerPreviewUrl}
          body={body}
          footer={footer}
          buttons={parsedButtons}
        />
      )}
    </div>
  );
}

/* ─── Convenience wrapper for ChannelTemplateVersion objects ─── */

export function WhatsAppTemplatePreviewFromVersion({
  version,
  category,
  className,
}: {
  version: ChannelTemplateVersion;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | null;
  className?: string;
}) {
  const cards = Array.isArray(version.carouselCards)
    ? (version.carouselCards as CarouselCard[])
    : null;

  const buttons = Array.isArray(version.buttons)
    ? (version.buttons as TemplateButton[])
    : null;

  return (
    <WhatsAppTemplatePreview
      headerType={version.headerType}
      headerContent={version.headerContent}
      headerPreviewUrl={version.headerPreviewUrl}
      body={version.body ?? ""}
      footer={version.footer}
      buttons={buttons}
      layoutType={version.layoutType}
      carouselCards={cards}
      category={category}
      language={version.language}
      className={className}
    />
  );
}
