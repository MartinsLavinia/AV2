import type { FastifyInstance } from "fastify";
import { EquipamentoController } from "../controllers/EquipamentoController.js";
import { EstadoFisico, PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

const schemaVersao = {
  type: "object",
  additionalProperties: false,
  required: ["versao"],
  properties: { versao: { type: "integer", minimum: 1 } },
} as const;

const schemaMovimentacao = {
  type: "object",
  additionalProperties: false,
  required: ["destino", "versao"],
  properties: {
    destino: { type: "string", minLength: 1, maxLength: 200 },
    observacao: { type: "string", maxLength: 2000 },
    versao: { type: "integer", minimum: 1 },
  },
} as const;

const schemaEstadoFisico = {
  type: "object",
  additionalProperties: false,
  required: ["estadoFisico", "versao"],
  properties: {
    estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
    justificativa: { type: "string", maxLength: 2000 },
    versao: { type: "integer", minimum: 1 },
  },
} as const;

export async function equipamentoRoutes(app: FastifyInstance) {
  const controller = new EquipamentoController();
  const somenteGestorAlmoxarifado = permitirPapeis(PapelUsuario.GESTOR_ALMOXARIFADO);
  app.get("/equipamentos", { preHandler: somenteGestorAlmoxarifado }, controller.listar);
  app.post("/equipamentos", { preHandler: somenteGestorAlmoxarifado }, controller.criar);
  app.post("/equipamentos/:identificador/triagem/iniciar", { schema: { body: schemaVersao }, preHandler: somenteGestorAlmoxarifado }, controller.iniciarTriagem);
  app.post("/equipamentos/:identificador/triagem/concluir", { schema: { body: schemaVersao }, preHandler: somenteGestorAlmoxarifado }, controller.concluirTriagem);
  app.post("/equipamentos/:identificador/movimentacoes", { schema: { body: schemaMovimentacao }, preHandler: somenteGestorAlmoxarifado }, controller.movimentar);
  app.patch("/equipamentos/:identificador/estado-fisico", { schema: { body: schemaEstadoFisico }, preHandler: somenteGestorAlmoxarifado }, controller.alterarEstadoFisico);
}
