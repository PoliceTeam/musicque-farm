import type { createGameAudio } from '@chibi-town/game-audio';
import { Button, Dialog, InventoryGrid, Meter } from '@chibi-town/ui/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createGameUi } from '@/application/game-ui-handler';
import { inventoryCss } from '@/assets/generated-styles/inventory-css';
import { showcaseCss } from '@/assets/generated-styles/showcase-css';
import { AudioSettings } from '@/features/settings/_components/audio-settings';
export const styles = inventoryCss + showcaseCss;

export function Screen({ audio }: { audio: ReturnType<typeof createGameAudio> }) {
  const [open, setOpen] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const ui = useRef<ReturnType<typeof createGameUi>>(undefined);
  useEffect(() => {
    ui.current = createGameUi(document.body, audio);
    return () => ui.current?.destroy();
  }, [audio]);
  return (
    <main className="ui-showcase">
      <header>
        <h1>Chibi Town · UI dùng chung</h1>
        <Link href="/farm">Nông trại</Link> · <Link href="/">Bản đồ</Link> · <Link href="/character">Nhân vật</Link>
      </header>
      <section className="panel">
        <h2>Nút và trạng thái</h2>
        <div className="actions">
          <Button>Thông thường</Button>
          <Button variant="primary">Thực hiện</Button>
          <Button aria-pressed>Đang chọn</Button>
          <Button disabled>Chưa mở</Button>
          <Button
            busy={busy}
            onClick={() => {
              setBusy(true);
              void ui.current
                ?.confirm({ title: 'Thao tác mẫu', description: 'Kiểm tra xác nhận và trạng thái đang xử lý.' })
                .finally(() => setBusy(false));
            }}
          >
            Thử đang xử lý
          </Button>
          <Button onClick={() => setOpen(true)}>Mở cửa sổ</Button>
        </div>
      </section>
      <section className="panel">
        <h2>Kho vật phẩm</h2>
        <Button onClick={() => setEmpty(!empty)}>{empty ? 'Hiện vật phẩm' : 'Kho trống'}</Button>
        <InventoryGrid
          items={empty ? [] : [{ id: 'sample', label: 'Dâu', count: 12, icon: '🍓' }]}
          onSelect={() => {}}
        />
        <p>{empty ? 'Kho đang trống' : 'Dâu · Số lượng: 12'}</p>
      </section>
      <section className="panel">
        <Meter label="Thức ăn" value={60} />
        <div className="actions">
          <Button onClick={() => ui.current?.notify('Đã hoàn tất.', 'success')}>Thành công</Button>
          <Button onClick={() => ui.current?.notify('Không đủ xu.', 'error')}>Không đủ xu</Button>
        </div>
        <AudioSettings audio={audio} />
      </section>
      {open && (
        <Dialog title="Cửa sổ dùng chung" onClose={() => setOpen(false)} closeLabel="Đóng">
          <p>Dùng Tab để chọn nút; Escape để đóng.</p>
          <Button onClick={() => setOpen(false)}>Đồng ý</Button>
        </Dialog>
      )}
    </main>
  );
}
