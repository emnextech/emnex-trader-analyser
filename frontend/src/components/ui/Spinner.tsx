interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Brand ring spinner. */
export function Spinner({ size = 20, className = '', label }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="animate-spin rounded-full border-2 border-line border-t-brand"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && <span className="text-sm text-content-muted">{label}</span>}
    </span>
  );
}
