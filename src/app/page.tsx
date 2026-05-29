import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import {
  MessageSquareText,
  Users,
  Megaphone,
  LayoutTemplate,
  BarChart3,
  Shield,
  Zap,
  Globe,
  Bell,
  UserCog,
  CreditCard,
  Radio,
  ArrowRight,
  MessagesSquare,
  Send,
  CheckCheck,
  Eye,
  Tag,
  Filter,
  FileUp,
  Merge,
  Workflow,
  Clock,
  RefreshCw,
  Gauge,
  Bot,
  Hash,
  Reply,
  Calendar,
  ListTodo,
  Code,
  KeyRound,
  Webhook,
  Fingerprint,
  Headphones,
  Receipt,
  ChevronDown,
  Paperclip,
  Smile,
  type LucideIcon,
} from "lucide-react";

/* ── data ──────────────────────────────────────────────────────────── */

const CHANNELS: { name: string; color: string }[] = [
  { name: "WhatsApp", color: "#25D366" },
];

const FEATURES: {
  id: string;
  label: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  details: string[];
}[] = [
  {
    id: "inbox",
    label: "Unified Inbox",
    title: "Every channel, one thread.",
    desc: "Every WhatsApp conversation lands in a single inbox. Assign agents, track delivery status in real time, and never lose context.",
    icon: MessageSquareText,
    details: [
      "Real-time delivery tracking: pending, sent, delivered, read",
      "Agent assignment with auto-claim and reopen rules",
      "Rich media — images, video, audio, documents",
      "Message pinning, starring, and scheduling",
      "Conversation snooze and inactivity auto-unassign",
    ],
  },
  {
    id: "contacts",
    label: "Contact Management",
    title: "Your audience, organized.",
    desc: "Centralized contact database with custom fields, tags, segments, and bulk operations. Import thousands from CSV, merge duplicates, and keep data clean.",
    icon: Users,
    details: [
      "Custom fields: text, number, date, boolean, URL, email",
      "Tags and saved segments for targeted outreach",
      "Bulk import (CSV/JSON) and export",
      "Contact merge and deduplication",
      "Opt-out and block list enforcement",
    ],
  },
  {
    id: "templates",
    label: "Template Workflow",
    title: "Draft. Approve. Go live.",
    desc: "Create multi-version message templates with a full approval pipeline. Submit to Meta, track review status, and activate versions — all from one place.",
    icon: LayoutTemplate,
    details: [
      "Approval workflow: Draft > Internal Review > Meta Review > Live",
      "Multi-version support with version activation",
      "Headers, body variables, footers, and interactive buttons",
      "Carousel and rich layout support",
      "Quality score and category tracking from Meta",
    ],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    title: "Broadcast at scale, measured.",
    desc: "Target all contacts, a segment, or a hand-picked list. Throttle sends, retry failures automatically, and watch progress in real time via live counters.",
    icon: Megaphone,
    details: [
      "Audience targeting: all, segment, or specific contacts",
      "Rate-limited sends with configurable throttle/min",
      "Automatic retries with exponential backoff",
      "Live progress tracking via server-sent events",
      "24h marketing rule enforcement per contact",
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    title: "Visibility across everything.",
    desc: "Dashboard summaries, delivery stats, agent performance, and per-campaign reports. Filter by date range, channel, or team member.",
    icon: BarChart3,
    details: [
      "Delivery rates: sent, delivered, read, failed",
      "Per-channel and per-agent breakdowns",
      "Time-series trends for messaging volume",
      "Campaign and template performance reports",
      "Usage tracking against workspace limits",
    ],
  },
  {
    id: "team",
    label: "Team & Workspaces",
    title: "Multi-tenant from day one.",
    desc: "Isolated workspaces with role-based access. Owners, admins, supervisors, agents, auditors, and viewers — everyone sees exactly what they need.",
    icon: UserCog,
    details: [
      "6 roles: owner, admin, supervisor, agent, auditor, viewer",
      "Per-workspace settings and channel configuration",
      "Conversation assignment and presence tracking",
      "Inactivity rules and auto-unassign thresholds",
      "Platform admin panel for cross-workspace oversight",
    ],
  },
];

const STATS = [
  { value: "AES-256", label: "Encryption", sub: "Provider tokens encrypted at rest" },
  { value: "70+", label: "API endpoints", sub: "Full REST API with Swagger docs" },
  { value: "20+", label: "Real-time events", sub: "SSE-powered live updates" },
  { value: "6", label: "Team roles", sub: "Granular access control" },
];

const CAPABILITIES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Globe, title: "WhatsApp Embedded Signup", desc: "Connect WABA accounts with Meta's OAuth flow — no manual API key entry." },
  { icon: Shield, title: "Encrypted credentials", desc: "AES-256-GCM encryption for all provider tokens and API keys at rest." },
  { icon: Radio, title: "Live updates via SSE", desc: "Messages, assignments, campaign progress, and status changes stream in real time." },
  { icon: Bell, title: "Push notifications", desc: "Browser push + in-app notifications for assignments, campaign completions, and alerts." },
  { icon: Zap, title: "Background job engine", desc: "BullMQ workers for campaign sends, retries, media sync, and scheduled cleanup." },
  { icon: CreditCard, title: "Usage-based billing", desc: "Plan enforcement with message, contact, and storage limits. Razorpay integration." },
  { icon: Workflow, title: "Approval workflows", desc: "Internal review gates before templates reach Meta for WhatsApp approval." },
  { icon: RefreshCw, title: "Smart retries", desc: "Exponential backoff with configurable max attempts for failed message delivery." },
  { icon: Gauge, title: "Rate limiting", desc: "Per-campaign throttling and per-workspace quotas to stay within provider limits." },
];

