// src/components/ui/ErrorMessage.jsx
// Inline error alert shown when a fetch or action fails.
import { AlertCircle } from 'lucide-react';

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginLeft: '0.75rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 600,
              textDecoration: 'underline',
              fontSize: 'inherit',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
