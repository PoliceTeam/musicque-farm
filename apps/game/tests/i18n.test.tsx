import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import { InventoryDialog } from '@/features/inventory/_components/inventory-dialog';

describe('game locale', () => {
  it('initializes synchronously with typed Vietnamese namespaces and interpolation', () => {
    const i18n = createGameI18n();
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t('inventory:detail', { name: 'Sữa', count: 3 })).toBe('Sữa · Số lượng: 3');
    expect(i18n.t('farm:landCount', { owned: 7, max: 64 })).toBe('7 / 64 ô');
  });
  it('isolates instances and falls back to Vietnamese for missing translations', async () => {
    const first = createGameI18n();
    const second = createGameI18n();
    first.addResource('vi', 'common', 'confirm', 'Confirm');
    expect(first.t('confirm')).toBe('Confirm');
    expect(first.t('retry')).toBe('Thử lại');
    expect(second.t('confirm')).toBe('Xác nhận');
    await second.changeLanguage('unsupported');
    expect(second.t('confirm')).toBe('Xác nhận');
  });
  it('renders the empty warehouse through the locale provider without product labels', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={createGameI18n()}>
        <InventoryDialog pending={false} execute={async () => {}} onClose={() => {}} />
      </I18nextProvider>,
    );
    expect(html).toContain('Nhà kho');
    expect(html).toContain('Chưa có sản phẩm trong kho');
    expect(html).not.toContain('Mua 1 hạt giống');
    expect(html).not.toContain('Dâu thu hoạch');
  });
});
