import { createMemoryAdapters } from '../src/memory.js';
import { adapterContract } from '../src/testing/adapter-contract.js';

adapterContract('memory', async () => {
  const adapters = createMemoryAdapters();
  return [adapters, adapters];
});
