import { useCallback, useEffect, useRef, useState } from "react";

export const SAVE_DEBOUNCE_MS = 400;

export function useDebouncedSave<T extends Record<string, unknown>>(
  onSave: (patch: T) => Promise<void>,
  delay = SAVE_DEBOUNCE_MS,
) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Partial<T>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      await onSaveRef.current(patch as T);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : null);
      setSaved(false);
    }
  }, []);

  const queue = useCallback(
    (patch: Partial<T>) => {
      setSaved(false);
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { queue, flush, saved, error, setError };
}
