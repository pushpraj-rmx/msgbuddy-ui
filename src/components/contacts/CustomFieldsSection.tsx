"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { contactsApi, customFieldsApi } from "@/lib/api";
import type {
  CustomFieldDef,
  CustomFieldType,
} from "@/lib/types";

const DEFINITIONS_QUERY_KEY = ["custom-field-definitions"] as const;

const FIELD_TYPES: CustomFieldType[] = [
  "TEXT",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "URL",
  "EMAIL",
];

export function CustomFieldsSection({ contactId }: { contactId: string }) {
  const [editing, setEditing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: definitions = [] } = useQuery({
    queryKey: DEFINITIONS_QUERY_KEY,
    queryFn: () => customFieldsApi.list(),
  });

  const { data: values = [], refetch } = useQuery({
    queryKey: ["contacts", contactId, "custom-fields"],
    queryFn: () => contactsApi.getCustomFieldValues(contactId),
  });

  const updateMutation = useMutation({
    mutationFn: (fields: Array<{ fieldId: string; value: string }>) =>
      contactsApi.setCustomFieldValues(contactId, fields),
    onSuccess: () => {
      refetch();
      setEditing(false);
    },
  });

  const valueByFieldId = new Map(values.map((v) => [v.fieldId, v.value]));

  const handleSave = (fields: Array<{ fieldId: string; value: string }>) => {
    updateMutation.mutate(fields);
  };

  const invalidateDefinitions = () =>
    queryClient.invalidateQueries({ queryKey: DEFINITIONS_QUERY_KEY });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => setManageOpen(true)}
        >
          Manage fields
        </button>
        {definitions.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel" : "Edit values"}
          </button>
        )}
      </div>

      {manageOpen && (
        <ManageDefinitionsModal
          onClose={() => setManageOpen(false)}
          onChanged={invalidateDefinitions}
        />
      )}

      {definitions.length === 0 && !editing && (
        <p className="text-[0.8125rem] text-base-content/55">
          No custom fields defined.{" "}
          <button
            type="button"
            className="link link-hover link-primary"
            onClick={() => setManageOpen(true)}
          >
            Manage fields
          </button>{" "}
          to add (e.g. city, label).
        </p>
      )}

      {definitions.length > 0 && editing && (
        <CustomFieldsEditForm
          definitions={definitions}
          valueByFieldId={valueByFieldId}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          isPending={updateMutation.isPending}
        />
      )}

      {definitions.length > 0 && !editing && (
        <ul className="rounded-box border border-base-300 bg-base-200">
          {definitions.map((def, i) => (
            <li
              key={def.id}
              className={`flex items-center justify-between gap-3 px-3 py-2 text-[0.78125rem] ${
                i < definitions.length - 1 ? "border-b border-base-300/50" : ""
              }`}
            >
              <span className="op-label">{def.label}</span>
              <span className="text-base-content">{valueByFieldId.get(def.id) ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManageDefinitionsModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [isRequired, setIsRequired] = useState(false);
  const [editingDef, setEditingDef] = useState<CustomFieldDef | null>(null);
  const [confirmDeleteDef, setConfirmDeleteDef] = useState<CustomFieldDef | null>(null);

  const queryClient = useQueryClient();
  const { data: definitions = [] } = useQuery({
    queryKey: DEFINITIONS_QUERY_KEY,
    queryFn: () => customFieldsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      label: string;
      type?: CustomFieldType;
      isRequired?: boolean;
    }) => customFieldsApi.create(data),
    onSuccess: () => {
      onChanged();
      queryClient.invalidateQueries({ queryKey: DEFINITIONS_QUERY_KEY });
      setName("");
      setLabel("");
      setType("TEXT");
      setIsRequired(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { label?: string; type?: CustomFieldType; isRequired?: boolean };
    }) => customFieldsApi.update(id, data),
    onSuccess: () => {
      onChanged();
      queryClient.invalidateQueries({ queryKey: DEFINITIONS_QUERY_KEY });
      setEditingDef(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customFieldsApi.delete(id),
    onSuccess: () => {
      onChanged();
      queryClient.invalidateQueries({ queryKey: DEFINITIONS_QUERY_KEY });
    },
  });

  const handleCreate = () => {
    const n = name.trim().toLowerCase().replace(/\s+/g, "_");
    const l = label.trim() || n;
    if (!n) return;
    createMutation.mutate({
      name: n,
      label: l,
      type,
      isRequired,
    });
  };

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-lg rounded-box border border-base-300 !bg-base-100 p-0">
        <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div>
            <span className="op-label">contacts</span>
            <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">Custom field definitions</h3>
            <p className="mt-1 text-[0.78125rem] text-base-content/55">
              Define fields once (e.g. city, label); set values per contact.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Add field */}
          <div className="rounded-box border border-base-300 bg-base-200">
            <div className="border-b border-base-300 px-3 py-2">
              <span className="op-label">Add field</span>
            </div>
            <div className="space-y-2 px-3 py-3">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="name (e.g. city, label)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="label (e.g. City, Label)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <select
                  className="select select-bordered select-sm flex-1 font-mono-op text-[0.6875rem]"
                  value={type}
                  onChange={(e) => setType(e.target.value as CustomFieldType)}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-1.5 text-[0.78125rem]">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                  />
                  <span>Required</span>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  onClick={handleCreate}
                  disabled={!name.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Add definition"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Existing fields */}
          <div className="rounded-box border border-base-300 bg-base-200">
            <div className="border-b border-base-300 px-3 py-2">
              <span className="op-label">Existing fields · {definitions.length}</span>
            </div>
            {definitions.length === 0 ? (
              <p className="px-3 py-3 text-[0.8125rem] text-base-content/55">None yet.</p>
            ) : (
              <ul>
                {definitions.map((def, i) => (
                  <li
                    key={def.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${
                      i < definitions.length - 1 ? "border-b border-base-300/50" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium text-base-content">
                        {def.label}
                      </p>
                      <p className="font-mono-op mt-0.5 text-[0.625rem] tracking-[0.04em] text-base-content/55">
                        {def.name} · {def.type.toLowerCase()}
                        {def.isRequired ? " · required" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="tooltip tooltip-left" data-tip="Edit">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => setEditingDef(def)}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="tooltip tooltip-left" data-tip="Delete">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square text-error/70 hover:text-error"
                          onClick={() => setConfirmDeleteDef(def)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editingDef && (
            <div className="rounded-box border border-primary/40 bg-base-200">
              <div className="border-b border-primary/30 px-3 py-2">
                <span className="op-label text-primary">Edit · {editingDef.label}</span>
              </div>
              <EditDefinitionForm
                def={editingDef}
                onSave={(data) => {
                  updateMutation.mutate({
                    id: editingDef.id,
                    data,
                  });
                }}
                onCancel={() => setEditingDef(null)}
                isPending={updateMutation.isPending}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-base-300 px-5 py-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>

      <ConfirmDialog
        open={confirmDeleteDef !== null}
        title={`Delete "${confirmDeleteDef?.label ?? ""}"?`}
        description="All contact values for this field will be removed."
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDeleteDef) deleteMutation.mutate(confirmDeleteDef.id);
          setConfirmDeleteDef(null);
        }}
        onClose={() => setConfirmDeleteDef(null)}
      />
    </dialog>
  );
}

function EditDefinitionForm({
  def,
  onSave,
  onCancel,
  isPending,
}: {
  def: CustomFieldDef;
  onSave: (data: {
    label?: string;
    type?: CustomFieldType;
    isRequired?: boolean;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(def.label);
  const [type, setType] = useState<CustomFieldType>(def.type);
  const [isRequired, setIsRequired] = useState(def.isRequired);

  return (
    <div className="space-y-2 px-3 py-3">
      <input
        type="text"
        className="input input-bordered input-sm w-full"
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <select
          className="select select-bordered select-sm flex-1 font-mono-op text-[0.6875rem]"
          value={type}
          onChange={(e) => setType(e.target.value as CustomFieldType)}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-[0.78125rem]">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
          />
          <span>Required</span>
        </label>
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          onClick={() => onSave({ label, type, isRequired })}
          disabled={isPending}
        >
          {isPending ? <span className="loading loading-spinner loading-xs" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function CustomFieldsEditForm({
  definitions,
  valueByFieldId,
  onSave,
  onCancel,
  isPending,
}: {
  definitions: CustomFieldDef[];
  valueByFieldId: Map<string, string>;
  onSave: (fields: Array<{ fieldId: string; value: string }>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [local, setLocal] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      definitions.map((d) => [d.id, valueByFieldId.get(d.id) ?? ""])
    )
  );

  const setValue = (fieldId: string, value: string) => {
    setLocal((prev) => ({ ...prev, [fieldId]: value }));
  };

  return (
    <div className="space-y-3">
      {definitions.map((def) => (
        <div key={def.id} className="space-y-1.5">
          <span className="op-label block">
            {def.label}
            {def.isRequired ? <span className="ml-1 text-error">*</span> : null}
          </span>
          {def.type === "BOOLEAN" ? (
            <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={(local[def.id] ?? "").toLowerCase() === "true"}
                onChange={(e) =>
                  setValue(def.id, e.target.checked ? "true" : "false")
                }
              />
              <span>Yes</span>
            </label>
          ) : (
            <input
              type={
                def.type === "NUMBER"
                  ? "number"
                  : def.type === "DATE"
                    ? "date"
                    : def.type === "EMAIL"
                      ? "email"
                      : def.type === "URL"
                        ? "url"
                        : "text"
              }
              className="input input-bordered input-sm w-full"
              value={local[def.id] ?? ""}
              onChange={(e) => setValue(def.id, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          onClick={() =>
            onSave(
              definitions.map((d) => ({
                fieldId: d.id,
                value: local[d.id] ?? "",
              }))
            )
          }
          disabled={isPending}
        >
          {isPending ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
