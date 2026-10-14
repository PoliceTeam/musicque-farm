import type { UiImageRenderProps } from '@chibi-town/ui/react';
import Image from 'next/image';

/** Next owns image delivery; supplied game pixels stay unchanged by default. */
export function AppImage({ unoptimized = true, width, height, ...props }: UiImageRenderProps) {
  if (!width || !height) throw new Error(`Image dimensions must be registered or supplied: ${props.src}`);
  return <Image {...props} width={width} height={height} unoptimized={unoptimized} />;
}
