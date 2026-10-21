import { COSMETIC_CATALOG } from '@chibi-town/character-core/cosmetic-catalog';
import { ApiSdkError } from '@chibi-town/contracts';
import type { LuckyDrawCommand, LuckyDrawResult, LuckyDrawSnapshot } from '@chibi-town/contracts/lucky-draw';
import { LUCKY_DRAW_ID, LUCKY_PRIZES, LUCKY_TICKET_PRICE } from '@chibi-town/game-content/lucky-draw';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppImage } from '@/application/_components/app-image';
import { getApiSdk } from '@/application/api-sdk';
import { publicAssetUrls } from '@/assets/generated-assets';
import { luckyDrawCss } from '@/assets/generated-styles/lucky-draw-css';
import { CharacterPreview } from '@/features/character/_components/character-preview';
import { nextWheelRotation } from '@/features/lucky-draw/_utils/wheel-logic';
import { previewCosmetic } from '@/features/shop/_utils/preview-outfit';

const asset = (name: string) => publicAssetUrls[`lucky-draw/${name}.webp`];

const wings = COSMETIC_CATALOG['item/wings.pixie'];
type Prize = (typeof LUCKY_PRIZES)[number];

export function LuckyDrawDialog({ onClose, onChanged }: { onClose(): void; onChanged(data: LuckyDrawSnapshot): void }) {
  const { t } = useTranslation('luckyDraw');
  const [data, setData] = useState<LuckyDrawSnapshot>();
  const [tab, setTab] = useState<'prizes' | 'rates' | 'history'>('prizes');
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<LuckyDrawResult>();
  const [auto, setAuto] = useState(false);
  const alive = useRef(true);
  const locked = useRef(false);
  const pending = useRef<LuckyDrawCommand | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoEnabled = useRef(false);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  const label = (prize: Prize) =>
    prize.kind === 'cosmetic'
      ? t('wings')
      : t(prize.kind === 'coins' ? 'coins' : 'prizeTickets', { count: prize.amount });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload explicitly retries loading after a transport failure.
  useEffect(() => {
    alive.current = true;
    setError('');
    void getApiSdk()
      .getLuckyDraw()
      .then((value) => {
        if (alive.current) {
          setData(value);
          changed.current(value);
        }
      })
      .catch(() => {
        if (alive.current) setError(t('loadFailed'));
      });
    return () => {
      alive.current = false;
      autoEnabled.current = false;
      clearTimeout(timer.current);
    };
  }, [t, reload]);

  useEffect(() => {
    const stop = () => {
      if (document.hidden) {
        autoEnabled.current = false;
        setAuto(false);
      }
    };

    document.addEventListener('visibilitychange', stop);
    return () => document.removeEventListener('visibilitychange', stop);
  }, []);

  function stopAuto() {
    autoEnabled.current = false;
    setAuto(false);
  }

  async function execute(command: LuckyDrawCommand) {
    if (locked.current) return;
    locked.current = true;
    pending.current = command;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await getApiSdk().executeLuckyDraw(command);
      if (!alive.current) return;
      pending.current = undefined;
      setData(next);
      changed.current(next);
      if (command.type === 'buy-tickets') {
        setNotice(t('bought', { count: command.count }));
        locked.current = false;
        setBusy(false);
        return;
      }
      const won = next.result!;
      const index = LUCKY_PRIZES.findIndex((prize) => prize.id === won.prizeId);
      setResult(undefined);
      setSpinning(true);
      setRotation((value) => nextWheelRotation(value, index, LUCKY_PRIZES.length));
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 4200;
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        setResult(won);
        setSpinning(false);
        locked.current = false;
        setBusy(false);
        if (LUCKY_PRIZES[index].kind === 'cosmetic' || next.tickets < 1) stopAuto();
        if (autoEnabled.current)
          timer.current = setTimeout(() => {
            if (alive.current && autoEnabled.current)
              void execute({ type: 'spin', drawId: LUCKY_DRAW_ID, requestId: crypto.randomUUID() });
          }, 1600);
      }, duration);
    } catch (reason) {
      if (!alive.current) return;
      stopAuto();
      locked.current = false;
      setBusy(false);
      if (reason instanceof ApiSdkError && reason.code !== 'NETWORK_ERROR' && reason.code !== 'STORAGE_UNAVAILABLE')
        pending.current = undefined;
      setError(reason instanceof ApiSdkError && reason.code === 'INSUFFICIENT_COINS' ? t('insufficient') : t('failed'));
    }
  }

  const lastPrize = result && LUCKY_PRIZES.find((prize) => prize.id === result.prizeId);
  const blocked = busy || !!pending.current;
  return (
    <Dialog
      className="lucky-draw-dialog"
      title={t('title')}
      closeLabel={t('close')}
      onClose={onClose}
      showCloseFooter={false}
      footer={
        data && (
          <div className="lucky-draw-wallet">
            <div>
              <strong>{t('ticketPrice')}</strong>
              <small>{t('balance', { count: data.availableCoins })}</small>
            </div>
            <Button
              disabled={blocked || data.availableCoins < LUCKY_TICKET_PRICE}
              onClick={() => void execute({ type: 'buy-tickets', count: 1, requestId: crypto.randomUUID() })}
            >
              {t('buyOne')}
            </Button>
            <Button
              disabled={blocked || data.availableCoins < LUCKY_TICKET_PRICE * 5}
              onClick={() => void execute({ type: 'buy-tickets', count: 5, requestId: crypto.randomUUID() })}
            >
              {t('buyFive')}
            </Button>
          </div>
        )
      }
    >
      <style>{luckyDrawCss}</style>
      <div className="lucky-draw-heading">
        <p>{t('subtitle')}</p>
        <strong>{t('tickets', { count: data?.tickets ?? 0 })}</strong>
      </div>
      {!data ? (
        <p role={error ? 'alert' : 'status'}>
          {error || t('loading')}
          {error && <Button onClick={() => setReload((value) => value + 1)}>{t('retry')}</Button>}
        </p>
      ) : (
        <>
          <div className="lucky-draw-content">
            <section className="lucky-draw-play">
              <div className={`lucky-wheel${spinning ? ' is-spinning' : ''}`} role="img" aria-label={t('wheel')}>
                <div className="lucky-wheel-disc" style={{ transform: `rotate(${rotation}deg)` }}>
                  <AppImage width={512} height={512} className="lucky-wheel-art" src={asset('wheel')} alt="" />
                  {LUCKY_PRIZES.map((prize, index) => {
                    const angle = ((index + 0.5) * Math.PI * 2) / LUCKY_PRIZES.length;
                    return (
                      <span
                        key={prize.id}
                        className={`lucky-wheel-prize is-${prize.kind}`}
                        style={{ left: `${50 + Math.sin(angle) * 32}%`, top: `${50 - Math.cos(angle) * 32}%` }}
                      >
                        {prize.kind === 'cosmetic' ? (
                          <AppImage width={128} height={80} src={asset('pixie-wings')} alt="" />
                        ) : (
                          <>
                            <b>{prize.kind === 'tickets' ? '▰' : '●'}</b>
                            <small>{prize.amount.toLocaleString('vi-VN')}</small>
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
                <AppImage width={128} height={144} className="lucky-wheel-pointer" src={asset('pointer')} alt="" />
                <span className="lucky-wheel-hub">✦</span>
              </div>
              <div className="lucky-draw-result" role="status" aria-live="polite">
                {spinning ? (
                  t('spinning')
                ) : lastPrize ? (
                  <>
                    <strong>{result!.duplicate ? t('duplicate') : t('won', { name: label(lastPrize) })}</strong>
                    {lastPrize.kind === 'cosmetic' && !result!.duplicate && <small>{t('stored')}</small>}
                  </>
                ) : !data.tickets ? (
                  t('noTickets')
                ) : (
                  t('viewInventory')
                )}
              </div>
              <div className="lucky-draw-actions">
                <label className="lucky-draw-auto">
                  <input
                    type="checkbox"
                    checked={auto}
                    disabled={!data.tickets || !!pending.current}
                    onChange={(event) => {
                      autoEnabled.current = event.target.checked;
                      setAuto(event.target.checked);
                    }}
                  />
                  {t('auto')}
                </label>
                <Button
                  variant="primary"
                  disabled={blocked || data.tickets < 1}
                  onClick={() => void execute({ type: 'spin', drawId: LUCKY_DRAW_ID, requestId: crypto.randomUUID() })}
                >
                  {t(spinning ? 'spinning' : 'spin')}
                </Button>
              </div>
              <small className="lucky-draw-auto-hint">{t('autoHint')}</small>
            </section>
            <section className="lucky-draw-details">
              <div className="lucky-draw-tabs" role="tablist" aria-label={t('prizes')}>
                {(['prizes', 'rates', 'history'] as const).map((value) => (
                  <button
                    key={value}
                    id={`draw-tab-${value}`}
                    role="tab"
                    type="button"
                    aria-selected={tab === value}
                    aria-controls="draw-panel"
                    onClick={() => setTab(value)}
                  >
                    {t(value)}
                  </button>
                ))}
              </div>
              <div id="draw-panel" role="tabpanel" aria-labelledby={`draw-tab-${tab}`} className="lucky-draw-panel">
                {tab === 'prizes' && (
                  <>
                    <span className="lucky-draw-exclusive">{t('exclusive')}</span>
                    <CharacterPreview outfit={previewCosmetic(data.outfit, wings)} label={t('preview')} />
                    <h3>{t('wings')}</h3>
                    <p>{t('description')}</p>
                    <strong>
                      {data.ownedCosmetics.includes(wings.id)
                        ? t('owned')
                        : t('chance', { percent: LUCKY_PRIZES.find((prize) => prize.kind === 'cosmetic')!.weight })}
                    </strong>
                  </>
                )}
                {tab === 'rates' && (
                  <>
                    <p>{t('ratesHint')}</p>
                    <ul className="lucky-draw-rates">
                      {LUCKY_PRIZES.map((prize) => (
                        <li key={prize.id}>
                          <span>{label(prize)}</span>
                          <strong>{prize.weight}%</strong>
                        </li>
                      ))}
                    </ul>
                    <small>{t('duplicateHint')}</small>
                  </>
                )}
                {tab === 'history' && (
                  <ul className="lucky-draw-history">
                    {!data.history.length && <li>{t('emptyHistory')}</li>}
                    {data.history.map((entry) => (
                      <li key={entry.requestId}>
                        <time>
                          {new Date(entry.spunAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </time>
                        <strong>
                          {entry.duplicate
                            ? t('duplicate')
                            : label(LUCKY_PRIZES.find((prize) => prize.id === entry.prizeId)!)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {notice && <p role="status">{notice}</p>}
          {error && (
            <p role="alert">
              {error}{' '}
              {pending.current && (
                <Button disabled={busy} onClick={() => void execute(pending.current!)}>
                  {t('retryTransaction')}
                </Button>
              )}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
