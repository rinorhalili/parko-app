import { apiRequest } from './client'

export type Notification = {
  id: string
  type: string
  title: string
  message: string
  data: unknown
  readAt: string | null
  createdAt: string
}

export function listNotifications() { return apiRequest<Notification[]>('/notifications') }
export function markNotificationRead(id: string) { return apiRequest<Notification>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }) }
export function markAllNotificationsRead() { return apiRequest<{ readAll: boolean }>('/notifications/read-all', { method: 'POST' }) }
