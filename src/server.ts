
import "dotenv/config";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { prisma } from "./infrastructure/prisma.js";
import { organizacaoRoutes } from "./routes/organizacaoRoutes.js";
import { usuarioRoutes } from "./routes/usuarioRoutes.js";
import { loteRoutes } from "./routes/loteRoutes.js";
import { equipamentoRoutes } from "./routes/equipamentoRoutes.js";
import { contratoRoutes } from "./routes/contratoRoutes.js";
import { configuracaoRoutes } from "./routes/configuracaoRoutes.js";

const app = Fastify({ logger: true });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET precisa estar configurado e ter pelo menos 32 caracteres.");
}

app.register(jwt, { secret: jwtSecret });

app.get("/", async () => {
  return { mensagem: "API GreenCode AV2 funcionando!" };
});

app.get("/teste-banco", async () => {
  await prisma.$queryRaw`SELECT 1`;

  return {
    mensagem: "Conexão com PostgreSQL funcionando!",
  };
});

const iniciarServidor = async () => {
  try {
    app.register(organizacaoRoutes);
    app.register(usuarioRoutes);
    app.register(loteRoutes);
    app.register(equipamentoRoutes);
    app.register(contratoRoutes);
    app.register(configuracaoRoutes);
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: "0.0.0.0",
    });
  } catch (erro) {
    app.log.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  }
};

iniciarServidor();
