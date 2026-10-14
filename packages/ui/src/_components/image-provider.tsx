import { type ComponentType, type CSSProperties, createContext, type ReactNode, useContext, useMemo } from 'react';
export type UiImageAsset = { src: string; width?: number; height?: number; unoptimized?: boolean };
export type UiImageRenderProps = UiImageAsset & {
  alt: string;
  className?: string;
  style?: CSSProperties;
  sizes?: string;
  loading?: 'eager' | 'lazy';
  draggable?: boolean;
};
export type UiImageProps = Omit<UiImageRenderProps, 'src'> &
  ({ asset: string; src?: never } | { src: string; asset?: never });

function NativeImage({ unoptimized: _unoptimized, alt, ...props }: UiImageRenderProps) {
  // biome-ignore lint/performance/noImgElement: Framework-neutral fallback; apps inject their own image renderer.
  return <img {...props} alt={alt} />;
}

const Context = createContext<{
  assets: Readonly<Record<string, UiImageAsset>>;
  bySrc: Readonly<Record<string, UiImageAsset>>;
  Image: ComponentType<UiImageRenderProps>;
}>({ assets: {}, bySrc: {}, Image: NativeImage });

/** Nested providers register game assets without replacing the application's renderer. */
export function ImageProvider({
  assets = {},
  Image,
  children,
}: {
  assets?: Readonly<Record<string, UiImageAsset>>;
  Image?: ComponentType<UiImageRenderProps>;
  children: ReactNode;
}) {
  const parent = useContext(Context);
  const value = useMemo(() => {
    const merged = { ...parent.assets, ...assets };
    const bySrc = Object.fromEntries(Object.values(merged).map((asset) => [asset.src, asset]));
    return { assets: merged, bySrc, Image: Image ?? parent.Image };
  }, [assets, Image, parent]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useUiImages() {
  return useContext(Context);
}

export function UiImage({ asset, src, ...props }: UiImageProps) {
  const registry = useUiImages();
  const entry = asset !== undefined ? registry.assets[asset] : src ? registry.bySrc[src] : undefined;
  if (asset !== undefined && !entry) throw new Error(`Unregistered image asset: ${asset}`);
  const Image = registry.Image;
  return <Image {...entry} {...props} src={entry?.src ?? src!} />;
}
