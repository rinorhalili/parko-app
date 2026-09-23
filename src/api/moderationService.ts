import { apiRequest } from './client'

export type ReportTargetType = 'POST' | 'COMMENT' | 'PARKING_REPORT' | 'USER'

export function reportContent(targetType: ReportTargetType, targetId: string, reason: string) {
  return apiRequest<{ id: string }>('/moderation/reports', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, reason }),
  })
}
