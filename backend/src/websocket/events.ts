export const websocketEvents = {
  parkingUpdated: "parking:updated",
  parkingReported: "parking:reported",
  reservationCreated: "reservation:created",
  reservationCancelled: "reservation:cancelled",
  postNew: "post:new",
  commentNew: "comment:new",
  notificationNew: "notification:new",
  moderationUpdate: "moderation:update",
} as const;

export type WebsocketEventName = (typeof websocketEvents)[keyof typeof websocketEvents];
