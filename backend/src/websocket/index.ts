import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { corsOrigins } from "../config/env.js";
import { redis } from "../database/redis.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { prisma } from "../database/prisma.js";
import { setIo } from "./io.js";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true }
  });

  const pub = redis.duplicate();
  const sub = redis.duplicate();
  io.adapter(createAdapter(pub, sub));

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") return next(new Error("Authentication required"));
    try {
      const claims = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: claims.id }, select: { id: true, role: true, isActive: true } });
      if (!user?.isActive) return next(new Error('Account unavailable'));
      socket.data.user = user;
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string };
    socket.join(`user:${user.id}`);
    const timer = setInterval(async () => {
      try {
        verifyAccessToken(socket.handshake.auth.token);
        const current = await prisma.user.findUnique({ where: { id: user.id }, select: { isActive: true } });
        if (!current?.isActive) socket.disconnect(true);
      } catch { socket.disconnect(true); }
    }, 60_000);
    timer.unref();
    socket.on('disconnect', () => clearInterval(timer));

    socket.on("parking:subscribe", (payload: { spotId?: string; zone?: string } = {}) => {
      if (!payload || typeof payload !== 'object') return;
      if (typeof payload.spotId === "string" && payload.spotId.length <= 120) socket.join(`parking:${payload.spotId}`);
      if (typeof payload.zone === "string" && payload.zone.length <= 80) socket.join(`zone:${payload.zone}`);
    });

    socket.on("community:subscribe", () => socket.join("community"));
  });

  setIo(io);
  return io;
}
