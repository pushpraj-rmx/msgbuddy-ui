"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { segmentsApi } from "@/lib/api";

const SEGMENTS_QUERY_KEY = ["segments"] as const;

export function SegmentPicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const segmentIdFromUrl = searchParams.get("segment");

  const { data: segments = [] } = useQuery({
    queryKey: SEGMENTS_QUERY_KEY,
    queryFn: () => segmentsApi.list(),
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      router.push("/contacts");
    } else {
      router.push(`/contacts?segment=${value}`);
    }
  };

  return (
    <div className="form-control w-full sm:max-w-xs">
      <label className="label py-0">
        <span className="label-text text-sm text-base-content/70">
          Segment
        </span>
      </label>
      <select
        className="select select-bordered w-full"
        value={segmentIdFromUrl ?? ""}
        onChange={handleChange}
        aria-label="Filter contacts by segment"
      >
        <option value="">All contacts</option>
        {segments.map((seg) => (
          <option key={seg.id} value={seg.id}>
            {seg.name}
            {seg.contactCount != null ? ` (${seg.contactCount})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
