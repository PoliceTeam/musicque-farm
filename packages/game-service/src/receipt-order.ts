/** Persisted age on each receipt avoids JavaScript's special ordering of numeric keys. */
export function pruneReceipts(records: Record<string, unknown>, insertedKey?: string) {
  const entries = Object.entries(records) as [string, { receiptOrder?: number }][];
  let newest = Math.max(
    -1,
    ...entries.map(([, record]) => (Number.isSafeInteger(record.receiptOrder) ? record.receiptOrder! : -1)),
  );
  for (const [key, record] of entries) {
    if (key !== insertedKey && (!Number.isSafeInteger(record.receiptOrder) || record.receiptOrder! < 0))
      record.receiptOrder = ++newest;
  }
  if (insertedKey !== undefined) (records[insertedKey] as { receiptOrder?: number }).receiptOrder = ++newest;
  entries.sort((a, b) => a[1].receiptOrder! - b[1].receiptOrder!);
  const keep = entries.slice(-50);
  for (const [key] of entries.slice(0, -50)) delete records[key];
  // Compact the counter so it remains safe even in a long-lived save.
  keep.forEach(([, record], index) => {
    record.receiptOrder = index;
  });
}
