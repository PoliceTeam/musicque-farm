import { Button, FormField, InventoryGrid, Meter } from '@chibi-town/ui/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

it('shared React inventory hides missing stock and preserves empty slots', () => {
  const html = renderToStaticMarkup(
    createElement(InventoryGrid, {
      items: [{ id: 'zero', label: 'Dâu trống', count: 0, icon: '🍓' }],
      selected: 'zero',

      onSelect() {},
    }),
  );
  expect(html).not.toContain('Dâu trống');
  expect(html).not.toContain('🍓');
  expect(html).not.toContain(' active');
  expect(html.match(/aria-hidden="true"/g)).toHaveLength(12);
});
it('busy controls cannot submit again and meters handle unavailable values', () => {
  const button = renderToStaticMarkup(createElement(Button, { busy: true }, 'Mua'));
  expect(button).toContain('disabled');
  expect(button).toContain('aria-busy="true"');
  const meter = renderToStaticMarkup(createElement(Meter, { label: 'Thức ăn', value: Number.NaN }));
  expect(meter).not.toContain('NaN');
  expect(meter).toContain('value="0"');
});
it('shared fields preserve control IDs for accessible labels', () => {
  const html = renderToStaticMarkup(
    <FormField label="Vật nuôi">
      <select id="species" />
    </FormField>,
  );
  expect(html).toContain('for="species"');
  expect(html).toContain('id="species"');
});
