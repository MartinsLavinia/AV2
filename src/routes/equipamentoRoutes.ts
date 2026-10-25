import type { FastifyInstance } from "fastify";
import { EquipamentoController } from "../controllers/EquipamentoController.js";
import { EstadoFisico, PapelUsuario, TipoEquipamento } from "../generated/prisma/enums.js";
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

const schemaEdicao = {
  type: "object", additionalProperties: false, required: ["versao"], minProperties: 2,
  properties: {
    tipo: { type: "string", enum: Object.values(TipoEquipamento) },
    marca: { type: "string", minLength: 1, maxLength: 120 },
    modelo: { type: "string", minLength: 1, maxLength: 120 },
    anoFabricacao: { type: "integer", minimum: 1970, maximum: new Date().getFullYear() },
    pesoQuilogramas: { type: "number", exclusiveMinimum: 0 },
    versao: { type: "integer", minimum: 1 },
  },
} as const;
export async function equipamentoRoutes(app: FastifyInstance) {
  const controller = new EquipamentoController();
  const somenteGestorAlmoxarifado = permitirPapeis(PapelUsuario.GESTOR_ALMOXARIFADO);
  app.get("/equipamentos", { preHandler: somenteGestorAlmoxarifado }, controller.listar);
  app.get("/equipamentos/:identificador", { preHandler: somenteGestorAlmoxarifado }, controller.obter);
  app.post("/equipamentos", { preHandler: somenteGestorAlmoxarifado }, controller.criar);
  app.patch("/equipamentos/:identificador", { schema: { body: schemaEdicao }, preHandler: somenteGestorAlmoxarifado }, controller.editar);
  app.delete("/equipamentos/:identificador", { schema: { querystring: schemaVersao }, preHandler: somenteGestorAlmoxarifado }, controller.excluir);
  app.post("/equipamentos/:identificador/triagem/iniciar", { schema: { body: schemaVersao }, preHandler: somenteGestorAlmoxarifado }, controller.iniciarTriagem);
  app.post("/equipamentos/:identificador/triagem/concluir", { schema: { body: schemaVersao }, preHandler: somenteGestorAlmoxarifado }, controller.concluirTriagem);
  app.post("/equipamentos/:identificador/movimentacoes", { schema: { body: schemaMovimentacao }, preHandler: somenteGestorAlmoxarifado }, controller.movimentar);
  app.patch("/equipamentos/:identificador/estado-fisico", { schema: { body: schemaEstadoFisico }, preHandler: somenteGestorAlmoxarifado }, controller.alterarEstadoFisico);
}
