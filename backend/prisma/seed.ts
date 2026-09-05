import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const moderatorPassword = process.env.SEED_MODERATOR_PASSWORD ?? "ChangeMe123!";
  const userPassword = process.env.SEED_USER_PASSWORD ?? "ChangeMe123!";

  const [admin, moderator, user] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@example.test" },
      update: {},
      create: { name: "Admin", username: "admin", email: "admin@example.test", passwordHash: await hashPassword(adminPassword), role: "ADMIN", isVerified: true }
    }),
    prisma.user.upsert({
      where: { email: "moderator@example.test" },
      update: {},
      create: { name: "Moderator", username: "moderator", email: "moderator@example.test", passwordHash: await hashPassword(moderatorPassword), role: "MODERATOR", isVerified: true }
    }),
    prisma.user.upsert({
      where: { email: "driver@example.test" },
      update: {},
      create: { name: "Driver", username: "driver", email: "driver@example.test", passwordHash: await hashPassword(userPassword), role: "USER" }
    })
  ]);

  const spot = await prisma.parkingSpot.create({
    data: {
      ownerId: admin.id,
      title: "Mother Teresa Square Parking",
      description: "Seeded public parking area in central Prishtina.",
      latitude: 42.6629,
      longitude: 21.1655,
      address: "Sheshi Nena Tereze",
      zone: "center",
      status: "UNKNOWN",
      type: "STREET",
      capacity: 20
    }
  });

  await prisma.$executeRaw`
    UPDATE "ParkingSpot"
    SET "geoPoint" = ST_SetSRID(ST_MakePoint(${spot.longitude}, ${spot.latitude}), 4326)::geography
    WHERE id = ${spot.id}
  `;

  const report = await prisma.parkingReport.create({
    data: {
      reporterId: user.id,
      parkingSpotId: spot.id,
      status: "AVAILABLE",
      latitude: spot.latitude,
      longitude: spot.longitude,
      confidence: 75,
      expiresAt: new Date(Date.now() + 30 * 60_000)
    }
  });

  await prisma.post.create({
    data: {
      authorId: moderator.id,
      parkingSpotId: spot.id,
      title: "Center parking looks clear",
      content: "A few places were open near the square this afternoon."
    }
  });

  await prisma.notification.create({
    data: { recipientId: user.id, type: "REPORT_CONFIRMED", title: "Report received", message: "Thanks for helping other drivers.", data: { reportId: report.id } }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
