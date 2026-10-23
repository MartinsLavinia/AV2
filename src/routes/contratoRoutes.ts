import type { FastifyInstance } from "fastify";
import { ContratoController } from "../controllers/ContratoController.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

export async function contratoRoutes(app: FastifyInstance) {
  const controller = new ContratoController();
  const somenteOperadorCadastro = permitirPapeis(PapelUsuario.OPERADOR_CADASTRO);
  app.get("/contratos", { preHandler: somenteOperadorCadastro }, controller.listar);
  app.post("/contratos", { preHandler: somenteOperadorCadastro }, controller.criar);
}
