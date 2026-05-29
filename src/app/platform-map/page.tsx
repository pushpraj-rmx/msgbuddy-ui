"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Smartphone,
  Server,
  Inbox,
  Users,
  LayoutTemplate,
  Megaphone,
  Bot,
  Send,
  Bell,
  KeyRound,
  Webhook,
  Shield,
  BarChart3,
  ArrowDown,
  ArrowUpDown,
  ArrowRight,
  ArrowLeft,
  Headphones,
  Receipt,
  Code,
  Fingerprint,
  CheckCheck,
  Clock,
  Workflow,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  GitBranch,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/* ── tabs ──────────────────────────────────────────────────────────── */

const TABS = [
  { id: "intro", label: "Intro" },
  { id: "problem", label: "Problem" },
  { id: "use-cases", label: "Use cases" },
  { id: "platform", label: "Platform" },
  { id: "send-flow", label: "Send lifecycle" },
  { id: "integration", label: "Integration" },
  { id: "why-us", label: "Why MsgBuddy" },
  { id: "next-steps", label: "Next steps" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ── shared helpers ────────────────────────────────────────────────── */

function EdgeBar({
  icon: Icon,
  title,
  sub,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <div className="op-grain flex w-full items-center gap-4 rounded-box border border-base-300 bg-base-200 px-5 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-base-300 bg-base-100">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-[1rem] font-semibold tracking-[-0.015em]">{title}</p>
        <p className="font-mono-op text-[0.6875rem] uppercase tracking-[0.06em] text-base-content/45">
          {sub}
        </p>
      </div>
    </div>
  );
}

function FlowConnector({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-1 text-base-content/45">
      <span className="h-px w-12 bg-base-300" />
      <ArrowUpDown className="h-3.5 w-3.5" />
      <span className="font-mono-op text-[0.6875rem] uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="h-px w-12 bg-base-300" />
    </div>
  );
}

function InternalArrow({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3 text-base-content/40">
      <span className="h-px flex-1 bg-base-300" />
      <span className="font-mono-op text-[0.625rem] uppercase tracking-[0.08em]">
        {label}
      </span>
      <ArrowDown className="h-3 w-3" />
      <span className="h-px flex-1 bg-base-300" />
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  lines,
}: {
  icon: LucideIcon;
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-[0.875rem] font-semibold">{title}</p>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((l) => (
          <li
            key={l}
            className="flex items-start gap-2 text-[0.75rem] text-base-content/55"
          >
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({
  icon: Icon,
  title,
  sub,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 px-3 py-2.5">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <p className="text-[0.8125rem] font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 font-mono-op text-[0.625rem] uppercase tracking-[0.06em] text-base-content/45">
          {sub}
        </p>
      </div>
    </div>
  );
}

function SlideHead({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="border-b border-base-300 pb-4">
      <span className="op-signal">
        <span className="dot" />
        {eyebrow}
      </span>
      <h2 className="mt-2 text-[1.75rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[2.25rem]">
        {title}
      </h2>
      <p className="mt-1 text-[0.9375rem] text-base-content/60">{desc}</p>
    </div>
  );
}

/* ── slide 1: platform map ─────────────────────────────────────────── */

const SURFACES: { icon: LucideIcon; title: string; lines: string[] }[] = [
  {
    icon: Inbox,
    title: "Inbox",
    lines: ["threads + presence", "assign · snooze · reopen", "notes · canned replies"],
  },
  {
    icon: Users,
    title: "Contacts",
    lines: ["tags · segments", "custom fields", "lifecycle stage"],
  },
  {
    icon: LayoutTemplate,
    title: "Templates",
    lines: ["draft → review", "Meta approval", "quality tracking"],
  },
  {
    icon: Megaphone,
    title: "Campaigns",
    lines: ["audience targeting", "throttle · retry", "live progress"],
  },
];

const ENGINES: { icon: LucideIcon; title: string; lines: string[] }[] = [
  {
    icon: Bot,
    title: "Automation",
    lines: ["welcome · out-of-hours", "keyword · auto-assign", "business hours"],
  },
  {
    icon: Send,
    title: "Send pipeline",
    lines: ["queued · idempotent", "scheduled · retried", "media URL ingest"],
  },
  {
    icon: Bell,
    title: "Notifications",
    lines: ["browser push", "in-app bell", "severity-tagged"],
  },
];

const INFRA: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: KeyRound, title: "API keys", sub: "mb_live · mb_test" },
  { icon: Webhook, title: "Webhooks", sub: "HMAC-SHA256 · versioned" },
  { icon: Shield, title: "Audit log", sub: "every change captured" },
  { icon: BarChart3, title: "Usage logs", sub: "per-request audit" },
];

function PlatformSlide() {
  return (
    <>
      <SlideHead
        eyebrow="platform map"
        title="How MsgBuddy fits together."
        desc="Customer messages in. Your team and your backend in the middle. Customer messages out."
      />
      <div className="flex flex-1 flex-col justify-center gap-2 py-6">
        <EdgeBar
          icon={Smartphone}
          title="Customer's phone"
          sub="receives + sends whatsapp messages"
        />

        <FlowConnector label="whatsapp cloud api · inbound + outbound" />

        <div className="op-grain w-full rounded-box border-2 border-primary/30 bg-base-200/60 p-5">
          <div className="mb-4 flex items-center justify-between border-b border-base-300 pb-3">
            <span className="font-mono-op text-[0.6875rem] uppercase tracking-[0.08em] text-primary">
              msgbuddy core
            </span>
            <span className="font-mono-op text-[0.625rem] uppercase tracking-[0.06em] text-base-content/40">
              aes-256-gcm · audit-logged · idempotent
            </span>
          </div>

          <p className="op-label mb-2">surfaces · what your team uses</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SURFACES.map((s) => (
              <Card key={s.title} {...s} />
            ))}
          </div>

          <InternalArrow label="drives" />

          <p className="op-label mb-2">engines · always-on background work</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {ENGINES.map((e) => (
              <Card key={e.title} {...e} />
            ))}
          </div>

          <InternalArrow label="runs on" />

          <p className="op-label mb-2">infra · always on, always logged</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {INFRA.map((i) => (
              <Chip key={i.title} {...i} />
            ))}
          </div>
        </div>

        <FlowConnector label="rest api · hmac-signed webhooks" />

        <EdgeBar
          icon={Server}
          title="Your backend"
          sub="calls rest · receives webhooks · stores state"
        />
      </div>
    </>
  );
}

/* ── slide 2: use cases ────────────────────────────────────────────── */

const USE_CASES: {
  icon: LucideIcon;
  title: string;
  desc: string;
  bullets: string[];
}[] = [
  {
    icon: Headphones,
    title: "Customer support",
    desc: "Shared inbox where your team answers every customer with full context.",
    bullets: [
      "Shared inbox with agent assignment",
      "Canned responses with /-shortcuts",
      "Internal notes for team coordination",
      "Auto-assign rules, snooze, reassign",
    ],
  },
  {
    icon: Megaphone,
    title: "Marketing & broadcasts",
    desc: "Send approved templates to thousands. Track every delivery and reply.",
    bullets: [
      "Audience targeting via tags & segments",
      "Throttled sends respecting Meta limits",
      "Pause, resume, retry mid-flight",
      "Per-campaign delivery & reply analytics",
    ],
  },
  {
    icon: Receipt,
    title: "Transactional & alerts",
    desc: "Trigger OTPs, order updates, and notifications from your backend via API.",
    bullets: [
      "REST API with idempotency keys",
      "HMAC-signed outbound webhooks",
      "Live & test API keys",
      "Versioned envelopes for safe upgrades",
    ],
  },
];

function UseCasesSlide() {
  return (
    <>
      <SlideHead
        eyebrow="who it's for"
        title="Three ways teams use MsgBuddy."
        desc="One platform, three jobs — pick the lane that matches your team, or run all three from the same workspace."
      />
      <div className="grid flex-1 grid-cols-1 gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((u) => {
          const Icon = u.icon;
          return (
            <div
              key={u.title}
              className="op-grain flex flex-col rounded-box border border-base-300 bg-base-200 p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-base-300 bg-base-100">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-[1.0625rem] font-semibold tracking-[-0.015em]">
                {u.title}
              </p>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-base-content/60">
                {u.desc}
              </p>
              <ul className="mt-4 flex flex-col gap-2 border-t border-base-300 pt-4">
                {u.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-[0.8125rem] text-base-content/60"
                  >
                    <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── slide 3: send lifecycle ───────────────────────────────────────── */

const LIFECYCLE_STEPS: {
  step: string;
  icon: LucideIcon;
  title: string;
  lines: string[];
  accent?: boolean;
}[] = [
  {
    step: "01",
    icon: LayoutTemplate,
    title: "Compose",
    lines: ["text · template · media", "fill variables", "pick channel + recipient"],
  },
  {
    step: "02",
    icon: Shield,
    title: "Validate",
    lines: ["template PROVIDER_APPROVED?", "variables match schema?", "contact opted-in?"],
  },
  {
    step: "03",
    icon: Workflow,
    title: "Queue",
    lines: ["BullMQ background worker", "throttled · idempotent", "retried on transient fail"],
  },
  {
    step: "04",
    icon: Send,
    title: "Send",
    lines: ["WhatsApp Cloud API call", "Meta-side dispatch", "status: sent"],
    accent: true,
  },
  {
    step: "05",
    icon: CheckCheck,
    title: "Track",
    lines: ["webhook in → delivered/read/failed", "audit log row written", "your backend notified"],
  },
];

const SEND_STATUSES = [
  { icon: Clock, label: "Queued", color: "text-base-content/45" },
  { icon: Send, label: "Sent", color: "text-base-content/65" },
  { icon: CheckCheck, label: "Delivered", color: "text-info" },
  { icon: Eye, label: "Read", color: "text-success" },
];

function SendFlowSlide() {
  return (
    <>
      <SlideHead
        eyebrow="send lifecycle"
        title="From hit-send to read-receipt."
        desc="Every outbound message — whether from the UI, the API, or a campaign — passes through the same five-stage pipeline."
      />
      <div className="flex flex-1 flex-col justify-center gap-6 py-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {LIFECYCLE_STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className={`op-grain flex flex-col rounded-box border p-4 ${
                  s.accent
                    ? "border-primary/40 bg-primary/5"
                    : "border-base-300 bg-base-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="op-label">{s.step}</span>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 text-[1rem] font-semibold tracking-[-0.015em]">
                  {s.title}
                </p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {s.lines.map((l) => (
                    <li
                      key={l}
                      className="flex items-start gap-2 text-[0.75rem] text-base-content/55"
                    >
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 rounded-box border border-base-300 bg-base-200/40 px-5 py-3">
          <span className="font-mono-op text-[0.6875rem] uppercase tracking-[0.06em] text-base-content/45">
            status flow:
          </span>
          {SEND_STATUSES.map((s, i) => {
            const Icon = s.icon;
            return (
              <span
                key={s.label}
                className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-medium ${s.color}`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
                {i < SEND_STATUSES.length - 1 && (
                  <ArrowRight className="ml-2 h-3 w-3 text-base-content/25" />
                )}
              </span>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Chip
            icon={Fingerprint}
            title="Idempotent"
            sub="Idempotency-Key dedups for 24h"
          />
          <Chip
            icon={Shield}
            title="Approval-gated"
            sub="WhatsApp = PROVIDER_APPROVED only"
          />
          <Chip
            icon={Webhook}
            title="Round-trip"
            sub="status flows back via webhook"
          />
        </div>
      </div>
    </>
  );
}

/* ── slide 4: integration ──────────────────────────────────────────── */

const CURL_SAMPLE = `curl -X POST https://api.msgbuddy.com/v2/messages \\
  -H "Authorization: Bearer mb_live_xxx" \\
  -H "Idempotency-Key: ord-4821-shipped" \\
  -d '{
    "to": "+919876543210",
    "template": "order_shipped",
    "variables": {
      "name": "Priya",
      "awb": "AWB123456789"
    }
  }'`;

const WEBHOOK_SAMPLE = `{
  "id": "evt_01jk4z9p8c2",
  "apiVersion": "2026-05-01",
  "type": "message.delivered",
  "data": {
    "messageId": "msg_01jk3a8r1nq",
    "to": "+919876543210",
    "deliveredAt": "2026-05-27T10:14:32Z"
  }
}`;

const WEBHOOK_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.replied",
  "template.approved",
  "template.rejected",
  "template.quality_changed",
  "contact.opted_in",
  "contact.opted_out",
  "conversation.assigned",
  "campaign.completed",
];

function IntegrationSlide() {
  return (
    <>
      <SlideHead
        eyebrow="integration"
        title="Built to be integrated."
        desc="Every surface in the UI is callable via REST. Every event is delivered to your endpoint, HMAC-signed, with a versioned envelope."
      />
      <div className="flex flex-1 flex-col gap-4 py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* REST */}
          <div className="op-grain flex flex-col rounded-box border border-base-300 bg-base-200 p-5">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-primary" />
              <span className="op-label">rest · send a message</span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-box border border-base-300 bg-base-100 p-4 font-mono-op text-[0.75rem] leading-relaxed text-base-content/80">
              <code>{CURL_SAMPLE}</code>
            </pre>
            <ul className="mt-3 flex flex-col gap-1.5">
              {[
                "70+ endpoints — messaging, contacts, templates, campaigns",
                "scoped API keys: mb_live (prod) · mb_test (sandbox)",
                "idempotency keys dedup retries for 24h",
                "Swagger / OpenAPI docs at /api/v2/docs",
              ].map((l) => (
                <li
                  key={l}
                  className="flex items-start gap-2 text-[0.75rem] text-base-content/60"
                >
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  {l}
                </li>
              ))}
            </ul>
          </div>

          {/* Webhooks */}
          <div className="op-grain flex flex-col rounded-box border border-base-300 bg-base-200 p-5">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <span className="op-label">webhooks · event sample</span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-box border border-base-300 bg-base-100 p-4 font-mono-op text-[0.75rem] leading-relaxed text-base-content/80">
              <code>{WEBHOOK_SAMPLE}</code>
            </pre>
            <ul className="mt-3 flex flex-col gap-1.5">
              {[
                "HMAC-SHA256 signed with rotatable secret",
                "envelope versioned (apiVersion field) — upgrade on your schedule",
                "delivery retried with exponential backoff",
                "every event captured in WebhookDelivery for replay",
              ].map((l) => (
                <li
                  key={l}
                  className="flex items-start gap-2 text-[0.75rem] text-base-content/60"
                >
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="op-grain rounded-box border border-base-300 bg-base-200/60 p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="op-label">subscribable events</span>
            <span className="ml-auto font-mono-op text-[0.625rem] uppercase tracking-[0.06em] text-base-content/40">
              partial list
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {WEBHOOK_EVENTS.map((e) => (
              <span
                key={e}
                className="rounded-md border border-base-300 bg-base-100 px-2.5 py-1 font-mono-op text-[0.6875rem] text-base-content/70"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── slide 0: intro / cover ────────────────────────────────────────── */

function IntroSlide() {
  return (
    <div className="flex flex-1 flex-col justify-center py-12">
      <span className="op-signal">
        <span className="dot" />
        msgbuddy · demo
      </span>
      <h1 className="mt-8 max-w-4xl text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[4rem]">
        WhatsApp messaging{" "}
        <span className="font-serif font-normal italic text-base-content/80">
          platform
        </span>{" "}
        for teams that move fast.
      </h1>
      <p className="mt-6 max-w-2xl text-[1.0625rem] leading-relaxed text-base-content/65">
        Inbox, contacts, templates, campaigns, automation, and analytics —
        built on the WhatsApp Cloud API. One workspace for your whole team,
        with the controls to run it properly.
      </p>

      <div className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { value: "WhatsApp", label: "cloud api", sub: "meta embedded signup" },
          { value: "AES-256", label: "encryption", sub: "tokens at rest" },
          { value: "HMAC", label: "webhooks", sub: "signed + versioned" },
        ].map((s) => (
          <div
            key={s.label}
            className="op-grain rounded-box border border-base-300 bg-base-200 p-4"
          >
            <p className="font-mono-op text-[1.25rem] font-semibold tracking-tight text-primary">
              {s.value}
            </p>
            <p className="mt-1 text-[0.8125rem] font-medium uppercase tracking-wide">
              {s.label}
            </p>
            <p className="mt-0.5 font-mono-op text-[0.625rem] uppercase tracking-[0.06em] text-base-content/45">
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 font-mono-op text-[0.6875rem] uppercase tracking-[0.08em] text-base-content/40">
        next: where teams break today →
      </div>
    </div>
  );
}

/* ── slide: problem ────────────────────────────────────────────────── */

const PROBLEMS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: EyeOff,
    title: "No shared visibility",
    desc: "Customer chats live on personal phones and WhatsApp groups. No assignment, no history, no audit trail — and no way to onboard a new agent without losing context.",
  },
  {
    icon: Lock,
    title: "Meta is a maze",
    desc: "Template categories, approval pipelines, quality ratings, restriction tiers, 24-hour windows — every team rediscovers these the hard way, in production, on a Friday.",
  },
  {
    icon: AlertCircle,
    title: "BSPs cost too much, integrate too poorly",
    desc: "Per-message markup, opaque webhooks, no team UI, scary contracts. Or go DIY against Meta directly and rebuild everything yourself.",
  },
];

function ProblemSlide() {
  return (
    <>
      <SlideHead
        eyebrow="the problem"
        title="Where teams break with WhatsApp today."
        desc="Three failure modes we see in every team that grows past one or two agents."
      />
      <div className="grid flex-1 grid-cols-1 gap-4 py-8 lg:grid-cols-3">
        {PROBLEMS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className="op-grain flex flex-col rounded-box border border-base-300 bg-base-200 p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-base-300 bg-base-100">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-[1.125rem] font-semibold tracking-[-0.015em]">
                {p.title}
              </p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-base-content/65">
                {p.desc}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── slide: why us ─────────────────────────────────────────────────── */

const DIFFERENTIATORS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: GitBranch,
    title: "Your WABA, not ours",
    desc: "Connect through Meta's Embedded Signup. You own the number, the templates, and the quality score. We don't intermediate your customer relationship.",
  },
  {
    icon: Workflow,
    title: "Team UI + Developer API, one workspace",
    desc: "Your support team uses the inbox. Your engineers call the REST API. Both surfaces live on the same data, same audit log, same workspace — no integration tax.",
  },
  {
    icon: ShieldCheck,
    title: "Production primitives, day one",
    desc: "HMAC-signed webhooks. Idempotency keys. Versioned envelopes. AES-256-GCM at rest. Per-request audit. The things you'd otherwise build yourself, six months in.",
  },
];

function WhyUsSlide() {
  return (
    <>
      <SlideHead
        eyebrow="why msgbuddy"
        title="Three things we do differently."
        desc="What you give up with a typical BSP — and what you get instead."
      />
      <div className="grid flex-1 grid-cols-1 gap-4 py-8 lg:grid-cols-3">
        {DIFFERENTIATORS.map((d) => {
          const Icon = d.icon;
          return (
            <div
              key={d.title}
              className="op-grain flex flex-col rounded-box border-2 border-primary/25 bg-base-200 p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-[1.125rem] font-semibold tracking-[-0.015em]">
                {d.title}
              </p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-base-content/65">
                {d.desc}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── slide: next steps ─────────────────────────────────────────────── */

function NextStepsSlide() {
  return (
    <>
      <SlideHead
        eyebrow="next steps"
        title="From zero to first message in under 10 minutes."
        desc="Three steps. No API keys to copy-paste, no webhook URLs to configure manually."
      />
      <div className="flex flex-1 flex-col py-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              n: "01",
              title: "Create workspace",
              desc: "Sign up at msgbuddy.com. Invite your team. Pick roles.",
            },
            {
              n: "02",
              title: "Connect WhatsApp",
              desc: "Meta Embedded Signup links your WABA in two clicks. Existing approved templates import automatically.",
            },
            {
              n: "03",
              title: "Send your first message",
              desc: "Pick an approved template, choose a contact, hit send. Status flows back in real time.",
              accent: true,
            },
          ].map((step) => (
            <div
              key={step.n}
              className={`op-grain flex flex-col rounded-box border p-5 ${
                step.accent
                  ? "border-primary/40 bg-primary/5"
                  : "border-base-300 bg-base-200"
              }`}
            >
              <span className="op-label">{step.n}</span>
              <p className="mt-3 text-[1.0625rem] font-semibold tracking-[-0.015em]">
                {step.title}
              </p>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-base-content/65">
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-box border-2 border-primary/40 bg-primary/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="op-label">guided onboarding</span>
              </div>
              <p className="mt-2 text-[1.25rem] font-semibold tracking-[-0.015em]">
                Want us to set it up with you?
              </p>
              <p className="mt-1 text-[0.9375rem] text-base-content/65">
                We&apos;ll connect your WABA, import your contacts, and ship your
                first campaign together — on a 30-minute call.
              </p>
            </div>
            <a
              href="mailto:hello@msgbuddy.com"
              className="btn btn-primary"
            >
              Book a call <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-auto grid gap-3 pt-6 sm:grid-cols-3">
          <Chip icon={Workflow} title="msgbuddy.com" sub="product + pricing" />
          <Chip icon={Code} title="api.msgbuddy.com/v2/docs" sub="OpenAPI / Swagger" />
          <Chip icon={Sparkles} title="hello@msgbuddy.com" sub="reach the team" />
        </div>
      </div>
    </>
  );
}

/* ── page ──────────────────────────────────────────────────────────── */

export default function DemoDeckPage() {
  const [active, setActive] = useState<TabId>("intro");

  const go = useCallback((dir: 1 | -1) => {
    setActive((cur) => {
      const i = TABS.findIndex((t) => t.id === cur);
      const next = (i + dir + TABS.length) % TABS.length;
      return TABS[next].id;
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const activeIndex = TABS.findIndex((t) => t.id === active);

  return (
    <main className="h-screen overflow-x-hidden overflow-y-auto bg-base-100 text-base-content">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-8 py-6">
        {/* Top bar — brand + tab nav */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-3">
          <span className="font-mono-op text-[0.75rem] uppercase tracking-[0.1em] text-base-content/55">
            msgbuddy · demo deck
          </span>
          <nav className="flex flex-wrap gap-1">
            {TABS.map((t, i) => {
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={`rounded-md border px-3 py-1.5 font-mono-op text-[0.75rem] uppercase tracking-[0.06em] transition-colors ${
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-base-300 bg-base-200 text-base-content/55 hover:text-base-content"
                  }`}
                >
                  <span className="mr-1.5 text-[0.625rem] text-base-content/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Slide */}
        <div className="flex flex-1 flex-col">
          {active === "intro" && <IntroSlide />}
          {active === "problem" && <ProblemSlide />}
          {active === "use-cases" && <UseCasesSlide />}
          {active === "platform" && <PlatformSlide />}
          {active === "send-flow" && <SendFlowSlide />}
          {active === "integration" && <IntegrationSlide />}
          {active === "why-us" && <WhyUsSlide />}
          {active === "next-steps" && <NextStepsSlide />}
        </div>

        {/* Footer — slide counter + nav hint */}
        <footer className="flex items-center justify-between border-t border-base-300 pt-3 font-mono-op text-[0.625rem] uppercase tracking-[0.06em] text-base-content/40">
          <span>msgbuddy.com</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous slide"
              className="rounded border border-base-300 bg-base-200 p-1 text-base-content/55 hover:text-base-content"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>
            <span>
              {String(activeIndex + 1).padStart(2, "0")} / {String(TABS.length).padStart(2, "0")} · ← / → to navigate
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next slide"
              className="rounded border border-base-300 bg-base-200 p-1 text-base-content/55 hover:text-base-content"
            >
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
