import { emitRealtime } from "./io.js";
import { websocketEvents } from "./events.js";

export function emitParkingUpdated(payload: unknown, parkingSpotId?: string, zone?: string | null) {
  emitRealtime(websocketEvents.parkingUpdated, payload);
  if (parkingSpotId) emitRealtime(websocketEvents.parkingUpdated, payload, `parking:${parkingSpotId}`);
  if (zone) emitRealtime(websocketEvents.parkingUpdated, payload, `zone:${zone}`);
}

export function emitParkingReported(payload: unknown, parkingSpotId?: string, zone?: string | null) {
  emitRealtime(websocketEvents.parkingReported, payload);
  if (parkingSpotId) emitRealtime(websocketEvents.parkingReported, payload, `parking:${parkingSpotId}`);
  if (zone) emitRealtime(websocketEvents.parkingReported, payload, `zone:${zone}`);
}
