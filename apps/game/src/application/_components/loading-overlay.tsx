import { publicPath } from '@/application/_utils/public-path';
import './loading-overlay.css';

export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="game-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <img
        className="game-loading-logo"
        src={publicPath('/branding/ice-city.webp')}
        alt="ICE City"
        width={480}
        height={240}
      />
      <div className="game-loading-mascot" aria-hidden="true">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet={publicPath('/branding/loading-cat-still.webp')} />
          <img src={publicPath('/branding/loading-cat.webp')} width={102} height={102} alt="" />
        </picture>
        <span className="game-loading-track" />
      </div>
      <span className="game-loading-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <p>{label}</p>
    </div>
  );
}
