"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  recurringApi,
  type Cadence,
  type ManifestRow,
  type RecurringPlan,
  type RecurringProduct,
  type RecurringSettings,
  type RecurringSubscription,
  type RecurringSubscriptionDetail,
} from "@/lib/recurringApi";

type Tab = "plans" | "subscribers" | "fulfilment" | "settings";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function RecurringClient() {
  const [tab, setTab] = useState<Tab>("subscribers");

  return (
    <div className="space-y-4">
      <div role="tablist" className="tabs tabs-bordered">
        {(
          [
            ["subscribers", "Subscribers"],
            ["plans", "Plans & products"],
            ["fulfilment", "Fulfilment"],
            ["settings", "Settings"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            className={`tab ${tab === key ? "tab-active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "subscribers" && <SubscribersTab />}
      {tab === "plans" && <PlansTab />}
      {tab === "fulfilment" && <FulfilmentTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

/* ─────────────────────────────── Subscribers ─────────────────────────────── */

function SubscribersTab() {
  const [subs, setSubs] = useState<RecurringSubscription[]>([]);
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        recurringApi.listSubscriptions(),
        recurringApi.listPlans(),
      ]);
      setSubs(s);
      setPlans(p);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Subscribers</h2>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)} disabled={plans.length === 0}>
          New subscription
        </button>
      </div>
      {plans.length === 0 && !loading && (
        <p className="text-xs text-base-content/60">Create a plan first (Plans &amp; products tab).</p>
      )}
      {error && <Alert msg={error} />}

      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Plan</th>
                <th>Cadence</th>
                <th>Start</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="hover cursor-pointer" >
                  <td onClick={() => setOpenId(s.id)}>
                    <div className="font-medium">{s.contact.name ?? s.contact.phone}</div>
                    <div className="text-xs text-base-content/60">{s.contact.phone}</div>
                  </td>
                  <td onClick={() => setOpenId(s.id)}>{s.plan.name}</td>
                  <td onClick={() => setOpenId(s.id)}>
                    {s.cadence}
                    {s.cadence === "CUSTOM" ? ` (${s.daysOfWeek.join(",")})` : ""}
                  </td>
                  <td onClick={() => setOpenId(s.id)}>{s.startDate.slice(0, 10)}</td>
                  <td onClick={() => setOpenId(s.id)}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {s.status !== "CANCELLED" && (
                      <>
                        {s.status === "ACTIVE" ? (
                          <button className="btn btn-ghost btn-xs" onClick={() => act(s.id, () => recurringApi.pause(s.id))}>
                            Pause
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-xs" onClick={() => act(s.id, () => recurringApi.resume(s.id))}>
                            Resume
                          </button>
                        )}
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => act(s.id, () => recurringApi.cancel(s.id))}>
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-base-content/50">
                    No subscriptions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateSubscriptionModal
          plans={plans}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}
      {openId && <SubscriberDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function CreateSubscriptionModal({
  plans,
  onClose,
  onCreated,
}: {
  plans: RecurringPlan[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [contactId, setContactId] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [cadence, setCadence] = useState<Cadence>("DAILY");
  const [days, setDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [slot, setSlot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await recurringApi.createSubscription({
        contactId: contactId.trim(),
        planId,
        cadence,
        daysOfWeek: cadence === "CUSTOM" ? days : undefined,
        slot: slot.trim() || undefined,
        startDate,
      });
      onCreated();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">New subscription</h3>
        <div className="space-y-3 py-4">
          {error && <Alert msg={error} />}
          <Field label="Contact ID">
            <input
              className="input input-bordered input-sm w-full"
              placeholder="contact cuid (from Contacts)"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            />
          </Field>
          <Field label="Plan">
            <select className="select select-bordered select-sm w-full" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cadence">
            <select className="select select-bordered select-sm w-full" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
              <option value="DAILY">Daily</option>
              <option value="WEEKDAYS">Weekdays (Mon–Fri)</option>
              <option value="CUSTOM">Custom days</option>
            </select>
          </Field>
          {cadence === "CUSTOM" && (
            <div className="flex flex-wrap gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className={`btn btn-xs ${days.includes(i) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => toggleDay(i)}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <Field label="Start date">
            <input type="date" className="input input-bordered input-sm w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Slot (optional)">
            <input className="input input-bordered input-sm w-full" placeholder="e.g. morning" value={slot} onChange={(e) => setSlot(e.target.value)} />
          </Field>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={saving || !contactId.trim() || !planId || !startDate || (cadence === "CUSTOM" && days.length === 0)}
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            Create
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}

function SubscriberDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<RecurringSubscriptionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await recurringApi.getSubscription(id));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function doTopUp() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await recurringApi.topUp(detail.contact.id, topUp.trim());
      setTopUp("");
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">
            {detail ? detail.contact.name ?? detail.contact.phone : "Subscriber"}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <Alert msg={error} />}
        {!detail ? (
          <Spinner />
        ) : (
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Plan" value={detail.plan.name} />
              <Info label="Status" value={detail.status} />
              <Info label="Cadence" value={detail.cadence} />
              <Info label="Wallet balance" value={detail.wallet.balance} />
            </div>

            <div className="flex items-end gap-2">
              <Field label="Manual top-up">
                <input
                  className="input input-bordered input-sm w-40"
                  placeholder="amount"
                  value={topUp}
                  onChange={(e) => setTopUp(e.target.value)}
                />
              </Field>
              <button className="btn btn-sm btn-primary" onClick={doTopUp} disabled={busy || !topUp.trim()}>
                {busy && <span className="loading loading-spinner loading-xs" />}
                Credit wallet
              </button>
            </div>

            <div>
              <div className="op-label mb-1">Cycles</div>
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.cycles.map((c) => (
                      <tr key={c.id}>
                        <td>{c.deliveryDate.slice(0, 10)}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td>{c.amount}</td>
                        <td>{c.fee}</td>
                      </tr>
                    ))}
                    {detail.cycles.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-base-content/50">
                          No cycles yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="op-label mb-1">Wallet ledger</div>
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.wallet.ledger.map((l) => (
                      <tr key={l.id}>
                        <td>{l.createdAt.slice(0, 10)}</td>
                        <td className={l.type === "CREDIT" ? "text-success" : "text-error"}>{l.type}</td>
                        <td>{l.amount}</td>
                        <td>{l.reason}</td>
                      </tr>
                    ))}
                    {detail.wallet.ledger.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-base-content/50">
                          No ledger entries.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}

/* ────────────────────────────── Plans & products ────────────────────────────── */

function PlansTab() {
  const [products, setProducts] = useState<RecurringProduct[]>([]);
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // product form
  const [pName, setPName] = useState("");
  const [pSku, setPSku] = useState("");
  const [pPrice, setPPrice] = useState("");

  // plan form
  const [planName, setPlanName] = useState("");
  const [planItems, setPlanItems] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pr, pl] = await Promise.all([recurringApi.listProducts(), recurringApi.listPlans()]);
      setProducts(pr);
      setPlans(pl);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addProduct() {
    try {
      await recurringApi.createProduct({ name: pName.trim(), sku: pSku.trim(), price: pPrice.trim() });
      setPName("");
      setPSku("");
      setPPrice("");
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function addPlan() {
    const items = Object.entries(planItems)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (!planName.trim() || items.length === 0) return;
    try {
      await recurringApi.createPlan({ name: planName.trim(), items });
      setPlanName("");
      setPlanItems({});
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {error && (
        <div className="md:col-span-2">
          <Alert msg={error} />
        </div>
      )}

      {/* Products */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Products</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Name">
            <input className="input input-bordered input-sm w-32" value={pName} onChange={(e) => setPName(e.target.value)} />
          </Field>
          <Field label="SKU">
            <input className="input input-bordered input-sm w-24" value={pSku} onChange={(e) => setPSku(e.target.value)} />
          </Field>
          <Field label="Price">
            <input className="input input-bordered input-sm w-20" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
          </Field>
          <button className="btn btn-sm btn-primary" onClick={addProduct} disabled={!pName.trim() || !pSku.trim() || !pPrice.trim()}>
            Add
          </button>
        </div>
        <ul className="rounded-box border border-base-300 divide-y divide-base-300">
          {products.map((p) => (
            <li key={p.id} className="flex justify-between px-3 py-2 text-sm">
              <span>
                {p.name} <span className="text-base-content/50">({p.sku})</span>
              </span>
              <span>{p.price}</span>
            </li>
          ))}
          {products.length === 0 && <li className="px-3 py-2 text-sm text-base-content/50">No products.</li>}
        </ul>
      </div>

      {/* Plans */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Plans (fixed bundles)</h2>
        <div className="space-y-2 rounded-box border border-base-300 p-3">
          <Field label="Plan name">
            <input className="input input-bordered input-sm w-full" value={planName} onChange={(e) => setPlanName(e.target.value)} />
          </Field>
          <div className="op-label">Quantities per product</div>
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">
                {p.name} <span className="text-base-content/50">@ {p.price}</span>
              </span>
              <input
                type="number"
                min={0}
                className="input input-bordered input-xs w-16"
                value={planItems[p.id] ?? 0}
                onChange={(e) => setPlanItems((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
              />
            </div>
          ))}
          <button className="btn btn-sm btn-primary w-full" onClick={addPlan} disabled={!planName.trim() || products.length === 0}>
            Create plan
          </button>
        </div>
        <ul className="rounded-box border border-base-300 divide-y divide-base-300">
          {plans.map((pl) => (
            <li key={pl.id} className="px-3 py-2 text-sm">
              <div className="font-medium">{pl.name}</div>
              <div className="text-xs text-base-content/60">
                {pl.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ")}
              </div>
            </li>
          ))}
          {plans.length === 0 && <li className="px-3 py-2 text-sm text-base-content/50">No plans.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Fulfilment ─────────────────────────────── */

function FulfilmentTab() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<ManifestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ date: string }>, label: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await fn();
      setNote(`${label} enqueued for ${r.date}.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadManifest() {
    if (!date) return;
    setError(null);
    try {
      setRows(await recurringApi.manifest(date));
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Date">
          <input type="date" className="input input-bordered input-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button className="btn btn-sm" onClick={loadManifest} disabled={!date}>
          Load manifest
        </button>
        <button className="btn btn-sm btn-outline" onClick={() => run(() => recurringApi.triggerGenerate(date || undefined), "Generation")} disabled={busy}>
          Generate now
        </button>
        <button className="btn btn-sm btn-outline" onClick={() => run(() => recurringApi.triggerLock(date || undefined), "Lock")} disabled={busy}>
          Lock now
        </button>
      </div>
      {note && <div className="rounded-box border border-success/30 bg-base-200 px-3 py-2 text-sm text-success">{note}</div>}
      {error && <Alert msg={error} />}

      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Phone</th>
              <th>Slot</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cycleId}>
                <td>{r.contact ?? "—"}</td>
                <td>{r.phone}</td>
                <td>{r.slot ?? "—"}</td>
                <td>{r.amount}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-base-content/50">
                  No locked cycles for this date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Settings ─────────────────────────────── */

function SettingsTab() {
  const [s, setS] = useState<RecurringSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    recurringApi.getSettings().then(setS).catch((e) => setError(errMsg(e)));
  }, []);

  function set<K extends keyof RecurringSettings>(k: K, v: RecurringSettings[K]) {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
    setSaved(false);
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await recurringApi.updateSettings(s);
      setS(updated);
      setSaved(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (!s) return error ? <Alert msg={error} /> : <Spinner />;

  return (
    <div className="max-w-lg space-y-3">
      {error && <Alert msg={error} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timezone">
          <input className="input input-bordered input-sm w-full" value={s.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </Field>
        <Field label="Currency">
          <input className="input input-bordered input-sm w-full" value={s.currency} onChange={(e) => set("currency", e.target.value)} />
        </Field>
        <Field label="Reminder time (HH:mm)">
          <input className="input input-bordered input-sm w-full" value={s.reminderTime} onChange={(e) => set("reminderTime", e.target.value)} />
        </Field>
        <Field label="Cutoff time (HH:mm)">
          <input className="input input-bordered input-sm w-full" value={s.cutoffTime} onChange={(e) => set("cutoffTime", e.target.value)} />
        </Field>
        <Field label="Delivery fee">
          <input className="input input-bordered input-sm w-full" value={s.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} />
        </Field>
        <Field label="Low-balance threshold">
          <input className="input input-bordered input-sm w-full" value={s.lowBalanceThreshold} onChange={(e) => set("lowBalanceThreshold", e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="checkbox checkbox-sm" checked={s.refundSkipAsCredit} onChange={(e) => set("refundSkipAsCredit", e.target.checked)} />
        Refund a skipped cycle&apos;s charge as wallet credit
      </label>
      <div className="op-label pt-2">Template version ids (approved WhatsApp utility templates)</div>
      <Field label="Reminder template">
        <input className="input input-bordered input-sm w-full" value={s.reminderTemplateVersionId ?? ""} onChange={(e) => set("reminderTemplateVersionId", e.target.value || null)} />
      </Field>
      <Field label="Low-balance template">
        <input className="input input-bordered input-sm w-full" value={s.lowBalanceTemplateVersionId ?? ""} onChange={(e) => set("lowBalanceTemplateVersionId", e.target.value || null)} />
      </Field>
      <Field label="Skip-confirmed template">
        <input className="input input-bordered input-sm w-full" value={s.skipConfirmedTemplateVersionId ?? ""} onChange={(e) => set("skipConfirmedTemplateVersionId", e.target.value || null)} />
      </Field>
      <div className="flex items-center gap-3 pt-2">
        <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>
          {busy && <span className="loading loading-spinner loading-xs" />}
          Save settings
        </button>
        {saved && <span className="text-sm text-success">Saved.</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────── shared bits ─────────────────────────────── */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="op-label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="op-label">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <span className="loading loading-spinner" />
    </div>
  );
}

function Alert({ msg }: { msg: string }) {
  return (
    <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm text-error">
      {msg}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" || status === "LOCKED" || status === "DELIVERED"
      ? "badge-success"
      : status === "PAUSED" || status === "SCHEDULED"
        ? "badge-warning"
        : status === "CANCELLED" || status === "SKIPPED"
          ? "badge-ghost"
          : "badge-info";
  return <span className={`badge badge-sm ${tone}`}>{status}</span>;
}
