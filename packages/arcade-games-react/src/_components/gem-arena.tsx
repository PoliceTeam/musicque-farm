import type { GemBattleSnapshot, GemFighter, GemStep } from '@chibi-town/arcade-games/gem-battle-logic';
import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import type { Outfit } from '@chibi-town/character-core/character-types';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GemReplay } from '../_utils/gem-replay.js';
import { roomNumber } from '../_utils/room-number.js';
import { ArcadeAvatar } from './arcade-avatar.js';
import { GemBoard } from './gem-board.js';
import { TurnCountdown } from './turn-countdown.js';

function Fighter({
  state,
  outfit,
  name,
  bot,
  step,
  timer,
}: {
  state: GemFighter;
  outfit: Outfit;
  name: string;
  bot: boolean;
  step?: GemStep;
  timer?: ReactNode;
}) {
  const { t } = useTranslation('common');
  const actor = bot ? 'bot' : 'player';
  const attacking = step?.actor === actor;
  const hurt = step && !attacking && step.damage > 0;
  return (
    <section
      className={`gem-fighter ${bot ? 'gem-fighter--bot' : ''} ${attacking ? 'is-attacking' : ''} ${hurt ? 'is-hurt' : ''}`}
      aria-label={name}
    >
      <strong className="fighter-name">{name}</strong>
      {timer}
      <div className="fighter-portrait">
        <ArcadeAvatar outfit={outfit} mirror={bot} label={name} />
        {hurt && (
          <span key={`${step.actor}-${step.combo}-${state.hp}`} className="fighter-damage">
            −{step.damage}
          </span>
        )}
        {attacking && step.healed > 0 && (
          <span key={state.hp} className="fighter-heal">
            +{step.healed}
          </span>
        )}
      </div>
      <div className="fighter-meter">
        <label>
          {t('arcadeHealth')} <b>{state.hp}/1000</b>
          <progress className="hp-meter" max={1000} value={state.hp} />
        </label>
      </div>
      <div className="fighter-meter">
        <label>
          {t('arcadeMana')} <b>{state.mana}/100</b>
          <progress className="mana-meter" max={100} value={state.mana} />
        </label>
      </div>
      <small>{t('arcadeShield', { count: state.shield })}</small>
    </section>
  );
}

export function GemArena({
  battle,
  outfit,
  name,
  busy,
  step,
  replay,
  selected,
  hinted,
  flashing,
  error,
  notice,
  onSelect,
  onSwap,
  actions,
}: {
  actions?: ReactNode;
  battle: GemBattleSnapshot;
  outfit: Outfit;
  name: string;
  busy: boolean;
  step?: GemStep;
  replay?: GemReplay;
  selected?: number;
  hinted: number[];
  flashing: number[];
  error: string;
  notice?: string;
  onSelect: (index: number) => void;
  onSwap: (from: number, to: number) => void;
}) {
  const { t } = useTranslation('common');
  return (
    <div className="gem-arena">
      <section className="gem-duel">
        <div className="gem-duel-heading">
          <span>
            {t(
              battle.session?.mode === 'practice'
                ? 'arcadePracticeFree'
                : battle.session?.mode === 'wager'
                  ? 'arcadeWagerGame'
                  : 'arcadeFreeBattle',
            )}
          </span>
          <h2>{t('arcadeGameNames.diamonds')}</h2>
          <p>
            {t('arcadeBattleStats', {
              room: roomNumber(battle.roomId),
              table: (battle.tableId ?? 0) + 1,
              moves: battle.moves,
              score: battle.score,
            })}
          </p>
        </div>
        <TurnCountdown match={battle} active={battle.turn === 0} prominent />
        <div className="gem-fighters">
          <Fighter
            state={battle.player}
            outfit={battle.players?.[0]?.outfit ?? outfit}
            name={name}
            bot={false}
            step={step}
            timer={<TurnCountdown match={battle} active={battle.turn === 0} />}
          />
          <span className="gem-versus" aria-hidden="true">
            VS
          </span>
          <Fighter
            state={battle.bot}
            timer={<TurnCountdown match={battle} active={battle.turn === 1} />}
            outfit={battle.players?.[1]?.outfit ?? defaultOutfit}
            name={tablePlayerName(battle.players?.[1]) ?? t('arcadeBotName')}
            bot={true}
            step={step}
          />
        </div>
        <div className={`gem-battle-message ${error ? 'is-error' : ''}`} role="status">
          {error ||
            (battle.status === 'won'
              ? t('arcadeWon')
              : battle.status === 'lost'
                ? t('arcadeLost')
                : busy
                  ? t((step ?? replay?.step)?.actor === 'bot' ? 'arcadeBotTurn' : 'arcadeResolving')
                  : battle.status === 'waiting'
                    ? t('arcadeTableWaiting')
                    : battle.turn === 1
                      ? t('tienTurnOf', { name: tablePlayerName(battle.players?.[1]) ?? t('arcadeBotName') })
                      : notice || t('arcadeYourTurn'))}
        </div>
        {step && (step.extraTurn || step.reshuffled || step.luckReward) && (
          <div className="gem-event-notes" role="status">
            {step.extraTurn && <span>{t(step.actor === 'bot' ? 'arcadeBotExtraTurn' : 'arcadeExtraTurn')}</span>}
            {step.reshuffled && <span>{t('arcadeReshuffled')}</span>}
            {step.luckReward && <span>{t('arcadeLuckReward', { reward: t(`arcadeGems.${step.luckReward}`) })}</span>}
          </div>
        )}
        <p className="gem-tip">{t('arcadeBoardTip')}</p>
      </section>
      <div className="gem-board-controls">
        <div className="gem-board-frame">
          <GemBoard
            board={battle.board}
            replay={replay}
            selected={selected}
            hinted={hinted}
            flashing={flashing}
            disabled={busy || battle.turn === 1 || battle.status !== 'playing'}
            onSelect={onSelect}
            onSwap={onSwap}
          />
        </div>
        {actions}
      </div>
    </div>
  );
}
