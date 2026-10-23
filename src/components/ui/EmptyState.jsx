// src/components/ui/EmptyState.jsx
// Generic empty-state placeholder shown when a list has no data.
import { Inbox } from 'lucide-react';

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty-state">
      <Icon />
      {title   && <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>{title}</p>}
      {message && <p style={{ fontSize: '0.875rem' }}>{message}</p>}
      {action}
    </div>
  );
}
