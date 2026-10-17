import { type ArcadeSession, arcadeAllReady, arcadeMembers } from '@chibi-town/arcade-games/session';
import { topTwoPayout } from '@chibi-town/arcade-games/table-payout';
import type { TableSnapshot } from '@chibi-town/arcade-games/table-snapshot';
import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import type { ArcadeMemberCommand, ArcadeTableSettings } from '@chibi-town/contracts/arcade-table';
import { Button, FormField, Select } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArcadeHost } from '../host.js';
import { ArcadeActions } from './arcade-actions.js';
import { ArcadeAvatar } from './arcade-avatar.js';
import { TurnCountdown } from './turn-countdown.js';
export type TableInfo = {
  id: string;
  revision: number;
  status: string;
  choice?: number;
  serverTime?: number;
  turnEndsAt?: number;
  session?: ArcadeSession;
};

function TableSettingsContent({
  gameId,
  match,
  playerId,
  name,
  coins,
  changed,
  onStart,
  locked = false,
  choice,
  players,
}: {
  gameId: import('@chibi-town/contracts/arcade-table').ArcadeTableCommand['gameId'];
  match: TableInfo;
  playerId: string;
  name: string;
  coins: number;
  changed: () => Promise<void>;
  onStart?: () => Promise<void>;
  locked?: boolean;
  choice?: number;
  /** People at the table. When given, members are real players: no bot bets, no bot invitations. */
  players?: TableSnapshot<never>['players'];
}) {
  const { t } = useTranslation('common');
  const { sdk } = useArcadeHost();
  const [stake, setStake] = useState(
    match.session?.members?.find((m) => m.id === playerId)?.stake || match.session?.stake || Math.min(100, coins),
  );
  const [difficulty, setDifficulty] = useState(match.session?.difficulty ?? 'medium');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(match.session?.playerCount ?? 4);
  const [botBets, setBotBets] = useState<Record<string, { stake: number; choice: number }>>({});
  const chance = gameId === 'bau-cua' || gameId === 'slots';
  const [dirty, setDirty] = useState(!match.session?.configured);
  const memberRequest = useRef<ArcadeMemberCommand | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<ArcadeTableSettings | undefined>(undefined);
  useEffect(() => {
    request.current = undefined;
    if (choice !== undefined && choice !== match.choice) setDirty(true);
  }, [choice, match.choice]);
  const session = match.session;
  const practice = session?.mode === 'practice';
  if (!session)
    return (
      <section className="arcade-table-settings arcade-legacy-notice">
        <p>
          <strong>{t('arcadeLegacySaved')}</strong>
          <span>{t('arcadeLegacyFree')}</span>
        </p>
        <p>{t('arcadeLegacyTableInfo')}</p>
      </section>
    );
  const isHost = session.hostId === playerId;
  const live = !!players;

  const memberName = (id: string, index: number) =>
    tablePlayerName(players?.find((entry) => entry.id === id)) ??
    (index === 0 ? name : t('arcadeLocalBot', { number: index }));

  async function save() {
    if (busy || locked) return;
    setBusy(true);
    setError('');
    request.current ??= {
      gameId,
      matchId: match.id,
      revision: match.revision,
      requestId: crypto.randomUUID(),
      stake: practice ? 0 : stake,
      ...(chance && !live
        ? {
            bets: arcadeMembers(session!)
              .filter((m) => m.id !== playerId)
              .map((m, index) => ({
                memberId: m.id,
                stake: practice ? 0 : (botBets[m.id]?.stake ?? (m.stake || stake)),
                choice: botBets[m.id]?.choice ?? m.choice ?? (index + 1) % 6,
              })),
          }
        : {}),
      ...(gameId === 'bau-cua' && choice !== undefined ? { choice } : {}),
      difficulty: practice ? difficulty : session!.difficulty,
      ...(practice && ['tien-len', 'phom'].includes(gameId) ? { playerCount } : {}),
    };
    try {
      await sdk.configureArcadeTable(request.current);
      request.current = undefined;
      await changed();
      setDirty(false);
      return true;
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : '';
      if (code === 'REQUEST_CONFLICT') {
        request.current = undefined;
        await changed();
      } else {
        setError(t(code === 'INSUFFICIENT_COINS' ? 'arcadeNoCoins' : 'arcadeSettingsFailed'));
        if (code === 'INSUFFICIENT_COINS') request.current = undefined;
      }
    } finally {
      setBusy(false);
    }
  }

  async function member(action: ArcadeMemberCommand['action']) {
    if (busy || locked) return;
    setBusy(true);
    setError('');
    memberRequest.current ??= {
      gameId,
      matchId: match.id,
      revision: match.revision,
      requestId: crypto.randomUUID(),
      action,
    };
    try {
      const updated = await sdk.updateArcadeMember(memberRequest.current);
      if (updated.session?.playerCount) setPlayerCount(updated.session.playerCount);
      memberRequest.current = undefined;
      await changed();
    } catch {
      setError(t('arcadeSettingsFailed'));
    } finally {
      setBusy(false);
    }
  }

  const members = arcadeMembers(session);
  if (practice && match.status !== 'waiting') return null;
  if (practice)
    return (
      <section className="arcade-table-settings arcade-practice-settings">
        <div className="arcade-settings-fields">
          {['tien-len', 'phom'].includes(gameId) && (
            <Select
              label={t('tienPlayerCount')}
              value={playerCount}
              disabled={busy || locked}
              items={([2, 3, 4] as const).map((count) => ({ value: count, label: t('tienPlayers', { count }) }))}
              onChange={(count) => {
                setPlayerCount(count);
                setDirty(true);
                request.current = undefined;
              }}
            />
          )}
          {!chance && (
            <Select
              label={t('arcadeDifficulty')}
              value={difficulty}
              disabled={busy || locked}
              items={(['easy', 'medium', 'hard'] as const).map((value) => ({
                value,
                label: t(`arcadeDifficulties.${value}`),
              }))}
              onChange={(value) => {
                setDifficulty(value);
                setDirty(true);
                request.current = undefined;
              }}
            />
          )}
          {onStart && (
            <ArcadeActions>
              <Button
                variant="primary"
                disabled={busy || locked}
                onClick={() => {
                  void (async () => {
                    if (await save()) await onStart();
                  })();
                }}
              >
                {t(gameId === 'bau-cua' ? 'miniRoll' : gameId === 'slots' ? 'miniSpin' : 'tienStart')}
              </Button>
            </ArcadeActions>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return (
    <section className="arcade-table-settings">
      <p>
        <strong className={isHost ? 'is-self' : undefined}>
          {t('arcadeHost', { name: memberName(session.hostId, 0) })}
        </strong>
        <span>
          {t(practice ? 'arcadePracticeFree' : 'arcadeStakeAmount', {
            stake: live && chance ? (members.find((m) => m.id === playerId)?.stake ?? session.stake) : session.stake,
          })}
        </span>
      </p>
      {session.payoutRule && !practice && session.stake > 0 && (
        <p className="arcade-payout-preview">
          {t('arcadeTopTwoPayout', {
            pool: session.stake * (session.playerCount ?? 4),
            first: topTwoPayout(session.stake, 0, 1, session.playerCount ?? 4)[0] + session.stake,
            second: topTwoPayout(session.stake, 0, 1, session.playerCount ?? 4)[1] + session.stake,
          })}
        </p>
      )}
      {session.settled && (
        <p role="status">
          {t(
            session.coinDelta! > 0
              ? 'arcadeCoinsWon'
              : session.coinDelta! < 0
                ? 'arcadeCoinsLost'
                : 'arcadePracticeFinished',
            { count: Math.abs(session.coinDelta ?? 0) },
          )}
        </p>
      )}
      {match.status === 'waiting' && (isHost || (live && chance)) && session.mode !== 'casual' && (
        <>
          <div className="arcade-settings-fields">
            {practice && ['tien-len', 'phom'].includes(gameId) && (
              <Select
                label={t('tienPlayerCount')}
                value={playerCount}
                disabled={busy || locked}
                items={([2, 3, 4] as const).map((count) => ({ value: count, label: t('tienPlayers', { count }) }))}
                onChange={(count) => {
                  setDirty(true);
                  setPlayerCount(count);
                  request.current = undefined;
                }}
              />
            )}
            {!practice && (
              <FormField label={t('arcadeStakeLabel')}>
                <input
                  type="number"
                  min={1}
                  max={coins}
                  step={1}
                  value={stake}
                  disabled={busy || locked}
                  onChange={(e) => {
                    setDirty(true);
                    setStake(Number(e.target.value));
                    request.current = undefined;
                  }}
                />
              </FormField>
            )}
            {practice && !['bau-cua', 'slots'].includes(gameId) && (
              <Select
                label={t('arcadeDifficulty')}
                value={difficulty}
                disabled={busy || locked}
                items={(['easy', 'medium', 'hard'] as const).map((value) => ({
                  value,
                  label: t(`arcadeDifficulties.${value}`),
                }))}
                onChange={(value) => {
                  setDirty(true);
                  setDifficulty(value);
                  request.current = undefined;
                }}
              />
            )}
            <ArcadeActions>
              <Button
                variant="primary"
                disabled={busy || locked || (!practice && (!Number.isSafeInteger(stake) || stake < 1 || stake > coins))}
                onClick={() => void save()}
              >
                {t(isHost ? 'arcadeSaveSettings' : 'arcadeSetReady')}
              </Button>
            </ArcadeActions>
            {onStart && isHost && (
              <ArcadeActions>
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    locked ||
                    dirty ||
                    !(live && chance
                      ? members.length > 0 && members.every((m) => m.id === session.hostId || m.ready)
                      : arcadeAllReady(session))
                  }
                  onClick={() => void onStart()}
                >
                  {t(gameId === 'bau-cua' ? 'miniRoll' : gameId === 'slots' ? 'miniSpin' : 'tienStart')}
                </Button>
              </ArcadeActions>
            )}
          </div>
          <ul className="arcade-members">
            {members.map((m, index) => (
              <li key={m.id} data-self={m.id === playerId}>
                {chance && players?.find((entry) => entry.id === m.id)?.outfit && (
                  <ArcadeAvatar
                    outfit={players.find((entry) => entry.id === m.id)!.outfit!}
                    label={memberName(m.id, index)}
                  />
                )}
                <span>{memberName(m.id, index)}</span>
                {chance && (
                  <TurnCountdown match={match} active={m.id === session.hostId} prominent={m.id === playerId} />
                )}
                <strong>
                  {t(m.id === session.hostId ? 'arcadeHostBadge' : m.ready ? 'tienReady' : 'arcadeNotReady')}
                </strong>
                {chance && !live && index !== 0 && (
                  <div className="arcade-member-bet">
                    {!practice && (
                      <FormField label={t('arcadeMemberStake', { number: index })}>
                        <input
                          type="number"
                          min={1}
                          max={m.coins ?? 10000}
                          step={1}
                          disabled={busy || locked}
                          value={botBets[m.id]?.stake ?? (m.stake || stake)}
                          onChange={(event) => {
                            setDirty(true);
                            request.current = undefined;
                            setBotBets((current) => ({
                              ...current,
                              [m.id]: {
                                stake: Number(event.target.value),
                                choice: current[m.id]?.choice ?? m.choice ?? index % 6,
                              },
                            }));
                          }}
                        />
                      </FormField>
                    )}
                    {gameId === 'bau-cua' && (
                      <Select
                        label={t('arcadeMemberChoice', { number: index })}
                        value={botBets[m.id]?.choice ?? m.choice ?? index % 6}
                        disabled={busy || locked}
                        items={([0, 1, 2, 3, 4, 5] as const).map((value) => ({
                          value,
                          label: t(`miniSymbols.animals.s${value}`),
                        }))}
                        onChange={(value) => {
                          setDirty(true);
                          request.current = undefined;
                          setBotBets((current) => ({
                            ...current,
                            [m.id]: { stake: current[m.id]?.stake ?? (m.stake || stake), choice: value },
                          }));
                        }}
                      />
                    )}
                  </div>
                )}
                {index !== 0 && !live && (
                  <Button
                    disabled={busy || locked}
                    aria-label={t('arcadeBotReadyToggle', {
                      number: index,
                      state: t(m.ready ? 'arcadeCancelReady' : 'arcadeSetReady'),
                    })}
                    onClick={() => void member({ type: 'ready', memberId: m.id, ready: !m.ready })}
                  >
                    {t(m.ready ? 'arcadeCancelReady' : 'arcadeSetReady')}
                  </Button>
                )}
                {index !== 0 && isHost && (
                  <Button disabled={busy || locked} onClick={() => void member({ type: 'kick', memberId: m.id })}>
                    {t('arcadeKick')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!live && members.length < (['tien-len', 'phom', 'bau-cua', 'slots'].includes(gameId) ? 4 : 2) && (
            <Button disabled={busy || locked} onClick={() => void member({ type: 'invite-bot' })}>
              {t('arcadeInviteBot')}
            </Button>
          )}
          {!isHost &&
            ((!live && members[0]?.ready && !dirty) ||
              (live && chance && members.find((m) => m.id === playerId)?.ready)) && (
              <ArcadeActions>
                <Button disabled={busy || locked} onClick={() => void member({ type: 'ready', ready: false })}>
                  {t('arcadeCancelReady')}
                </Button>
              </ArcadeActions>
            )}
          {members.length < 2 && !(live && chance) && <p role="status">{t('arcadeNeedMembers')}</p>}
        </>
      )}
      {live && match.status === 'waiting' && !isHost && !chance && (
        <>
          <ul className="arcade-members">
            {members.map((m, index) => (
              <li key={m.id} data-self={m.id === playerId}>
                {chance && players?.find((entry) => entry.id === m.id)?.outfit && (
                  <ArcadeAvatar
                    outfit={players.find((entry) => entry.id === m.id)!.outfit!}
                    label={memberName(m.id, index)}
                  />
                )}
                <span>{memberName(m.id, index)}</span>
                {chance && (
                  <TurnCountdown match={match} active={m.id === session.hostId} prominent={m.id === playerId} />
                )}
                <strong>
                  {t(m.id === session.hostId ? 'arcadeHostBadge' : m.ready ? 'tienReady' : 'arcadeNotReady')}
                </strong>
              </li>
            ))}
          </ul>
          {session.configured ? (
            <ArcadeActions>
              <Button
                variant={members.find((m) => m.id === playerId)?.ready ? 'default' : 'primary'}
                disabled={busy || locked || session.stake > coins}
                onClick={() => void member({ type: 'ready', ready: !members.find((m) => m.id === playerId)?.ready })}
              >
                {members.find((m) => m.id === playerId)?.ready
                  ? t('arcadeCancelReady')
                  : t('arcadeConfirmStake', { stake: session.stake })}
              </Button>
            </ArcadeActions>
          ) : (
            <p role="status">{t('arcadeHostChoosing')}</p>
          )}
          {session.stake > coins && <p role="status">{t('arcadeNoCoins')}</p>}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

/** Render from the current snapshot so starting and restoring a round use the same layout. */
export function TableSettings(props: Parameters<typeof TableSettingsContent>[0]) {
  if (props.match.session?.mode === 'practice' && props.match.status !== 'waiting') return null;
  return (
    <div className="arcade-settings-slot">
      <div>
        <TableSettingsContent {...props} />
      </div>
    </div>
  );
}
