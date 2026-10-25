import { useCallback, useEffect, useRef, useState } from 'react';
import { onKeyChanged, readKey, writeKey } from './store';

type Updater<T> = T | ((prev: T) => T);

/**
 * Kalıcı depoya bağlı React durumu. Diğer pencerelerdeki değişiklikleri otomatik alır.
 * `sanitize`, depodan gelen (eski sürüm veya bozuk) veriyi güvenli biçime getirir.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  sanitize?: (raw: unknown) => T,
): [T, (next: Updater<T>) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const valueRef = useRef(value);
  const initialRef = useRef(initial);
  const sanitizeRef = useRef(sanitize);
  sanitizeRef.current = sanitize;

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const raw = await readKey<unknown>(key, initialRef.current);
      if (!alive) return;
      const next = sanitizeRef.current ? sanitizeRef.current(raw) : (raw as T);
      valueRef.current = next;
      setValue(next);
      setLoaded(true);
    };
    void pull();
    const off = onKeyChanged(key, () => void pull());
    return () => {
      alive = false;
      off();
    };
  }, [key]);

  const update = useCallback(
    (next: Updater<T>) => {
      const resolved =
        typeof next === 'function' ? (next as (prev: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      void writeKey(key, resolved);
    },
    [key],
  );

  return [value, update, loaded];
}
