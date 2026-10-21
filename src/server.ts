
import "dotenv/config";
import Fastify from "fastify";
import { prisma } from "./infrastructure/prisma.js";
import { organizacaoRoutes } from "./routes/organizacaoRoutes.js";

const app = Fastify({ logger: true });

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
