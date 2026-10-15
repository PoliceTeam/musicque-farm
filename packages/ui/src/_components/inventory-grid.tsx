'use client';
import { type InventoryItem, InventorySlot } from './inventory-slot.js';

export function InventoryGrid({
  items,
  selected,
  onSelect,
  slots = 12,
  id = 'ui-inventory-grid',
}: {
  items: InventoryItem[];
  selected?: string;
  onSelect: (id: string) => void;
  slots?: number;
  id?: string;
}) {
  const visible = items.filter((item) => Number.isSafeInteger(item.count) && item.count > 0);
  const count = Number.isSafeInteger(slots) && slots >= 0 ? slots : 12;
  return (
    <div id={id} className="ui-inventory-grid">
      {Array.from({ length: Math.max(count, visible.length) }, (_, index) => {
        const item = visible[index];
        return (
          <InventorySlot
            key={item?.id ?? `empty-${index}`}
            item={item}
            selected={item?.id === selected}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
