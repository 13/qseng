/**
 * Node >= 25 exposes an experimental `globalThis.localStorage` that is inert
 * unless `--localstorage-file` is passed. It shadows jsdom's implementation and
 * every test touching storage fails. Re-point the globals at jsdom's window.
 */
const w = globalThis as unknown as { window?: Window & typeof globalThis };
if (w.window) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      value: w.window[key],
      configurable: true,
      writable: true
    });
  }
}

// Fallback: if jsdom's storage is not functional, create an in-memory implementation
if (typeof (globalThis as any).localStorage?.clear !== 'function') {
  const createStorage = (): Storage => {
    const store: Record<string, string> = {};

    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key in store) {
          delete store[key];
        }
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length;
      }
    };
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorage(),
    configurable: true,
    writable: true
  });

  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createStorage(),
    configurable: true,
    writable: true
  });
}
