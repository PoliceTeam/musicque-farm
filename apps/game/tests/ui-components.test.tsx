import { Button, Dialog, FormField, InventoryGrid, Meter } from '@chibi-town/ui/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

it('can omit a redundant visible dialog title while retaining its accessible name and close action', () => {
  const props = {
    title: 'Nhân vật',

    onClose() {},

    children: 'Hồ sơ',
  };
  const compact = renderToStaticMarkup(<Dialog {...props} hideTitle />);
  expect(compact).not.toContain('<h2>');
  expect(compact).toContain('aria-label="Nhân vật"');
  expect(compact).toContain('aria-label="Đóng nhân vật"');
  expect(renderToStaticMarkup(<Dialog {...props} />)).toContain('<h2>Nhân vật</h2>');
});

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
