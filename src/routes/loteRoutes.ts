import type { FastifyInstance } from "fastify";
import { LoteController } from "../controllers/LoteController.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

const schemaEdicao = {
  type: "object", additionalProperties: false, required: ["versao"], minProperties: 2,
  properties: {
    notaFiscal: { type: "string", minLength: 1, maxLength: 100 },
    //Sofrimento
    transportadora: { type: "string", minLength: 1, maxLength: 160 },
    dataEntrada: { type: "string", minLength: 10 },
    observacoes: { type: "string", maxLength: 2000 },
    versao: { type: "integer", minimum: 1 },
  },
} as const;
const schemaVersao = { type: "object", additionalProperties: false, required: ["versao"], properties: { versao: { type: "integer", minimum: 1 } } } as const;

export async function loteRoutes(app: FastifyInstance) {
  const controller = new LoteController();
  const somenteGestorAlmoxarifado = permitirPapeis(PapelUsuario.GESTOR_ALMOXARIFADO);
  app.get("/lotes", { preHandler: somenteGestorAlmoxarifado }, controller.listar);
  app.get("/lotes/:id", { preHandler: somenteGestorAlmoxarifado }, controller.obter);
  app.post("/lotes", { preHandler: somenteGestorAlmoxarifado }, controller.criar);
  app.patch("/lotes/:id", { schema: { body: schemaEdicao }, preHandler: somenteGestorAlmoxarifado }, controller.editar);
  app.delete("/lotes/:id", { schema: { querystring: schemaVersao }, preHandler: somenteGestorAlmoxarifado }, controller.excluir);
}