const MESSAGE_LIFECYCLE = [
  { icon: Send, label: "Sent", color: "text-base-content/60" },
  { icon: CheckCheck, label: "Delivered", color: "text-info" },
  { icon: Eye, label: "Read", color: "text-success" },
];

const USE_CASES: {
  icon: LucideIcon;
  title: string;
  desc: string;
  bullets: string[];
}[] = [
  {
    icon: Headphones,
    title: "Customer support",
    desc: "Shared inbox where your team answers every customer with full context — no copy-pasting from a CRM tab.",
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
    desc: "Send approved templates to thousands. Throttle, retry, and track every delivery and reply.",
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
    desc: "Trigger OTPs, order updates, and notifications from your backend with a few lines of code.",
    bullets: [
      "REST API with idempotency keys",
      "HMAC-signed outbound webhooks",
      "Live & test API keys (mb_live / mb_test)",
      "Versioned envelopes for safe upgrades",
    ],
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need my own WhatsApp Business Account?",
    a: "Yes — MsgBuddy runs on your WABA, not a shared one. You connect it through Meta's Embedded Signup flow in under five minutes. No API keys to copy-paste, no manual webhook setup.",
  },
  {
    q: "Can I bring an existing WhatsApp number?",
    a: "Yes. Embedded Signup handles both fresh numbers and numbers already linked to a WABA. Your existing approved templates are imported on first connect.",
  },
  {
    q: "How long does Meta template approval take?",
    a: "Usually a few minutes for utility and authentication templates. Marketing templates can take up to 24 hours. We surface the live status from Meta and notify you the moment it changes.",
  },
  {
    q: "What happens if Meta rejects a template?",
    a: "You'll see the rejection reason inline, edit the template or its category, and resubmit without leaving MsgBuddy. Each version is tracked so you can compare what changed and roll back if needed.",
  },
  {
    q: "Do you store message contents?",
    a: "Yes — message bodies are stored so your team can search history and resume conversations. All provider tokens and webhook secrets are AES-256-GCM encrypted at rest, and every mutating action is captured in a per-workspace audit log.",
  },
  {
    q: "Is there an API?",
    a: "Yes. Every surface in the UI is callable via REST with Swagger docs. You get scoped API keys (mb_live and mb_test prefixes), HMAC-SHA256-signed webhooks for every event, and idempotency keys so retries stay safe.",
  },
  {
    q: "How does pricing work?",
    a: "Plans include a monthly fee plus usage (messages sent, contacts stored, media storage). Meta's per-conversation charges pass through at cost. See the pricing page for tier details.",
  },
  {
    q: "Can multiple teammates use the same workspace?",
    a: "Yes. Each workspace supports six roles — owner, admin, supervisor, agent, auditor, viewer — with conversation assignment, live presence, and inactivity rules to keep things moving.",
  },
];

