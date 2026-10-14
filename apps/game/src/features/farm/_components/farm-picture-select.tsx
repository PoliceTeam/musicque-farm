import { Select } from '@chibi-town/ui/react';
export type PictureChoice<T extends string> = { value: T; label: string; image: string };

export function FarmPictureSelect<T extends string>(props: {
  label: string;
  value: T;
  items: PictureChoice<T>[];
  onChange: (value: T) => void;
}) {
  return <Select {...props} classPrefix="farm-picture" />;
}
