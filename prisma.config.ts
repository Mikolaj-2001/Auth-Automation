/// <reference types="node" />
import "dotenv/config";
import type { PrismaConfig } from "prisma/config";

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.MONGODB_URL ??
      (() => {
        throw new Error("Missing MONGODB_URL");
      })(),
  },
} satisfies PrismaConfig;