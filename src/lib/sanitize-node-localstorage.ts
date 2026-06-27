function sanitizeNodeLocalStorage() {
  if (typeof globalThis === 'undefined') return;

  try {
    const storage = (globalThis as any).localStorage;
    if (storage == null) return;

    const isValidStorage =
      typeof storage === 'object' &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function' &&
      typeof storage.clear === 'function' &&
      typeof storage.key === 'function';

    if (!isValidStorage) {
      const serverStorage = {
        getItem: (_key: string) => null,
        setItem: (_key: string, _value: string) => {},
        removeItem: (_key: string) => {},
        clear: () => {},
        key: (_index: number) => null,
        length: 0,
      };

      try {
        Object.defineProperty(globalThis, 'localStorage', {
          value: serverStorage,
          configurable: true,
          writable: true,
          enumerable: true,
        });
      } catch {
        try {
          (globalThis as any).localStorage = serverStorage;
        } catch {
          // no-op if the property is non-writable
        }
      }
    }
  } catch {
    // ignore if globalThis.localStorage access throws
  }
}

sanitizeNodeLocalStorage();
