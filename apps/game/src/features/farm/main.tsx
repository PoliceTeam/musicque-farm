import { farmCss } from '@/assets/generated-styles/farm-css';
import { inventoryCss } from '@/assets/generated-styles/inventory-css';

export { FarmScreen as Screen } from '@/features/farm/farm-screen';
export const styles = inventoryCss + farmCss;
