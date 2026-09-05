import type { Server } from "socket.io";

let ioRef: Server | undefined;

export function setIo(io: Server) {
  ioRef = io;
}

export function emitRealtime(event: string, payload: unknown, room?: string) {
  if (!ioRef) return;
  if (room) ioRef.to(room).emit(event, payload);
  else ioRef.emit(event, payload);
}
