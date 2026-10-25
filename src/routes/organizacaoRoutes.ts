
import type { FastifyInstance } from "fastify";
import { OrganizacaoController } from "../controllers/OrganizacaoController.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { permitirPapeis } from "../plugins/jwt.js";

const schemaEdicao = {
  type: "object",
  additionalProperties: false,
  required: ["versao"],
  minProperties: 2,
  properties: {
    razaoSocial: { type: "string", minLength: 1, maxLength: 200 },
    cnpj: { type: "string", minLength: 14, maxLength: 18 },
    inscricaoEstadual: { type: "string", minLength: 1, maxLength: 30 },
    enderecoCompleto: { type: "string", minLength: 1, maxLength: 300 },
    telefone: { type: "string", minLength: 1, maxLength: 30 },
    email: { type: "string", minLength: 3, maxLength: 254 },
    ativo: { type: "boolean" },
    versao: { type: "integer", minimum: 1 },
  },
} as const;

const schemaVersao = {
  type: "object",
  additionalProperties: false,
  required: ["versao"],
  properties: { versao: { type: "integer", minimum: 1 } },
} as const;

export async function organizacaoRoutes(app: FastifyInstance) {
  const controller = new OrganizacaoController();

  const somenteOperadorCadastro = permitirPapeis(PapelUsuario.OPERADOR_CADASTRO);

  app.get("/organizacoes", { preHandler: somenteOperadorCadastro }, controller.listarTodas);
  app.get("/organizacoes/:id", { preHandler: somenteOperadorCadastro }, controller.obter);
  app.post("/organizacoes", { preHandler: somenteOperadorCadastro }, controller.criar);
  app.patch("/organizacoes/:id", { schema: { body: schemaEdicao }, preHandler: somenteOperadorCadastro }, controller.editar);
  app.delete("/organizacoes/:id", { schema: { querystring: schemaVersao }, preHandler: somenteOperadorCadastro }, controller.excluir);
}
