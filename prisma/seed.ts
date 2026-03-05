import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await hash("admin123", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@qoqon.ru" },
    create: {
      email: "admin@qoqon.ru",
      passwordHash: adminHash,
      role: "ADMIN",
    },
    update: {},
  });
  console.log("Seed: admin user", user.email);

  const freePlan = await prisma.plan.upsert({
    where: { name: "Бесплатный" },
    create: {
      name: "Бесплатный",
      isFree: true,
      storageQuota: BigInt(25 * 1024 * 1024 * 1024), // 25GB
      maxFileSize: BigInt(512 * 1024 * 1024), // 512MB
      features: {
        video_player: true,
        audio_player: true,
        share_links: true,
        folder_share: true,
        ai_search: false,
        document_chat: false,
      },
      priceMonthly: null,
      priceYearly: null,
    },
    update: {
      isFree: true,
      storageQuota: BigInt(25 * 1024 * 1024 * 1024),
      maxFileSize: BigInt(512 * 1024 * 1024),
      features: {
        video_player: true,
        audio_player: true,
        share_links: true,
        folder_share: true,
        ai_search: false,
        document_chat: false,
      },
    },
  });
  console.log("Seed: plan", freePlan.name);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