/* ── helpers ───────────────────────────────────────────────────────── */

function Bubble({
  side,
  status,
  children,
}: {
  side: "in" | "out";
  status?: "sent" | "delivered" | "read";
  children: React.ReactNode;
}) {
  const isOut = side === "out";
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[78%] flex-col gap-1 ${
          isOut ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`rounded-lg px-3 py-2 text-[0.8125rem] leading-relaxed ${
            isOut
              ? "border border-primary/25 bg-primary/15"
              : "border border-base-300 bg-base-100"
          }`}
        >
          {children}
        </div>
        {isOut && status && (
          <span className="inline-flex items-center gap-1 font-mono-op text-[0.625rem] uppercase tracking-[0.06em] text-base-content/40">
            <CheckCheck
              className={`h-3 w-3 ${
                status === "read" ? "text-success" : ""
              }`}
            />
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────── */

export default async function HomePage() {
  return (
    <MarketingPageShell>
      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="flex min-h-[70vh] flex-col items-start justify-center gap-8 py-16">
        <span className="op-signal">
          <span className="dot" />
          msgbuddy · v2
        </span>

        <h1 className="max-w-4xl text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.5rem]">
          WhatsApp messaging{" "}
          <span className="font-serif font-normal italic text-base-content/80">
            platform
          </span>{" "}
          for teams that move fast.
        </h1>

        <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-base-content/70 sm:text-[1.0625rem]">
          Inbox, contacts, templates, campaigns, automation, and analytics —
          built on the WhatsApp Cloud API. One workspace for your whole team,
          with the controls to run it properly.
        </p>

        {/* channel pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CHANNELS.map((ch) => (
            <span
              key={ch.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-200 px-3 py-1 font-mono-op text-[0.6875rem] uppercase tracking-[0.06em]"
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: ch.color }}
              />
              {ch.name}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/register" className="btn btn-primary">
            Get started <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <Link href="#features" className="btn">
            See what&apos;s included
          </Link>
        </div>

        {/* stat bar */}
        <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="op-grain rounded-box border border-base-300 bg-base-200 p-4"
            >
              <p className="font-mono-op text-2xl font-semibold tracking-tight text-primary">
                {s.value}
              </p>
              <p className="mt-1 text-[0.8125rem] font-medium">{s.label}</p>
              <p className="mt-0.5 text-[0.6875rem] text-base-content/50">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRODUCT PEEK ─────────────────────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">A look inside</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          The inbox your team will actually live in.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          A real shared inbox with assignments, live delivery status, and the
          context to reply well — no tab-switching, no copy-pasting.
        </p>

        <div className="op-grain mt-10 rounded-box border border-base-300 bg-base-200/40 p-2 shadow-2xl shadow-black/30">
          {/* app chrome */}
          <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-base-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-base-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-base-300" />
            </div>
            <span className="ml-3 font-mono-op text-[0.6875rem] uppercase tracking-[0.06em] text-base-content/40">
              msgbuddy · inbox
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 font-mono-op text-[0.6875rem] uppercase tracking-[0.06em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              live
            </span>
          </div>

          {/* body */}
          <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-[260px_1fr]">
            {/* conv list */}
            <div className="hidden flex-col border-r border-base-300 md:flex">
              <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2 font-mono-op text-[0.6875rem] uppercase tracking-[0.06em] text-base-content/40">
                <span>conversations</span>
                <span className="ml-auto rounded bg-base-300 px-1.5 py-px text-[0.625rem] text-base-content/60">
                  5
                </span>
              </div>
              <ul className="flex flex-col">
                {[
                  {
                    name: "Priya Sharma",
                    preview: "Perfect, thanks 🙏",
                    time: "2m",
                    unread: 0,
                    selected: true,
                  },
                  {
                    name: "Rohan Mehta",
                    preview: "When will my refund be processed?",
                    time: "14m",
                    unread: 2,
                  },
                  {
                    name: "Anita Iyer",
                    preview: "Got it, sending now",
                    time: "1h",
                    unread: 0,
                  },
                  {
                    name: "Kunal Verma",
                    preview: "[Image]",
                    time: "3h",
                    unread: 0,
                  },
                  {
                    name: "Sara Kapoor",
                    preview: "Hi! Is this still available?",
                    time: "5h",
                    unread: 1,
                  },
                ].map((c) => (
                  <li
                    key={c.name}
                    className={`flex flex-col gap-0.5 border-b border-base-300/50 px-3 py-2.5 ${
                      c.selected
                        ? "border-l-2 border-l-primary bg-primary/5 pl-[10px]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[0.8125rem] font-medium">
                        {c.name}
                      </span>
                      <span className="ml-auto font-mono-op text-[0.625rem] text-base-content/40">
                        {c.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`truncate text-[0.75rem] ${
                          c.unread > 0
                            ? "text-base-content"
                            : "text-base-content/50"
                        }`}
                      >
                        {c.preview}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono-op text-[0.625rem] font-medium text-primary-content">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* thread */}
            <div className="flex flex-col">
              {/* thread header */}
              <div className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-base-300 bg-base-100 font-mono-op text-[0.75rem] font-semibold text-primary">
                  PS
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.875rem] font-semibold">
                    Priya Sharma
                  </span>
                  <span className="font-mono-op text-[0.6875rem] uppercase tracking-[0.06em] text-base-content/45">
                    +91 98••• ••• 421 · WhatsApp
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded border border-base-300 bg-base-100 px-2 py-1 font-mono-op text-[0.625rem] uppercase tracking-[0.06em] text-base-content/55">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    you
                  </span>
                </div>
              </div>

              {/* messages */}
              <div className="flex flex-1 flex-col gap-3 px-4 py-5">
                <Bubble side="in">
                  Hi! I wanted to ask about my order #4821
                </Bubble>
                <Bubble side="out" status="read">
                  Hi Priya! Your order shipped this morning. Tracking:
                  AWB123456789
                </Bubble>
                <Bubble side="in">Perfect, thanks 🙏</Bubble>
                <Bubble side="out" status="delivered">
                  Anything else I can help with?
                </Bubble>
              </div>

              {/* composer */}
              <div className="flex items-center gap-2 border-t border-base-300 px-3 py-2.5">
                <Paperclip className="h-4 w-4 text-base-content/40" />
                <input
                  type="text"
                  readOnly
                  placeholder="Type a reply…"
                  className="flex-1 bg-transparent text-[0.8125rem] placeholder:text-base-content/30 focus:outline-none"
                />
                <Smile className="h-4 w-4 text-base-content/40" />
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[0.75rem] font-medium text-primary-content"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 py-16">
        <span className="op-section-title">Platform features</span>
        <h2 className="mt-4 max-w-2xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Everything you need to run customer messaging at scale.
        </h2>
        <p className="mt-3 max-w-xl text-[0.9375rem] text-base-content/60">
          Six core modules that cover the full lifecycle — from first contact to
          campaign delivery report.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                className="op-grain group flex flex-col rounded-box border border-base-300 bg-base-200 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-base-300 bg-base-100">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="op-label">
                    {String(i + 1).padStart(2, "0")} · {f.label}
                  </span>
                </div>

                <p className="mt-4 text-[1rem] font-semibold tracking-[-0.015em]">
                  {f.title}
                </p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-base-content/60">
                  {f.desc}
                </p>

                <ul className="mt-4 flex flex-col gap-1.5 border-t border-base-300 pt-4">
                  {f.details.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-2 text-[0.75rem] text-base-content/55"
                    >
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── USE CASES ────────────────────────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Who it&apos;s for</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Three ways teams use MsgBuddy.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          One platform, three jobs — pick the lane that matches your team, or
          run all three from the same workspace.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <p className="mt-4 text-[1rem] font-semibold tracking-[-0.015em]">
                  {u.title}
                </p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-base-content/60">
                  {u.desc}
                </p>
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-base-300 pt-4">
                  {u.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-[0.75rem] text-base-content/55"
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
      </section>

      {/* ─── HOW IT WORKS — message lifecycle ─────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Message lifecycle</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          From send to read receipt.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          Every outbound message passes through a tracked pipeline with
          idempotency, retries, and real-time status updates.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {/* steps */}
          {[
            {
              step: "01",
              title: "Compose",
              desc: "Free-text, template, or media. Fill variables, pick a channel account, and hit send.",
              accent: false,
            },
            {
              step: "02",
              title: "Queue & deliver",
              desc: "BullMQ enqueues the job. Rate limits and provider throttles are respected. Retries on failure.",
              accent: false,
            },
            {
              step: "03",
              title: "Track",
              desc: "Delivery status streams back via webhooks and SSE — pending, sent, delivered, read, or failed.",
              accent: true,
            },
          ].map((s) => (
            <div
              key={s.step}
              className={`op-grain flex flex-1 flex-col rounded-box border p-5 ${
                s.accent
                  ? "border-primary/30 bg-primary/5"
                  : "border-base-300 bg-base-200"
              }`}
            >
              <span className="op-label">{s.step}</span>
              <p className="mt-3 text-[0.9375rem] font-semibold tracking-[-0.015em]">
                {s.title}
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-base-content/60">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* status badges */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="text-[0.75rem] text-base-content/40">
            Status flow:
          </span>
          {MESSAGE_LIFECYCLE.map((s, i) => {
            const Icon = s.icon;
            return (
              <span
                key={s.label}
                className={`inline-flex items-center gap-1.5 text-[0.75rem] font-medium ${s.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
                {i < MESSAGE_LIFECYCLE.length - 1 && (
                  <ArrowRight className="ml-2 h-3 w-3 text-base-content/20" />
                )}
              </span>
            );
          })}
        </div>
      </section>

      {/* ─── TEMPLATE APPROVAL WORKFLOW ───────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Template approval</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Multi-stage review, built in.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          Templates pass through internal approval before reaching Meta.
          Version, activate, and track quality scores without leaving MsgBuddy.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {["Draft", "Internal review", "Approved", "Meta review", "Live"].map(
            (stage, i) => (
              <div key={stage} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-md border px-3 py-1.5 font-mono-op text-[0.6875rem] uppercase tracking-[0.06em] ${
                    i === 4
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-base-300 bg-base-200 text-base-content/60"
                  }`}
                >
                  {stage}
                </span>
                {i < 4 && (
                  <ArrowRight className="h-3 w-3 text-base-content/25" />
                )}
              </div>
            )
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: LayoutTemplate,
              title: "Multi-version",
              desc: "Create and compare multiple template versions. Activate the best performer.",
            },
            {
              icon: Tag,
              title: "Category tracking",
              desc: "Marketing, Utility, Authentication — with auto-reclassification detection from Meta.",
            },
            {
              icon: FileUp,
              title: "Import from Meta",
              desc: "Pull existing templates from your WABA and manage them alongside new ones.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="op-grain rounded-box border border-base-300 bg-base-200 p-5"
              >
                <Icon className="h-4 w-4 text-primary" />
                <p className="mt-3 text-[0.875rem] font-semibold">{item.title}</p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-base-content/55">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── INFRASTRUCTURE CAPABILITIES ──────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Under the hood</span>
        <h2 className="mt-4 max-w-2xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Enterprise infrastructure, not just a pretty inbox.
        </h2>
        <p className="mt-3 max-w-xl text-[0.9375rem] text-base-content/60">
          Encryption, job queues, rate limiting, audit logs, and real-time
          event streaming — the backend to match the frontend.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="flex items-start gap-3 rounded-box border border-base-300 bg-base-200 p-4"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-base-300 bg-base-100">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[0.8125rem] font-semibold">{cap.title}</p>
                  <p className="mt-0.5 text-[0.75rem] leading-relaxed text-base-content/55">
                    {cap.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CONTACT & AUDIENCE SECTION ───────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Audience tools</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Contacts that work for campaigns.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          Tags, segments, custom fields, and compliance flags — so your
          broadcast always reaches the right people.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Tag, title: "Tags", desc: "Color-coded labels for quick categorization." },
            { icon: Filter, title: "Segments", desc: "Saved filters that resolve dynamically at send time." },
            { icon: FileUp, title: "Bulk import", desc: "CSV and JSON upload with per-row error tracking." },
            { icon: Merge, title: "Merge", desc: "Consolidate duplicate contacts into one record." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="op-grain rounded-box border border-base-300 bg-base-200 p-5"
              >
                <Icon className="h-4 w-4 text-primary" />
                <p className="mt-3 text-[0.875rem] font-semibold">{item.title}</p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-base-content/55">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CAMPAIGN DEEP DIVE ───────────────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Campaign engine</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Send thousands, track every one.
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="op-grain rounded-box border border-base-300 bg-base-200 p-6">
            <span className="op-label">Execution</span>
            <ul className="mt-4 flex flex-col gap-2.5">
              {[
                "Configurable throttle — messages per minute",
                "Automatic retries with exponential backoff",
                "Per-job idempotency to prevent duplicate sends",
                "Batch enqueuing with configurable chunk size",
                "Opt-out and blocked contact skipping",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[0.8125rem] text-base-content/65"
                >
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="op-grain rounded-box border border-base-300 bg-base-200 p-6">
            <span className="op-label">Monitoring</span>
            <ul className="mt-4 flex flex-col gap-2.5">
              {[
                "Live progress counters via server-sent events",
                "Per-run stats: completed, failed, skipped, replied",
                "Pause, resume, and cancel mid-flight",
                "Campaign lifecycle: Draft > Active > Completed",
                "Post-campaign delivery and response reports",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[0.8125rem] text-base-content/65"
                >
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── AUTOMATION ───────────────────────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Automation</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Rules that reply for you.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          Welcome new contacts, cover off-hours, react to keywords, and route
          conversations — without writing code.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Reply,
              name: "Welcome",
              desc: "Fire a template the first time a contact ever messages you. Once per contact, forever.",
            },
            {
              icon: Clock,
              name: "Out-of-hours",
              desc: "Auto-reply when an inbound arrives outside your business hours. Rate-limited per contact.",
            },
            {
              icon: Hash,
              name: "Keyword",
              desc: "Match inbound text and run an action — send a template, assign an agent, or reply with text.",
            },
            {
              icon: Bot,
              name: "Auto-assign",
              desc: "Route incoming conversations to the right teammate by rule, not by guesswork.",
            },
          ].map((rule) => {
            const Icon = rule.icon;
            return (
              <div
                key={rule.name}
                className="op-grain rounded-box border border-base-300 bg-base-200 p-5"
              >
                <Icon className="h-4 w-4 text-primary" />
                <p className="mt-3 text-[0.875rem] font-semibold">{rule.name}</p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-base-content/55">
                  {rule.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Calendar,
              title: "Business hours",
              desc: "Per-workspace schedule with timezone awareness — drives out-of-hours rules automatically.",
            },
            {
              icon: Zap,
              title: "Canned responses",
              desc: "Slash-prefixed shortcuts ranked by usage. Agents type a keyword, the reply expands instantly.",
            },
            {
              icon: ListTodo,
              title: "Agent tasks",
              desc: "Create TODOs tied to a contact or conversation, with priority, assignee, and snooze.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="op-grain rounded-box border border-base-300 bg-base-200 p-5"
              >
                <Icon className="h-4 w-4 text-primary" />
                <p className="mt-3 text-[0.875rem] font-semibold">{item.title}</p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-base-content/55">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── TEAM & ROLES ─────────────────────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Team management</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          The right access for every role.
        </h2>

        <div className="mt-8 flex flex-wrap gap-2">
          {[
            { role: "Owner", desc: "Full control" },
            { role: "Admin", desc: "Settings + members" },
            { role: "Supervisor", desc: "Assignment + oversight" },
            { role: "Agent", desc: "Conversations + contacts" },
            { role: "Auditor", desc: "Read-only audit" },
            { role: "Viewer", desc: "Read-only" },
          ].map((r) => (
            <div
              key={r.role}
              className="flex items-center gap-2 rounded-md border border-base-300 bg-base-200 px-3 py-2"
            >
              <span className="font-mono-op text-[0.6875rem] font-medium uppercase tracking-wider text-primary">
                {r.role}
              </span>
              <span className="text-[0.6875rem] text-base-content/45">
                {r.desc}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: MessagesSquare,
              title: "Conversation presence",
              desc: "See who's viewing a conversation in real time. No duplicate replies.",
            },
            {
              icon: Clock,
              title: "Inactivity rules",
              desc: "Auto-unassign conversations if an agent doesn't reply within your threshold.",
            },
            {
              icon: Shield,
              title: "Audit logs",
              desc: "Every admin action is logged with before/after state for compliance.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="op-grain rounded-box border border-base-300 bg-base-200 p-5"
              >
                <Icon className="h-4 w-4 text-primary" />
                <p className="mt-3 text-[0.875rem] font-semibold">{item.title}</p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-base-content/55">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── DEVELOPER & API ──────────────────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">Developer &amp; API</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Built to be integrated.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          A REST endpoint for every surface, signed webhooks for every event,
          and idempotency so retries stay safe.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Code,
              title: "REST API",
              desc: "Messaging, contacts, templates, campaigns — everything you see in the UI is callable.",
            },
            {
              icon: KeyRound,
              title: "Live & test API keys",
              desc: "mb_live and mb_test prefixes, scopes, expiry, and revocation. Plaintext shown once at creation.",
            },
            {
              icon: Webhook,
              title: "Outbound webhooks",
              desc: "Subscribe to delivery, read, reply, template, and contact events. HMAC-SHA256 signed with rotatable secrets.",
            },
            {
              icon: Fingerprint,
              title: "Idempotency keys",
              desc: "Retry safely. Duplicate keys return the cached response for 24 hours and reject body mismatches with 409.",
            },
            {
              icon: Shield,
              title: "Versioned envelopes",
              desc: "Every webhook payload carries an apiVersion so you can upgrade on your schedule, not ours.",
            },
            {
              icon: BarChart3,
              title: "API key usage logs",
              desc: "Per-request audit of every key — method, route, status, IP, request id. 90-day retention.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-box border border-base-300 bg-base-200 p-4"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-base-300 bg-base-100">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[0.8125rem] font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[0.75rem] leading-relaxed text-base-content/55">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-16">
        <span className="op-section-title">FAQ</span>
        <h2 className="mt-4 max-w-xl text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
          Questions we hear a lot.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-base-content/60">
          Can&apos;t find what you&apos;re looking for? Reach out — we reply fast.
        </p>

        <div className="mt-8 flex flex-col gap-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-box border border-base-300 bg-base-200"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-[0.9375rem] font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-base-content/40 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-base-300 px-5 py-4 text-[0.8125rem] leading-relaxed text-base-content/65">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="op-grain rounded-box border border-base-300 bg-base-200 p-8 sm:p-12">
          <span className="op-signal">
            <span className="dot" />
            ready
          </span>
          <h2 className="mt-6 max-w-lg text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">
            Start messaging in minutes.
          </h2>
          <p className="mt-3 max-w-md text-[0.9375rem] text-base-content/60">
            Create a workspace, connect your WhatsApp number through Embedded
            Signup, and send your first template — no API keys to copy-paste.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/register" className="btn btn-primary">
              Create workspace <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
            <Link href="/pricing" className="btn">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
