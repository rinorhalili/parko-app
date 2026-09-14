export function ErrorState({ title = "Diçka shkoi keq", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {onRetry && <button onClick={onRetry}>Provo përsëri</button>}
    </div>
  );
}
