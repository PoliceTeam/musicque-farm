import { ImageProvider, UiImage, type UiImageRenderProps, useUiImages } from '@chibi-town/ui/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

function Renderer(props: UiImageRenderProps) {
  return (
    <span
      data-src={props.src}
      data-width={props.width}
      data-height={props.height}
      data-original={props.unoptimized}
      role="img"
      aria-label={props.alt}
    />
  );
}

it('resolves registered keys and URLs through the injected renderer, with intrinsic sizes', () => {
  const html = renderToStaticMarkup(
    <ImageProvider
      Image={Renderer}
      assets={{ 'game:card': { src: '/card.webp', width: 320, height: 200, unoptimized: true } }}
    >
      <UiImage asset="game:card" alt="Game" />
      <UiImage src="/card.webp" width={42} height={42} alt="Icon" />
    </ImageProvider>,
  );
  expect(html).toContain('data-width="320"');
  expect(html).toContain('data-height="200"');
  expect(html).toContain('data-width="42"');
  expect(html).toContain('data-original="true"');
  expect(html).not.toContain('<img');
});
it('lets a game register additional assets while inheriting the app renderer and other assets', () => {
  const html = renderToStaticMarkup(
    <ImageProvider Image={Renderer} assets={{ shared: { src: '/shared.webp', width: 8, height: 8 } }}>
      <ImageProvider assets={{ card: { src: '/module.webp', width: 100, height: 70 } }}>
        <UiImage asset="shared" alt="Shared" />
        <UiImage asset="card" alt="Module" />
      </ImageProvider>
    </ImageProvider>,
  );
  expect(html).toContain('data-src="/shared.webp"');
  expect(html).toContain('data-src="/module.webp"');
});
it('isolates registries between app roots and supports framework-neutral fallback images', () => {
  const first = renderToStaticMarkup(
    <ImageProvider assets={{ card: { src: '/first.webp', width: 9, height: 7 } }}>
      <UiImage asset="card" alt="First" />
    </ImageProvider>,
  );
  expect(first).toContain('<img');
  expect(first).toContain('width="9"');
  expect(() => renderToStaticMarkup(<UiImage asset="card" alt="Missing" />)).toThrow('Unregistered image asset');
  const second = renderToStaticMarkup(<UiImage src="/plain.webp" alt="Plain" width={10} height={10} />);
  expect(second).toContain('alt="Plain"');
  expect(second).not.toContain('unoptimized');
});
it('makes registered URLs available to SVG/canvas adapters without invoking the React renderer', () => {
  function UrlConsumer() {
    return <span>{useUiImages().assets.texture.src}</span>;
  }

  expect(
    renderToStaticMarkup(
      <ImageProvider Image={Renderer} assets={{ texture: { src: '/texture.webp' } }}>
        <UrlConsumer />
      </ImageProvider>,
    ),
  ).toBe('<span>/texture.webp</span>');
});
