// src/components/ui/Spinner.jsx
export function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      className={`spinner ${size === 'sm' ? 'spinner-sm' : ''} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

// src/components/ui/LoadingScreen.jsx – full page loader
export function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'var(--color-bg)',
      }}
      role="status"
    >
      <div style={{ fontSize: '2rem' }}>🌿</div>
      <Spinner />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
        {message}
      </p>
    </div>
  );
}
