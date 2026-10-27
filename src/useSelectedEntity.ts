import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useSelectedEntity(data, onOpen) {
  const [params] = useSearchParams();
  const name = params.get('name');
  const openedRef = useRef(null);

  useEffect(() => {
    if (!name || !Array.isArray(data)) return;
    if (openedRef.current === name) return;
    const record = data.find((item) => item.name === name);
    if (record) {
      onOpen(record);
      openedRef.current = name;
    }
  }, [name, data, onOpen]);
}
