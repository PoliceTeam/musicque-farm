import { CROP_IDS, type CropId, FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { useTranslation } from 'react-i18next';
import { FarmPictureSelect } from '@/features/farm/_components/farm-picture-select';
import { cropIconUrl } from '@/features/farm/_utils/crop-growth-frames';

export function FarmCropSelector({ value, onChange }: { value: CropId; onChange: (id: CropId) => void }) {
  const { t } = useTranslation('farm');
  const { t: inventory } = useTranslation('inventory');
  const crop = FARM_CROPS[value];
  return (
    <div className="farm-crop-selector ui-stack">
      <FarmPictureSelect
        label={t('chooseCrop')}
        value={value}
        onChange={onChange}
        items={CROP_IDS.map((id) => ({ value: id, label: inventory(`products.${id}`), image: cropIconUrl(id) }))}
      />
      <div className="farm-crop-details">
        <p>
          {t(crop.growMs < 3600000 ? 'cropInfoMinutes' : 'cropInfo', {
            hours: crop.growMs / 3600000,
            minutes: crop.growMs / 60000,
            yield: crop.yield,
            price: crop.seedPrice,
            currency: t(crop.currency),
          })}
        </p>
        <p>{crop.sellPrice === null ? t('unsettledPrice') : t('sellPrice', { price: crop.sellPrice })}</p>
      </div>
    </div>
  );
}
