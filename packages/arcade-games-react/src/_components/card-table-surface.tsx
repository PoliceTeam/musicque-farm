import { useArcadeHost } from '../host.js';

/** The host supplies artwork; the game package owns only the table presentation. */
export function CardTableSurface() {
  const { assets } = useArcadeHost();
  return (
    <div className={`tien-table-surface${assets['card-table'] ? ' has-artwork' : ''}`} aria-hidden="true">
      {assets['card-table'] && <img className="card-table-art" src={assets['card-table']} alt="" draggable={false} />}
    </div>
  );
}
