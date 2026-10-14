import { inventorySlotsMarkup, statusMeterMarkup } from '@chibi-town/ui';
import { describe, expect, it } from 'vitest';

describe('shared inventory slots', () => {
  it('never displays absent stock and keeps the grid when empty', () => {
    const empty = inventorySlotsMarkup([{ label: 'Dâu', icon: '🍓', count: 0 }]);
    expect(empty.match(/class="stock-slot"/g)).toHaveLength(12);
    expect(empty).not.toContain('Dâu');
    expect(empty).not.toContain('🍓');
    expect(empty).not.toContain('active');
    expect(inventorySlotsMarkup([{ label: 'bad', icon: 'x', count: -1 }])).not.toContain('bad');
  });
  it('escapes image paths and suppresses images when count is zero', () => {
    expect(inventorySlotsMarkup([{ label: 'Dâu', imageUrl: '/crop.png', count: 0 }])).not.toContain('<img');
    expect(inventorySlotsMarkup([{ label: 'Dâu', imageUrl: '/crop.png" onerror="x', count: 1 }])).toContain(
      'src="/crop.png&quot; onerror=&quot;x"',
    );
  });
  it('escapes labels and icons while showing only positive item quantities', () => {
    const html = inventorySlotsMarkup([{ label: 'Dâu "A"', icon: '<script>', count: 2 }]);
    expect(html).toContain('Dâu &quot;A&quot;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<b>2</b>');
  });
});

describe('shared status meters', () => {
  it('clamps finite values and escapes labels without invalid progress', () => {
    expect(statusMeterMarkup('Thức ăn', -20)).toContain('value="0"');
    expect(statusMeterMarkup('Thức ăn', 200)).toContain('value="100"');
    expect(statusMeterMarkup('Tăng trưởng', Number.NaN, 'Chưa bắt đầu')).toContain('value="0"');
    expect(statusMeterMarkup('<test>', 25, '<5s')).toContain('&lt;5s');
  });
});
