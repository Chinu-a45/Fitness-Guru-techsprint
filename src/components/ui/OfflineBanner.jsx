// src/components/ui/OfflineBanner.jsx
// Shows a banner at the top of the screen when the device is offline.
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <WifiOff size={14} style={{ display: 'inline', marginRight: 6 }} />
      You're offline – cached data is shown. Changes will sync when you reconnect.
    </div>
  );
}
