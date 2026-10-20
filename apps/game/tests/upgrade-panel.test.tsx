import { createGameSdk, createLocalDocument, createMemoryRepository } from '@chibi-town/api-sdk';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { expect, it, vi } from 'vitest';
import { createGameI18n } from '@/application/i18n/instance';
import {
  CharacterUpgradeAction,
  CharacterUpgradePanel,
} from '@/features/character/_components/character-upgrade-panel';

vi.mock('@/features/character/_components/character-preview', () => ({
  CharacterPreview: ({ label }: { label: string }) => <div data-preview={label} />,
}));
vi.mock('@/features/character/_components/cosmetic-thumbnail', () => ({ CosmeticThumbnail: () => <span /> }));

async function page() {
  const doc = createLocalDocument();
  doc.farm.coins = 1_000_000;
  doc.farm.gems = 100;
  const sdk = createGameSdk({
    adapter: 'local',
    repository: createMemoryRepository(doc),

    random: () => 0,
  });
  await sdk.execute({ type: 'buy-cosmetic', offerId: 'item/hat.cap.1', requestId: 'buy', mapInstanceId: 'home' });
  return sdk.getCharacterInventory({ view: 'upgrades' });
}

function render(content: React.ReactNode) {
  return renderToStaticMarkup(<I18nextProvider i18n={createGameI18n()}>{content}</I18nextProvider>);
}

it('shows materials and two preview frames without the removed notes', async () => {
  const data = await page();
  const coins = render(<CharacterUpgradePanel page={data} pending={false} onSelect={() => {}} layout="sidebar" />);
  expect(coins).not.toContain('Thành công 85%');
  expect(coins).not.toContain('Mỗi lượt đều tiêu');
  expect(coins).not.toContain('Giữ các cấp cũ');
  expect(coins).not.toContain('Cấp mới được trang bị ngay');
  expect(coins).toContain('Đá lam');
  expect(coins).toContain('0 / 1');
  expect(coins).toContain('is-missing');
  expect(coins).not.toContain('Không có bảo hiểm');
  const gems = render(<CharacterUpgradePanel page={data} pending={false} onSelect={() => {}} currency="gems" />);
  expect(gems).not.toContain('Thành công 95%');
  expect(gems).not.toContain('lượng khả dụng');
  expect(gems).not.toContain('character-upgrade-heading');
  expect(gems).not.toContain('character-upgrade-intro');
  expect(gems).toContain('Cấp 3');
  expect(gems.match(/data-preview=/g)).toHaveLength(2);
  expect(gems).toContain('data-preview="Mũ lưỡi trai Lv.1"');
  expect(gems).toContain('data-preview="Mũ lưỡi trai Lv.2"');
  expect(gems).not.toContain('data-preview="Mũ lưỡi trai Lv.3"');
  expect(gems.match(/class="character-upgrade-levels"/g)).toHaveLength(1);
  const action = render(<CharacterUpgradeAction page={data} pending={false} onUpgrade={() => {}} />);
  expect(action).toContain('disabled');
  expect(action).toContain('Chưa đủ nguyên liệu bắt buộc');
});

it('keeps insurance and chance notes hidden on protected attempts too', async () => {
  const data = await page();
  data.rows[0].upgrade!.guaranteeAt = 5;
  data.rows[0].upgrade!.failures = 4;
  const html = render(<CharacterUpgradePanel page={data} pending={false} onSelect={() => {}} currency="gems" />);
  expect(html).not.toContain('Lượt này chắc chắn thành công');
  expect(html).not.toContain('Đã trượt 4 lần');
  expect(html).not.toContain('Thành công 95%');
});
