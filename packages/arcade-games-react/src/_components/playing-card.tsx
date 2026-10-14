import { type Card, cardRank, cardSuit } from '@chibi-town/arcade-games/tien-len-logic';
import { useTranslation } from 'react-i18next';

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['♠', '♣', '♦', '♥'];

export function PlayingCard({
  card,
  selected = false,
  onClick,
  disabled = false,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('common');
  const rank = RANKS[cardRank(card)],
    suit = SUITS[cardSuit(card)],
    red = cardSuit(card) >= 2;
  const content = (
    <>
      <span className="card-corner">
        <b>{rank}</b>
        <i>{suit}</i>
      </span>
      <span className="card-center">
        {['J', 'Q', 'K'].includes(rank) ? (
          <>
            <span className="card-crown">♛</span>
            <b>{rank}</b>
            <i>{suit}</i>
          </>
        ) : (
          suit
        )}
      </span>
      <span className="card-corner card-corner--bottom">
        <b>{rank}</b>
        <i>{suit}</i>
      </span>
    </>
  );
  const className = `playing-card ${red ? 'is-red' : ''} ${selected ? 'is-selected' : ''}`;
  const label = t('tienCardLabel', { rank, suit: t(`tienSuits.suit-${cardSuit(card) as 0 | 1 | 2 | 3}`) });
  return onClick ? (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      data-ui-sound="select"
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const buttons = Array.from(
          event.currentTarget.closest('fieldset')?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
        );
        const index = buttons.indexOf(event.currentTarget);
        if (index < 0) return;
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        buttons[next]?.focus();
      }}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <span className={className} role="img" aria-label={label}>
      {content}
    </span>
  );
}
