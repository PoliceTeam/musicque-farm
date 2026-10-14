import { useEffect, useRef, useState } from 'react';
import { mountArtReview } from '@/devtools/farm-art-review/art-review';
export const styles =
  'body{margin:32px;background:#e9e3cd;color:#4c4635;font:16px system-ui;overflow:auto}h1{font-size:22px}#states{display:flex;flex-wrap:wrap;gap:24px}#states article{width:145px;text-align:center;background:#89b733;border-radius:12px;padding:18px 8px}#states .crop-review{width:min(100%,850px);display:flex;align-items:flex-end;justify-content:center;gap:10px;flex-wrap:wrap}#states .crop-review strong{width:100%}#states .crop-review canvas{margin:8px 0}#states canvas{display:block;margin:12px auto;image-rendering:pixelated}';

export function Screen() {
  const root = useRef<HTMLElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const node = root.current!;
    void mountArtReview(node, () => disposed).catch(() => {
      if (!disposed) setError('Không tải được hình kiểm tra.');
    });
    return () => {
      disposed = true;
      node.replaceChildren();
    };
  }, []);
  return (
    <>
      <h1>Các giai đoạn cây trồng, đất và vật nuôi</h1>
      {error && <p role="alert">{error}</p>}
      <section id="states" ref={root} />
    </>
  );
}
