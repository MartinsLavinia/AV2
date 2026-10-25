
import "dotenv/config";
import { prisma } from "./infrastructure/prisma.js";
import { criarAplicacao } from "./app.js";

const app = criarAplicacao();

let encerramentoEmAndamento = false;

async function encerrarServidor(sinal: NodeJS.Signals) {
  if (encerramentoEmAndamento) return;
  encerramentoEmAndamento = true;
  app.log.info({ sinal }, "Encerrando servidor de forma graciosa.");

  try {
    // Fastify para de aceitar conexões e aguarda as requisições em andamento.
    await app.close();
  } catch (erro) {
    app.log.error(erro, "Erro ao fechar o servidor HTTP.");
    process.exitCode = 1;
  } finally {
    // Desconecta do banco somente depois de encerrar as requisições.
    try {
      await prisma.$disconnect();
    } catch (erro) {
      app.log.error(erro, "Erro ao desconectar o Prisma.");
      process.exitCode = 1;
    }
  }
}

const iniciarServidor = async () => {
  try {
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: "0.0.0.0",
    });
    process.once("SIGINT", () => void encerrarServidor("SIGINT"));
    process.once("SIGTERM", () => void encerrarServidor("SIGTERM"));
  } catch (erro) {
    app.log.error(erro);
    await prisma.$disconnect();
    process.exitCode = 1;
  }
};

iniciarServidor();
