'use client';
import type { ReactNode } from 'react';
import { Button } from './button.js';
export type InventoryItem = { id: string; label: string; count: number; icon: ReactNode };

export function InventorySlot({
  item,
  selected = false,
  onSelect,
}: {
  item?: InventoryItem;
  selected?: boolean;
  onSelect: (id: string) => void;
}) {
  if (!item || !Number.isSafeInteger(item.count) || item.count <= 0)
    return <div className="ui-inventory-slot" aria-hidden="true" />;
  return (
    <Button
      className={`ui-inventory-slot${selected ? ' active' : ''}`}
      aria-label={`${item.label}: ${item.count}`}
      aria-pressed={selected}
      onClick={() => onSelect(item.id)}
    >
      {item.icon}
      <b>{item.count}</b>
    </Button>
  );
}
