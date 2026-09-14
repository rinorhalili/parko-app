export function LoadingState({ label = "Duke u ngarkuar..." }: { label?: string }) {
  return <div className="empty-state" role="status">{label}</div>;
}
