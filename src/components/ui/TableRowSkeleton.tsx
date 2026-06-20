/**
 * Operator skeleton row for tables. Matches table grid width.
 * Uses DaisyUI `skeleton` under the hood for the shimmer animation
 * (picks up theme colors automatically).
 */
export function TableRowSkeleton({
  columns = 4,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-base-300 last:border-b-0">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c} className="px-3 py-3">
              <div
                className="skeleton h-3 rounded-sm"
                style={{ width: `${55 + ((r * 7 + c * 13) % 35)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
