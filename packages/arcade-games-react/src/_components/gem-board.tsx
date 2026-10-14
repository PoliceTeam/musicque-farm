import { adjacentGems, type Gem } from '@chibi-town/arcade-games/gem-battle-logic';
import { type CSSProperties, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type GemReplay, gemFallRows, largestGemMatch } from '../_utils/gem-replay.js';
import { GemImage } from './gem-image.js';

const CELLS = Array.from({ length: 64 }, (_, index) => ({ id: `cell-${index}`, index }));

export function GemBoard({
  board,
  replay,
  selected,
  hinted = [],
  flashing = [],
  disabled,
  onSelect,
  onSwap,
}: {
  board: readonly Gem[];
  replay?: GemReplay;
  selected?: number;
  hinted?: number[];
  flashing?: number[];
  disabled: boolean;
  onSelect: (index: number) => void;
  onSwap: (from: number, to: number) => void;
}) {
  const { t } = useTranslation('common');
  const drag = useRef<number | undefined>(undefined);
  const dragged = useRef(false);
  const falling = replay?.phase === 'fall' && !replay.step.reshuffled && replay.step.cleared.length > 0;
  const distances = falling ? gemFallRows(replay.step.cleared) : [];
  const large = replay ? largestGemMatch(replay.step) : 0;
  const celebrate =
    replay && replay.phase !== 'prepare' && (replay.step.combo > 1 || large >= 4 || replay.step.extraTurn);
  return (
    <div className={`gem-board-stage ${celebrate ? 'is-celebrating' : ''}`}>
      <fieldset className={`diamond-grid ${falling ? 'is-falling' : ''}`} aria-label={t('arcadeBoard')}>
        {CELLS.map(({ id, index }) => {
          const gem = board[index];
          return (
            <button
              key={id}
              type="button"
              className={`diamond-cell ${selected === index ? 'is-selected' : ''} ${hinted.includes(index) ? 'is-hinted' : ''} ${flashing.includes(index) ? 'is-clearing' : ''} ${falling && distances[index] ? 'is-dropping' : ''}`}
              style={{ '--gem-fall-rows': distances[index] ?? 0 } as CSSProperties}
              data-index={index}
              data-gem={gem}
              data-hinted={hinted.includes(index)}
              aria-pressed={selected === index}
              aria-label={t('arcadeGemCell', {
                row: 1 + Math.floor(index / 8),
                column: 1 + (index % 8),
                name: t(`arcadeGems.${gem}`),
              })}
              disabled={disabled}
              onPointerDown={() => {
                drag.current = index;
                dragged.current = false;
              }}
              onPointerUp={() => {
                if (
                  drag.current !== undefined &&
                  drag.current !== index &&
                  adjacentGems(drag.current, index) &&
                  !disabled
                ) {
                  dragged.current = true;
                  onSwap(drag.current, index);
                }
                drag.current = undefined;
              }}
              onClick={() => {
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                onSelect(index);
              }}
            >
              <GemImage key={falling && distances[index] ? `${replay.id}-${index}` : gem} gem={gem} />
              {flashing.includes(index) && (
                <span className="gem-burst" aria-hidden="true">
                  ✦
                </span>
              )}
            </button>
          );
        })}
      </fieldset>
      {celebrate && (
        <div
          key={replay.id}
          className={`gem-celebration ${replay.step.extraTurn ? 'has-extra-turn' : ''}`}
          role="status"
        >
          <div className="gem-celebration-rays" aria-hidden="true" />
          <strong>
            {replay.step.combo > 1
              ? t('arcadeComboBurst', { count: replay.step.combo })
              : t('arcadeMatchBurst', { count: large })}
          </strong>
          <span>
            {replay.step.extraTurn
              ? t(replay.step.actor === 'bot' ? 'arcadeBotExtraTurn' : 'arcadeExtraTurn')
              : t(replay.step.actor === 'bot' ? 'arcadeBotCombo' : 'arcadePlayerCombo')}
          </span>
          <div className="gem-celebration-stars" aria-hidden="true">
            ✦ ✧ ✦ ✧ ✦
          </div>
        </div>
      )}
    </div>
  );
}
