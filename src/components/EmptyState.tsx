export function EmptyState({ title = "Nuk ka të dhëna", message, actionLabel, onAction }: { title?: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {actionLabel && onAction && <button onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
