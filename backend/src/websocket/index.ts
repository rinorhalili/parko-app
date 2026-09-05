import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { redis } from "../database/redis.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { setIo } from "./io.js";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true }
  });

  const pub = redis.duplicate();
  const sub = redis.duplicate();
  io.adapter(createAdapter(pub, sub));

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") return next(new Error("Authentication required"));
    try {
      socket.data.user = verifyAccessToken(token);
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string };
    socket.join(`user:${user.id}`);

    socket.on("parking:subscribe", (payload: { spotId?: string; zone?: string }) => {
      if (payload.spotId) socket.join(`parking:${payload.spotId}`);
      if (payload.zone) socket.join(`zone:${payload.zone}`);
    });

    socket.on("community:subscribe", () => socket.join("community"));
  });

  setIo(io);
  return io;
}
