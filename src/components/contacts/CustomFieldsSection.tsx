"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { contactsApi, customFieldsApi } from "@/lib/api";
import type {
  CustomFieldDef,
  CustomFieldType,
} from "@/lib/types";

const DEFINITIONS_QUERY_KEY = ["custom-field-definitions"] as const;

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setManageOpen(true)}
        >
          Manage fields
        </button>
        {definitions.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditing(true)}
          >
            Edit values
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
        <p className="text-sm text-base-content/60">
          No custom fields defined. Add fields (e.g. city, label) via{" "}
          <button
            type="button"
            className="link link-hover link-primary"
            onClick={() => setManageOpen(true)}
          >
            Manage fields
          </button>
          .
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
        <ul className="space-y-2">
          {definitions.map((def) => (
            <li key={def.id} className="flex justify-between gap-4 text-sm">
              <span className="text-base-content/70">{def.label}</span>
              <span>{valueByFieldId.get(def.id) ?? "—"}</span>
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

  const FIELD_TYPES: CustomFieldType[] = [
    "TEXT",
    "NUMBER",
    "DATE",
    "BOOLEAN",
    "URL",
    "EMAIL",
  ];

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-semibold">Custom field definitions</h3>
        <p className="mt-1 text-sm text-base-content/70">
          Define fields once (e.g. city, label); then set values per contact.
        </p>

        <div className="mt-4 space-y-4">
          <div className="rounded-box border border-base-300 bg-base-200 p-3">
            <p className="text-sm font-medium mb-2">Add field</p>
            <div className="space-y-2">
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
              <select
                className="select select-bordered select-sm w-full"
                value={type}
                onChange={(e) => setType(e.target.value as CustomFieldType)}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                />
                <span className="text-sm">Required</span>
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCreate}
                disabled={
                  !name.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending
                  ? "Adding…"
                  : "Add definition"}
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Existing fields</p>
            {definitions.length === 0 ? (
              <p className="text-sm text-base-content/60">None yet.</p>
            ) : (
              <ul className="space-y-2">
                {definitions.map((def) => (
                  <li
                    key={def.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-box border border-base-300 p-2 text-sm"
                  >
                    <span>
                      <strong>{def.label}</strong> ({def.name}, {def.type}
                      {def.isRequired ? ", required" : ""})
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          setEditingDef(def);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${def.label}"? All contact values for this field will be removed.`
                            )
                          ) {
                            deleteMutation.mutate(def.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editingDef && (
            <div className="rounded-box border border-primary/30 bg-base-200 p-3">
              <p className="text-sm font-medium mb-2">
                Edit: {editingDef.label}
              </p>
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

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
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
    <div className="space-y-2">
      <input
        type="text"
        className="input input-bordered input-sm w-full"
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <select
        className="select select-bordered select-sm w-full"
        value={type}
        onChange={(e) => setType(e.target.value as CustomFieldType)}
      >
        {(["TEXT", "NUMBER", "DATE", "BOOLEAN", "URL", "EMAIL"] as const).map(
          (t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))
        }
      </select>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
        />
        <span className="text-sm">Required</span>
      </label>
      <div className="flex gap-2">
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
          onClick={() => onSave({ label, type, isRequired })}
          disabled={isPending}
        >
          Save
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
        <div key={def.id}>
          <label className="label">
            <span className="label-text">
              {def.label}
              {def.isRequired ? " *" : ""}
            </span>
          </label>
          {def.type === "BOOLEAN" ? (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={(local[def.id] ?? "").toLowerCase() === "true"}
                onChange={(e) =>
                  setValue(def.id, e.target.checked ? "true" : "false")
                }
              />
              <span className="text-sm">Yes</span>
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
              className="input input-bordered w-full input-sm"
              value={local[def.id] ?? ""}
              onChange={(e) => setValue(def.id, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2">
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
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
