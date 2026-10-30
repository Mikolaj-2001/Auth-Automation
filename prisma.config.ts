/// <reference types="node" />
import "dotenv/config";
import type { PrismaConfig } from "prisma/config";

const mongodbUrl = process.env.USE_ATLAS === "true" ? 
process.env.MONGODB_URL : process.env.MONGODB_URI;// Wybiera odpowiedni URL MongoDB w zależności od ustawienia USE_ATLAS

if (!mongodbUrl) {
  throw new Error("Missing MongoDB URL or URI");
}

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",//seed to jest plik, który wypełnia bazę danymi początkowymia,by mieć gotowe dane do testów lub uruchomienia aplikacji w środowisku deweloperskim
  },
  datasource: {
    url: mongodbUrl,
  },
} satisfies PrismaConfig;