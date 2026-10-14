import { Button } from '@chibi-town/ui/react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { chanceSymbol } from './chance-symbol.js';

const faces = [0, 1, 2, 3, 4, 5] as const;
const reelRows = Array.from({ length: 30 }, (_, row) => row);
const rotations = [
  [0, 0],
  [0, 180],
  [0, -90],
  [0, 90],
  [-90, 0],
  [90, 0],
];

export function ChanceTable({
  gameId,
  roll,
  busy,
  choice,
  choose,
  disabled,
  finished,
  actions,
  play,
}: {
  gameId: 'bau-cua' | 'slots';
  roll?: number[];
  busy: boolean;
  choice: number;
  choose: (index: number) => void;
  disabled: boolean;
  finished: boolean;
  actions?: ReactNode;
  play: () => void;
}) {
  const { t } = useTranslation('common');
  const bau = gameId === 'bau-cua';
  return (
    <div className={`chance-table ${bau ? 'bau-table' : 'slot-machine'}`}>
      {!bau && (
        <div className="slot-marquee" aria-hidden="true">
          ★ XÈNG ★
        </div>
      )}
      <fieldset className={bau ? 'bau-dice-tray' : 'slot-window'} aria-label={t('miniRollResult')}>
        {[0, 1, 2].map((column) => {
          const value = roll?.[column] ?? column;
          return (
            <div
              key={column}
              className={bau ? 'bau-die-space' : 'slot-reel-window'}
              role="img"
              aria-label={
                busy
                  ? t(bau ? 'miniDiceRolling' : 'miniReelsSpinning')
                  : roll
                    ? t(`miniSymbols.${bau ? 'animals' : 'slots'}.s${value as 0 | 1 | 2 | 3 | 4 | 5}`)
                    : t('miniPending')
              }
            >
              {bau ? (
                <div
                  className={`bau-die ${busy ? 'is-rolling' : ''}`}
                  style={
                    {
                      '--die-x': `${rotations[value][0]}deg`,
                      '--die-y': `${rotations[value][1]}deg`,
                      '--die-delay': `${column * 100}ms`,
                    } as CSSProperties
                  }
                >
                  {faces.map((face) => (
                    <span key={face} className={`bau-die-face bau-die-face--${face}`} aria-hidden="true">
                      {chanceSymbol(gameId, face)}
                    </span>
                  ))}
                </div>
              ) : (
                <div
                  className={`slot-strip ${busy ? (roll ? 'is-stopping' : 'is-running') : ''}`}
                  style={
                    { '--reel-end': -(18 + value), '--reel-duration': `${1400 + column * 300}ms` } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  {reelRows.map((row) => (
                    <span className="slot-symbol" key={`row-${row}`}>
                      {chanceSymbol(gameId, row % 6)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!bau && <div className="slot-payline" aria-hidden="true" />}
      </fieldset>
      {bau && (
        <div className="bau-betting-mat">
          {faces.map((index) => (
            <Button
              key={index}
              disabled={disabled}
              className={`bau-bet ${choice === index ? 'is-selected' : ''} ${roll?.includes(index) && !busy ? 'is-hit' : ''}`}
              aria-pressed={choice === index}
              onClick={() => choose(index)}
            >
              <span className="bau-bet-symbol" aria-hidden="true">
                {chanceSymbol(gameId, index)}
              </span>
              <span>{t(`miniSymbols.animals.s${index}`)}</span>
              {choice === index && (
                <i className="bau-chip" aria-hidden="true">
                  ●
                </i>
              )}
            </Button>
          ))}
        </div>
      )}
      <div className="chance-controls">
        {!actions && !finished && (
          <Button variant="primary" disabled={disabled} onClick={play}>
            {t(busy ? (bau ? 'miniDiceRolling' : 'miniReelsSpinning') : bau ? 'miniRoll' : 'miniSpin')}
          </Button>
        )}
        {actions}
      </div>
      <p className="mini-payout-help">{t(bau ? 'miniBauPayout' : 'miniSlotsPayout')}</p>
    </div>
  );
}
