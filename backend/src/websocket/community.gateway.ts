import { emitRealtime } from "./io.js";
import { websocketEvents } from "./events.js";

export function emitPostCreated(payload: unknown) {
  emitRealtime(websocketEvents.postNew, payload, "community");
}

export function emitCommentCreated(payload: unknown) {
  emitRealtime(websocketEvents.commentNew, payload, "community");
}
