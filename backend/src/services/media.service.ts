import { randomUUID } from "node:crypto";
import net from "node:net";
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { badRequest, serviceUnavailable } from "../utils/errors.js";

const allowed = new Map([
  ["image/jpeg", { bytes: [[0xff, 0xd8, 0xff]], extension: "jpg", max: 10 * 1024 * 1024 }],
  ["image/png", { bytes: [[0x89, 0x50, 0x4e, 0x47]], extension: "png", max: 10 * 1024 * 1024 }],
  ["image/webp", { bytes: [[0x52, 0x49, 0x46, 0x46]], extension: "webp", max: 10 * 1024 * 1024 }],
  ["video/mp4", { bytes: [[0x66, 0x74, 0x79, 0x70]], extension: "mp4", max: 50 * 1024 * 1024 }],
  ["video/webm", { bytes: [[0x1a, 0x45, 0xdf, 0xa3]], extension: "webm", max: 50 * 1024 * 1024 }]
]);

const s3 = new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true, credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined });
let bucketReady: Promise<void> | null = null;

function hasSignature(buffer: Buffer, signatures: number[][]) {
  return signatures.some((signature) => buffer.includes(Buffer.from(signature)));
}

async function scan(buffer: Buffer) {
  if (!env.CLAMAV_HOST) throw serviceUnavailable("Media scanning is not configured");
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
    const timeout = setTimeout(() => { socket.destroy(); reject(serviceUnavailable("Media scan timed out")); }, 15_000);
    let reply = "";
    socket.on("error", () => { clearTimeout(timeout); reject(serviceUnavailable("Media scan is unavailable")); });
    socket.on("data", (data) => { reply += data.toString(); });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const length = Buffer.alloc(4); length.writeUInt32BE(buffer.length);
      socket.write(length);
      socket.write(buffer); socket.write(Buffer.alloc(4));
    });
    socket.on("end", () => { clearTimeout(timeout); reply.includes("OK") ? resolve() : reject(badRequest("File failed malware scan", "MEDIA_REJECTED")); });
  });
}

async function ensureBucket() {
  if (!bucketReady) bucketReady = (async () => {
    try { await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })); }
    catch { await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET })); }
  })();
  return bucketReady;
}

export async function uploadMedia(file: Express.Multer.File) {
  const format = allowed.get(file.mimetype);
  if (!format || file.size > format.max || !hasSignature(file.buffer, format.bytes)) throw badRequest("Unsupported or invalid media file", "INVALID_MEDIA");
  await scan(file.buffer); await ensureBucket();
  const key = `${randomUUID()}.${format.extension}`;
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype, CacheControl: "public, max-age=31536000, immutable" }));
  return { key, url: `/api/v1/media/${key}`, type: file.mimetype.startsWith("video/") ? "video" : "image", bytes: file.size };
}

export async function readMedia(key: string) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/i.test(key)) throw badRequest("Invalid media key");
  await ensureBucket();
  return s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
