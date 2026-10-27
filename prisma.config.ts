import "dotenv/config";
import type { PrismaConfig } from "prisma";

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.MONGODB_URI ??
      (() => {
        throw new Error("Missing MONGODB_URI");
      })(),
  },
} satisfies PrismaConfig;