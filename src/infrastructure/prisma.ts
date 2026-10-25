
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const schema = new URL(connectionString).searchParams.get("schema") ?? undefined;

const adapter = new PrismaPg(
  { connectionString },
  schema ? { schema } : undefined,
);

export const prisma = new PrismaClient({
  adapter,
});
