import type { FastifyInstance } from "fastify";
import { ContratoController } from "../controllers/ContratoController.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

const schemaEdicao = {
  type: "object", additionalProperties: false, required: ["versao"], minProperties: 2,
  properties: {
    dataVencimento: { type: "string", minLength: 10 },
    valorMensal: { type: "number", minimum: 0 },
    renovacaoAutomatica: { type: "boolean" },
    clausulas: { type: "array", items: { type: "string", minLength: 1 } },
    versao: { type: "integer", minimum: 1 },
  },
} as const;
const schemaVersao = { type: "object", additionalProperties: false, required: ["versao"], properties: { versao: { type: "integer", minimum: 1 } } } as const;

export async function contratoRoutes(app: FastifyInstance) {
  const controller = new ContratoController();
  const somenteOperadorCadastro = permitirPapeis(PapelUsuario.OPERADOR_CADASTRO);
  app.get("/contratos", { preHandler: somenteOperadorCadastro }, controller.listar);
  app.get("/contratos/:id", { preHandler: somenteOperadorCadastro }, controller.obter);
  app.post("/contratos", { preHandler: somenteOperadorCadastro }, controller.criar);
  app.patch("/contratos/:id", { schema: { body: schemaEdicao }, preHandler: somenteOperadorCadastro }, controller.editar);
  app.delete("/contratos/:id", { schema: { querystring: schemaVersao }, preHandler: somenteOperadorCadastro }, controller.excluir);
}
