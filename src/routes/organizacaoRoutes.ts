
import type { FastifyInstance } from "fastify";
import { OrganizacaoController } from "../controllers/OrganizacaoController.js";

export async function organizacaoRoutes(app: FastifyInstance) {
  const controller = new OrganizacaoController();

  app.get("/organizacoes", controller.listarTodas);
}
