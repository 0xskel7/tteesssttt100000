/**
 * Partial success helper: one bad item must not drop the whole collection.
 */
export interface PartialCollection<T> {
  items: T[];
  errors: Array<{ id?: string; message: string }>;
  degraded: boolean;
}

export function collectPartial<T>(
  results: Array<{ ok: true; value: T } | { ok: false; id?: string; message: string }>,
): PartialCollection<T> {
  const items: T[] = [];
  const errors: Array<{ id?: string; message: string }> = [];
  for (const r of results) {
    if (r.ok) items.push(r.value);
    else errors.push({ id: r.id, message: r.message });
  }
  return { items, errors, degraded: errors.length > 0 };
}
