"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useMediaQuery, LG_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { useRightPanel } from "./useRightPanel";

/**
 * Details pane beside main content (lg+ only). Smaller viewports hide the pane;
 * preference is still stored for when the window is wide enough again.
 */
export function GlobalRightPanel() {
  const { isOpen, close, panel } = useRightPanel();
  const isLgUp = useMediaQuery(LG_MEDIA_QUERY);

  /** Only pages that call `setContent` register details; avoid an empty strip elsewhere. */
  const detailsContent = panel?.content;
  const hasDetails = Boolean(detailsContent);

  useEffect(() => {
    if (!isOpen || !isLgUp || !hasDetails) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isLgUp, hasDetails, close]);

  if (!isOpen || !isLgUp || !hasDetails || !panel) return null;

  return (
    <aside
      aria-label={panel.title || "Details"}
      className="flex h-full min-h-0 w-[clamp(18rem,28vw,32rem)] shrink-0 flex-col border-l border-base-300 bg-base-100 shadow-sm"
    >
      <div className="flex min-h-0 shrink-0 items-center justify-between gap-2 border-b border-base-300 px-3 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-medium text-base-content/90">
          {panel.title || "Details"}
        </h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square shrink-0"
          onClick={close}
          aria-label="Close details pane"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {detailsContent}
      </div>
    </aside>
  );
}


/*

Short answer: **no, that’s too restrictive and will bite you later.**
Long answer: you need **controlled flexibility**, not “only assigned agent = god mode.”

Let’s break this like someone who’s actually going to build a serious CRM and not a college project.

---

## 🔥 Core Principle

**Ownership ≠ Exclusivity**

Assigned agent = **primary handler**, not the **only human allowed to exist in that conversation**

If you lock it too hard:

* conversations stall when agent is busy/offline
* supervisors can’t intervene in time
* escalations become chaos
* clients get ignored → business dies → everyone cries

---

## 🧠 Recommended Model (Used in real CRMs)

### 1. Assigned Agent

* ✅ Can send messages
* ✅ Gets all notifications
* ✅ Owns SLA responsibility

---

### 2. Other Agents

* 👀 Can view conversation (based on permission)
* ❌ Cannot send by default
* ✅ Can request takeover OR be assigned

Optional (advanced):

* allow “reply if unassigned for X minutes”
* or “reply if tagged”

---

### 3. Supervisor

* 👀 Full visibility
* ✅ Can send messages (override)
* ✅ Can reassign conversations
* ✅ Can silently monitor

This is critical. If supervisor can’t jump in, your system is basically decorative.

---

### 4. Admin / Owner

* 🧠 Full control (obviously)
* ✅ Send messages
* ✅ Force assign / unassign
* ✅ Access everything

If admin can’t intervene, congratulations, you’ve built a very secure but useless system.

---

## ⚙️ Notifications Logic (this is where most people mess up)

### Assigned Agent

* 🔔 Always notified

### Other Agents

* 🔕 No notification by default
* 🔔 Only if:

  * tagged (`@agent`)
  * conversation unassigned
  * part of team queue

### Supervisor/Admin

* 🔔 Optional:

  * all conversations
  * only escalations
  * only SLA breaches

Make this configurable or you’ll have angry teams muting your product in 2 days.

---

## 🧩 Real-World Patterns You Should Support

### 1. Takeover Model

* Agent clicks: **“Take Conversation”**
* Now they become assigned agent

---

### 2. Collaboration Mode

* Multiple agents can reply
* Used in sales / complex support

(But log who sent what. Otherwise blame game begins.)

---

### 3. Locked Mode (Strict)

* Only assigned agent can reply
* Used in compliance-heavy environments

---

### 4. Queue-Based Model (like Intercom / Zendesk)

* Conversations sit in queue
* Any agent can pick them

---

## 💣 My blunt take for MsgBuddy

If you’re building this seriously:

👉 Default mode:

* Assigned agent = primary
* Supervisor/Admin = override allowed
* Others = view only

👉 Add config:

```
conversation_mode:
  - strict
  - collaborative
  - queue
```

👉 Add feature:

* “Takeover”
* “Reassign”
* “Escalate”

---

## 🧠 Architecture Hint (since you’re not here for basic advice)

In your DB:

```
conversation:
  assigned_agent_id
  team_id
  status
  mode (strict | collaborative | queue)

message:
  sender_id
  sender_role
```

And permission layer:

```
can_send_message(user, conversation):
  if user.role in [ADMIN, OWNER]: return true
  if user.role == SUPERVISOR: return true
  if conversation.mode == "collaborative": return true
  if user.id == conversation.assigned_agent_id: return true
  return false
```

---

## Final reality check

You’re not building WhatsApp clone.
You’re building a **team coordination system disguised as chat**.

If you design it like “only one person allowed,” you’ll recreate customer support hell in software form.

Don’t do that.



*/ 