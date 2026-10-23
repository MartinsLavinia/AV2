import type { FastifyInstance } from "fastify";
import { LoteController } from "../controllers/LoteController.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

export async function loteRoutes(app: FastifyInstance) {
  const controller = new LoteController();
  const somenteGestorAlmoxarifado = permitirPapeis(PapelUsuario.GESTOR_ALMOXARIFADO);
  app.get("/lotes", { preHandler: somenteGestorAlmoxarifado }, controller.listar);
  app.post("/lotes", { preHandler: somenteGestorAlmoxarifado }, controller.criar);
}
