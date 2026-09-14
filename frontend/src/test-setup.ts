/**
 * Node >= 25 defines an inert experimental `globalThis.localStorage` accessor
 * (it stays undefined unless `--localstorage-file` is passed), and vitest's jsdom
 * environment never copies jsdom's Storage instances onto the global. Install a
 * small in-memory Storage for both so code under test can use them. Do not read
 * the Node accessor first: reading it is what emits the ExperimentalWarning.
 */
function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };
}

for (const key of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, key, { value: createStorage(), configurable: true, writable: true });
}
