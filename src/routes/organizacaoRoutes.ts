
import type { FastifyInstance } from "fastify";
import { OrganizacaoController } from "../controllers/OrganizacaoController.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

export async function organizacaoRoutes(app: FastifyInstance) {
  const controller = new OrganizacaoController();

  const somenteOperadorCadastro = permitirPapeis(PapelUsuario.OPERADOR_CADASTRO);

  app.get("/organizacoes", { preHandler: somenteOperadorCadastro }, controller.listarTodas);
  app.post("/organizacoes", { preHandler: somenteOperadorCadastro }, controller.criar);
}
