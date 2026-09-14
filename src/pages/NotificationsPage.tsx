import { Layout } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useNotificationContext } from "../context/NotificationContext";
import { relativeTime } from "../utils/date";

export default function NotificationsPage() {
  const { notifications, markRead, markAllRead } = useNotificationContext();
  return (
    <Layout title="Njoftimet">
      <ProtectedRoute>
        <button className="button button--secondary" onClick={() => void markAllRead()}>Shëno të gjitha si të lexuara</button>
        {notifications.length === 0 ? <EmptyState title="Nuk ka njoftime" /> : notifications.map((notification) => (
          <article className="parking-card" key={notification.id}>
            <div className="parking-card__content">
              <strong>{notification.title}</strong>
              <small>{relativeTime(notification.createdAt)}</small>
              <p>{notification.message}</p>
            </div>
            {!notification.readAt && <button className="button button--secondary" onClick={() => void markRead(notification.id)}>Lexuar</button>}
          </article>
        ))}
      </ProtectedRoute>
    </Layout>
  );
}
