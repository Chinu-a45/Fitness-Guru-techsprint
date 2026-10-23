// src/hooks/useOnlineStatus.js
// ──────────────────────────────────────────────────────────────────
// Returns true when the browser is online, false when offline.
// Used to show the offline indicator banner.
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online',  up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
