import type { FastifyInstance } from "fastify";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { AuditoriaController } from "../controllers/AuditoriaController.js";
import { permitirPapeis } from "../plugins/jwt.js";

export async function auditoriaRoutes(app: FastifyInstance) {
  const controller = new AuditoriaController();
  const somenteAuditor = permitirPapeis(PapelUsuario.AUDITOR);

  app.get("/auditoria/equipamentos/:identificador/rastreamento", { preHandler: somenteAuditor }, controller.rastrearEquipamento);
  app.get("/auditoria/historico", { preHandler: somenteAuditor }, controller.listarHistorico);
  app.get("/auditoria/relatorio", { preHandler: somenteAuditor }, controller.gerarRelatorio);
}
