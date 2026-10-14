# UI images

React consumers use `ImageProvider` and `UiImage` from `@chibi-town/ui/react`.
The application registers asset URLs and intrinsic sizes, and injects its image
renderer. UI components do not import Next.js.

```tsx
<ImageProvider
  Image={AppImage}
  assets={{ 'game:banner': { src: '/banner.webp', width: 800, height: 240 } }}
>
  <UiImage asset="game:banner" alt="Game" />
</ImageProvider>
```

`AppImage` in the Next app wraps `next/image`. Generated game assets are registered
with their static image-loader sizes and `unoptimized: true`, preserving supplied
pixel artwork. Explicit width/height override the registry for fixed icon boxes;
CSS controls displayed size. A direct `src` also resolves registered metadata by
URL. Unregistered direct URLs need dimensions when used with the Next renderer.

Nested providers merge game-specific assets and inherit the parent's renderer.
Each app root has its own registry; there is no global mutable registration.
Without an injected renderer, `UiImage` uses a native image for other React hosts.
Unknown asset keys throw an error. SVG and canvas adapters can read asset URLs
through `useUiImages().assets`; non-React renderers continue using the app's
exported URL manifests. The imperative HTML stock-slot renderer stays native HTML.

`FormField` skins native text, number, email, password inputs and textareas with the same paper surface as select. It includes muted placeholders, keyboard focus, disabled and `aria-invalid="true"` states. Supply translated labels via props; UI has no game locale dependency. `Tabs` accepts a translated `label` for its tablist.
