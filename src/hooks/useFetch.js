import { useCallback, useEffect, useState } from 'react';
import { normalizeFetchError } from '../api';

export function useFetch(loader) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const result = await loader();
        setData(result);
      } catch (err) {
        setError(normalizeFetchError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loader]
  );

  const reloadQuiet = useCallback(async () => {
    try {
      const result = await loader();
      setData(result);
      setError('');
    } catch {
      // Arka plan yenilemesinde kullanıcıyı rahatsız etme.
    }
  }, [loader]);

  useEffect(() => {
    load(false);
  }, [load]);

  return { data, loading, refreshing, error, reload: () => load(false), refresh: () => load(true), reloadQuiet };
}
