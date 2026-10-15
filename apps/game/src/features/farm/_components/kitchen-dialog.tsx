import { FARM_RECIPES, type RecipeId } from '@chibi-town/game-content/farm-recipes';
import type { FarmProduct, FarmProgress } from '@chibi-town/gameplay';
import { canStoreFarmGoods } from '@chibi-town/gameplay/farm-storage-logic';
import { Button, Dialog, UiImage } from '@chibi-town/ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FarmPictureSelect } from '@/features/farm/_components/farm-picture-select';
import type { ExecuteFarm } from '@/features/farm/_components/farm-unit-panel';
import { foodIconUrl } from '@/features/farm/_utils/food-art';
import { ProductIcon } from '@/features/inventory/_components/product-icon';

function DishIcon({ id }: { id: RecipeId }) {
  return <UiImage className="kitchen-dish-icon" asset={`farm:food-${id}`} alt="" width={44} height={44} />;
}

export function KitchenDialog({
  state,
  now,
  pending,
  execute,
  onClose,
}: {
  state: FarmProgress;
  now: number;
  pending: boolean;
  execute: ExecuteFarm;
  onClose: () => void;
}) {
  const { t: common } = useTranslation('common');
  const { t } = useTranslation('farm');
  const { t: inventory } = useTranslation('inventory');
  const [recipeId, setRecipeId] = useState<RecipeId>('eggCake');
  const recipe = FARM_RECIPES[recipeId];
  const ingredients = Object.entries(recipe.ingredients) as [FarmProduct, number][];
  const missing = ingredients.some(([id, count]) => (state.inventory[id] ?? 0) < count);
  const unavailable = ingredients.some(
    ([id, count]) => ['lychee', 'peach', 'cream', 'fruitPlate'].includes(id) && (state.inventory[id] ?? 0) < count,
  );
  return (
    <Dialog
      id="kitchen"
      title={t('kitchen')}
      onClose={onClose}
      closeLabel={common('close')}
      footer={
        <>
          <Button
            variant="primary"
            disabled={pending || missing || unavailable || state.kitchen.length > 0}
            onClick={() => void execute({ type: 'cook', recipeId })}
          >
            {t('cook')}
          </Button>
          <Button onClick={onClose}>{common('close')}</Button>
        </>
      }
    >
      {state.kitchen.map((job) => (
        <section key={job.id}>
          <h3>
            <DishIcon id={job.recipeId} /> {inventory(`products.${job.recipeId}`)}
          </h3>
          <p>
            {now >= job.readyAt ? t('dishReady') : t('cooking', { minutes: Math.ceil((job.readyAt - now) / 60000) })}
          </p>
          {!canStoreFarmGoods(state, { [job.recipeId]: 1 }) && <p>{inventory('chestFull')}</p>}
          <Button
            disabled={pending || now < job.readyAt || !canStoreFarmGoods(state, { [job.recipeId]: 1 })}
            onClick={() => void execute({ type: 'collect-dish', jobId: job.id })}
          >
            {t('collectDish')}
          </Button>
        </section>
      ))}
      <FarmPictureSelect
        label={t('chooseDish')}
        value={recipeId}
        onChange={setRecipeId}
        items={(Object.keys(FARM_RECIPES) as RecipeId[]).map((id) => ({
          value: id,
          label: inventory(`products.${id}`),
          image: foodIconUrl(id),
        }))}
      />
      <section className="ui-section kitchen-recipe-detail">
        <h3>
          <DishIcon id={recipeId} /> {inventory(`products.${recipeId}`)}
        </h3>
        <p>{t('cookInfo', { minutes: recipe.cookMs / 60000, coins: recipe.sellPrice })}</p>
        <h3>{t('ingredients')}</h3>
        <ul>
          {ingredients.map(([id, count]) => (
            <li key={id}>
              <ProductIcon product={id} />{' '}
              {t('ingredientCount', { name: inventory(`products.${id}`), have: state.inventory[id] ?? 0, need: count })}
            </li>
          ))}
        </ul>
        {unavailable && <p>{t('missingSource')}</p>}
        {state.kitchen.length > 0 && <p>{t('kitchenBusy')}</p>}
      </section>
    </Dialog>
  );
}
