import type { RendererOptions, RendererProvider } from './renderer-types.js';

/** Each app owns its registry. Engines are supplied explicitly, with no global singleton. */
export function createRendererRegistry() {
  const providers = new Map<string, RendererProvider>();
  return {
    register(name: string, provider: RendererProvider) {
      if (!name || providers.has(name)) throw new Error(`renderer provider already registered or empty: ${name}`);
      providers.set(name, provider);
    },

    create(name: string, options: RendererOptions) {
      const provider = providers.get(name);
      if (!provider) throw new Error(`unknown renderer provider: ${name}`);
      return provider(options);
    },
  };
}
