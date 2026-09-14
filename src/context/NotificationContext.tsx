import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "../api/notificationService";

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    setNotifications(await listNotifications());
  }, []);

  const markRead = useCallback(async (id: string) => {
    const updated = await markNotificationRead(id);
    setNotifications((current) => current.map((item) => (item.id === id ? updated : item)));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
    );
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
    const update = () => void refresh().catch(() => undefined);
    window.addEventListener("parko:auth-changed", update);
    return () => window.removeEventListener("parko:auth-changed", update);
  }, [refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
      refresh,
      markRead,
      markAllRead,
    }),
    [markAllRead, markRead, notifications, refresh],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationContext() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotificationContext must be used inside NotificationProvider");
  return value;
}
