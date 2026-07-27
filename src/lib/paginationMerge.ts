/**
 * Depth-preserving refresh merge for cursor lists — docs/PAGINATION_STANDARD §6
 * ("Refresh must MERGE, not replace").
 *
 * A refresh refetches the FIRST window of a list that may already have several
 * "Load more" pages loaded. Assigning that window over the array silently
 * throws the user's progress away (load 500 media items, delete one, get 50
 * back). Instead: the refetched window is authoritative for the rows it covers,
 * and rows already held *past* it survive in their existing order.
 *
 * `InboxClient.fetchConversations(..., merge)` is the reference implementation;
 * it can compare rows against the window boundary because it knows the DB sort.
 * Generic lists don't, so the boundary here is positional: both arrays come
 * back in server order, so everything after the DEEPEST previously-held row
 * that reappeared in the window is "past the window". Rows the window covers
 * but no longer returns (deleted/moved) are dropped, which is the point.
 *
 * Only ever call this for a same-query refresh. When the query identity changed
 * (filter, search text, endpoint, campaign) the old rows answer a different
 * question and REPLACE is correct.
 */
export function mergeRefreshedWindow<T>(
  previous: readonly T[],
  refreshed: readonly T[],
  getId: (row: T) => string,
): { rows: T[]; tailLength: number } {
  // An empty window means the list is empty now — nothing to preserve.
  if (!refreshed.length) return { rows: [], tailLength: 0 };

  const refreshedIds = new Set(refreshed.map(getId));
  let lastCovered = -1;
  previous.forEach((row, index) => {
    if (refreshedIds.has(getId(row))) lastCovered = index;
  });
  // Everything after `lastCovered` is by construction absent from the window,
  // so this needs no further de-duplication.
  const tail = previous.slice(lastCovered + 1);
  return { rows: [...refreshed, ...tail], tailLength: tail.length };
}
