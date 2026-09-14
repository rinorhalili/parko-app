import { useNotificationContext } from "../context/NotificationContext";

export function NotificationBell() {
  const { unreadCount } = useNotificationContext();
  return (
    <a className="round-button" href="/notifications" aria-label={`${unreadCount} njoftime të palexuara`}>
      {unreadCount ? unreadCount : "!"}
    </a>
  );
}
